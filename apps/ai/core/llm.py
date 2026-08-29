import asyncio
import base64
import json as _json
import logging
from typing import AsyncGenerator
from core.config import settings
from core.exceptions import LLMError

logger = logging.getLogger("llm")
from core.tools import (
    ToolDefinition, ToolCall, LLMToolResponse,
    tool_defs_to_openai, tool_defs_to_gemini,
)

# Provider + model constants
GEMINI_FLASH = ("gemini", "gemini-2.5-flash")
# Historically the cheap model. Repointed at the main model: quality is
# preferred over cost on every call that used it.
GPT4O_MINI = ("openai", "gpt-5.6-luna")
EMBEDDING_MODEL = ("openai", "text-embedding-3-small")

# Models whose Chat Completions API only accepts the default temperature (1) —
# a custom value is rejected outright with a 400 (verified live: gpt-5.6-luna).
_FIXED_TEMPERATURE_MODELS = {"gpt-5.6-luna"}
# Models that reject function/tool calling on /v1/chat/completions unless
# reasoning_effort is explicitly disabled (verified live: gpt-5.6-luna — without
# this, tool calls fail with "Function tools with reasoning_effort are not
# supported... use /v1/responses or set reasoning_effort to 'none'").
_REASONING_EFFORT_REQUIRED_FOR_TOOLS = {"gpt-5.6-luna"}

# Default budget for complete_json. On a reasoning model, max_completion_tokens covers
# REASONING PLUS OUTPUT, and reasoning runs first — so a budget that only fits the answer
# returns HTTP 200 with an empty string and finish_reason="length". Measured on
# gpt-5.6-luna: at 3000 the model spent all 3000 tokens reasoning and emitted no content
# (3/3 runs); at 8000 it reasoned for 107 and wrote the full answer. The cap is not a
# charge — only generated tokens are billed — so headroom here is strictly cheaper than
# paying for a burnt budget that produced nothing.
JSON_COMPLETION_MAX_TOKENS = 8000


def _openai_completion_kwargs(
    model: str, temperature: float, max_tokens: int | None = None, for_tools: bool = False
) -> dict:
    """Model-aware kwargs for the OpenAI chat.completions API. `max_tokens` is
    always sent as `max_completion_tokens` — the modern, universally-accepted
    name (verified backward-compatible with gpt-4.1-mini too); some newer
    models reject the legacy `max_tokens` name outright."""
    kwargs: dict = {"model": model}
    if max_tokens is not None:
        kwargs["max_completion_tokens"] = max_tokens
    if model not in _FIXED_TEMPERATURE_MODELS:
        kwargs["temperature"] = temperature
    if for_tools and model in _REASONING_EFFORT_REQUIRED_FOR_TOOLS:
        kwargs["reasoning_effort"] = "none"
    return kwargs

def _is_transient_llm_error(exc: Exception) -> bool:
    """Whether a provider call failed for a reason that retrying can fix.

    Checked by explicit status code first (429 and 5xx), because matching on class name or
    message alone would also catch permanent 4xx failures — retrying a malformed request
    just burns time and returns the same error.
    """
    status = getattr(exc, "status_code", None)
    if status is None:
        status = getattr(getattr(exc, "response", None), "status_code", None)
    if isinstance(status, int):
        return status == 429 or status >= 500

    name = type(exc).__name__.lower()
    if any(k in name for k in ("ratelimit", "timeout", "connection", "serviceunavailable", "internalserver")):
        return True
    text = str(exc).lower()
    return any(m in text for m in ("rate limit", "timed out", "timeout", "overloaded", "temporarily unavailable"))


def _aspect_ratio_hint(aspect_ratio: str) -> str:
    return {
        "1:1":  "square (1:1 aspect ratio)",
        "16:9": "landscape widescreen (16:9 aspect ratio)",
        "9:16": "portrait vertical (9:16 aspect ratio)",
        "4:3":  "landscape standard (4:3 aspect ratio)",
    }.get(aspect_ratio, "square (1:1 aspect ratio)")



def _pad_to_square(data: bytes) -> bytes:
    """Add white padding to make an image square without stretching."""
    import io
    from PIL import Image
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    w, h = img.size
    if w == h:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    size = max(w, h)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    canvas.paste(img, ((size - w) // 2, (size - h) // 2))
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


def _resize_for_reference(data: bytes, max_side: int = 512) -> bytes:
    """Downsample a reference image to max_side px on longest dimension.

    Keeps the anchor small (~50-100 KB) so API input stays well within limits
    while preserving enough visual detail for style matching.
    """
    import io
    from PIL import Image
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    if max(w, h) <= max_side:
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    scale = max_side / max(w, h)
    img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _describe_image_failure(response, candidate) -> str:
    """Build a diagnostic string explaining why Gemini returned no image.

    IMAGE_OTHER and empty-content responses are opaque on their own. This pulls
    the prompt-level block reason, candidate finish reason, safety ratings, and
    any TEXT the model returned instead of an image (a strong signal that the
    prompt read as instructions/refusal rather than a scene to draw).
    """
    bits: list[str] = []
    finish = getattr(candidate, "finish_reason", None) if candidate else None
    bits.append(f"finish_reason={finish}")

    pf = getattr(response, "prompt_feedback", None)
    if pf is not None:
        block = getattr(pf, "block_reason", None)
        if block:
            bits.append(f"block_reason={block}")
        pf_ratings = getattr(pf, "safety_ratings", None)
        blocked = [
            f"{getattr(r, 'category', '?')}={getattr(r, 'probability', '?')}"
            for r in (pf_ratings or [])
            if getattr(r, "blocked", False)
        ]
        if blocked:
            bits.append(f"prompt_safety_blocked=[{', '.join(blocked)}]")

    if candidate is not None:
        cand_ratings = getattr(candidate, "safety_ratings", None)
        flagged = [
            f"{getattr(r, 'category', '?')}={getattr(r, 'probability', '?')}"
            for r in (cand_ratings or [])
            if getattr(r, "blocked", False)
        ]
        if flagged:
            bits.append(f"candidate_safety_blocked=[{', '.join(flagged)}]")
        # Did the model return text instead of an image?
        content = getattr(candidate, "content", None)
        text_parts = [
            getattr(p, "text", "")
            for p in (getattr(content, "parts", None) or [])
            if getattr(p, "text", None)
        ]
        if text_parts:
            snippet = " ".join(text_parts)[:200].replace("\n", " ")
            bits.append(f"model_returned_text='{snippet}'")
    return " ".join(bits)


# A minimal 1x1 red PNG in base64
_RED_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)

# Gemini Omni model used for video generation. Pin here so it's swappable without touching call sites.
_OMNI_VIDEO_MODEL = "gemini-omni-1.1-flash"

# The model renders at most one 10-second shot per interaction; longer videos are built by
# chaining extensions off the previous interaction, up to a hard 40s ceiling (the API refuses
# to extend footage longer than 30s). Durations are therefore always a multiple of 10.
VIDEO_SEGMENT_SECONDS = 10
MAX_VIDEO_SECONDS = 40
VIDEO_DURATION_OPTIONS = (10, 20, 30, 40)

# Retries are scoped to a single segment, never the whole chain — each segment is its own
# billed render, so restarting a 40s video from the top on a late failure would re-pay for
# footage that already succeeded. Observed latency is ~30s for the opening shot and
# ~100-150s per extension, so 300s per attempt is generous headroom.
VIDEO_SEGMENT_ATTEMPTS = 3
VIDEO_SEGMENT_TIMEOUT = 300

# A minimal 1-second black H.264 MP4 (64x64), used as the MOCK_MODE response for generate_video.
_MOCK_VIDEO_MP4_B64 = (
    "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMVbW9vdgAAAGxtdmhkAAAAAAAAAAAA"
    "AAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA"
    "AABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAkB0cmFrAAAAXHRraGQAAAADAAAA"
    "AAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAA"
    "AAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAA"
    "AAG4bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZp"
    "ZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABY21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAA"
    "ACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAASNzdGJsAAAAv3N0c2QAAAAAAAAA"
    "AQAAAK9hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2"
    "MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANWF2Y0MBZAAK/+EAGGdkAAqs2UQmwEQA"
    "AAMABAAAAwAIPEiWWAEABmjr48siwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAW"
    "uAAAAAAAAAAYc3R0cwAAAAAAAAABAAAAAQAAQAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAAB"
    "AAAAFHN0c3oAAAAAAAAC1wAAAAEAAAAUc3RjbwAAAAAAAAABAAADRQAAAGF1ZHRhAAAAWW1ldGEA"
    "AAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxk"
    "YXRhAAAAAQAAAABMYXZmNjEuNy4xMDAAAAAIZnJlZQAAAt9tZGF0AAACrQYF//+p3EXpvebZSLeW"
    "LNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzIwNCAzNzM2OTdiIC0gSC4yNjQvTVBFRy00IEFWQyBj"
    "b2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQu"
    "aHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4Mzow"
    "eDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1l"
    "X3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0y"
    "MSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTIgbG9va2FoZWFk"
    "X3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAg"
    "Ymx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0y"
    "IGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRw"
    "PTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJj"
    "X2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0w"
    "IHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAiZYiEABX//vfJ"
    "78Cm69vetb+Tz0j4e8ZQD6wZq+vbSH/7MQ=="
)

_MOCK_CONTENT_RESPONSE = """\
Exciting news! 🚀 We just launched our AI-powered productivity suite designed specifically for founders and small teams.

Here's what makes it different:
✅ Automate repetitive tasks in minutes, not months
✅ Built-in analytics that surface what actually matters
✅ Integrates with the tools you already use

We've helped 500+ founders reclaim 10+ hours per week. Ready to see what you could build with that time?

👇 Drop a comment below or DM us for early access.

#ProductivityHacks #StartupLife #AITools #FounderLife #SaaS
"""

_MOCK_ANALYSIS_RESPONSE = """\
**Business Metrics Analysis – Q1 2025**

**Revenue Trend:** MRR grew from $42,000 to $58,500 (+39.3%) over the past 90 days. ARR now stands at $702,000.

**Key Findings:**
- Customer acquisition cost (CAC) decreased 12% to $320/customer
- Average contract value increased to $185/month (up from $162)
- Churn rate is 2.1% – below the 3% SaaS benchmark ✅
- Burn rate: $38,000/month with 14.2 months runway

**Anomalies Detected:**
- Week 8 showed a revenue dip of 18% – correlates with a major competitor pricing announcement
- Subscriber growth spiked 34% in Week 11 following the ProductHunt launch

**Recommendation:** Focus on expanding the enterprise tier – current NRR of 108% indicates strong expansion revenue potential.
"""

_MOCK_RESEARCH_RESPONSE = """\
**Research Report: AI Productivity Tools Market – 2025**

**Market Overview:**
The AI productivity tools market is projected to reach $23.8B by 2026, growing at 31% CAGR. SMBs represent 42% of total addressable market.

**Key Competitors:**
1. **Notion AI** – Strong in knowledge management, 20M+ users, recently added AI writing
2. **Monday.com AI** – Workflow automation focus, strong enterprise presence
3. **ClickUp AI** – Broad feature set, aggressive pricing, targeting SMBs

**Emerging Trends:**
- Vertical-specific AI agents (legal, finance, marketing) outperforming generalist tools
- Founders prioritize integrations over standalone tools (78% in recent survey)
- Voice-first interfaces gaining traction for mobile-first workflows

**Opportunities:**
- No dominant player owns the "founder-specific" AI workspace category
- Integration with accounting software is a significant gap
- Bilingual AI support (English + regional languages) underserved

**Sources:** TechCrunch, Crunchbase, G2 reviews, founder community surveys.
"""

_MOCK_LEGAL_RESPONSE = """\
**Legal Analysis – NDA Review**

**Document Type:** Mutual Non-Disclosure Agreement
**Jurisdiction:** Delaware, United States

**Risk Assessment: MEDIUM**

**Key Findings:**
1. **Definition of Confidential Information** (Clause 2) – Broadly defined; recommend narrowing to written/marked materials to avoid disputes.
2. **Duration** (Clause 5) – 5-year term is longer than market standard (2-3 years); consider negotiating down.
3. **Residuals Clause** – Present and potentially problematic; allows retained information to be used in future work.
4. **No Mutual Indemnification** – One-sided indemnification favors the disclosing party.

**Missing Protections:**
- No dispute resolution mechanism specified
- No governing law clause for international parties
- No limitation on remedies beyond injunctive relief

**Recommendation:** Request modifications to Clauses 2, 5, and add a reciprocal indemnification clause before signing.
"""

_MOCK_EMAIL_RESPONSE = """\
Subject: Re: Partnership Opportunity – Veqiro AI Integration

Hi Sarah,

Thank you for reaching out about the partnership opportunity. We've reviewed your proposal and are excited about the potential synergies between our platforms.

I'd love to schedule a 30-minute call this week to discuss:
1. Technical integration requirements
2. Revenue share structure
3. Timeline for pilot launch

Are you available Thursday or Friday between 2–5 PM EST? I'll send a calendar invite once we confirm.

Looking forward to connecting!

Best regards,
Alex
Founder, Veqiro AI
"""


def _chunk_text(text: str, chunk_size: int = 8) -> list[str]:
    """Split text into word chunks for mock streaming."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk + " ")
    return chunks


def _select_mock_response(system: str, messages: list) -> str:
    """Pick a mock response based on context keywords."""
    parts = [system]
    for m in messages:
        c = m.get("content", "")
        if isinstance(c, str) and c:
            parts.append(c)
        elif isinstance(c, list):
            for item in c:
                if isinstance(item, dict) and isinstance(item.get("content"), str):
                    parts.append(item["content"])
                elif isinstance(item, str):
                    parts.append(item)
    context = " ".join(parts).lower()
    if any(k in context for k in ["legal", "contract", "nda", "compliance", "law"]):
        return _MOCK_LEGAL_RESPONSE
    if any(k in context for k in ["email", "calendar", "inbox", "reply", "draft"]):
        return _MOCK_EMAIL_RESPONSE
    if any(k in context for k in ["analytics", "data", "metrics", "revenue", "finance", "forecast"]):
        return _MOCK_ANALYSIS_RESPONSE
    if any(k in context for k in ["research", "competitor", "market", "trend"]):
        return _MOCK_RESEARCH_RESPONSE
    return _MOCK_CONTENT_RESPONSE


class LLMClient:
    """Unified LLM client supporting Gemini, OpenAI, and Anthropic."""

    async def complete(
        self,
        provider: str,
        model: str,
        system: str,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format=None,
    ) -> str:
        if settings.MOCK_MODE:
            await asyncio.sleep(0.05)  # simulate tiny latency
            return _select_mock_response(system, messages)
        return await self._real_complete(provider, model, system, messages, temperature, max_tokens, response_format)

    async def complete_json(
        self,
        provider: str,
        model: str,
        system: str,
        messages: list,
        temperature: float = 0.3,
        max_tokens: int = JSON_COMPLETION_MAX_TOKENS,
    ) -> dict | list:
        """Structured-output completion: enforces the provider's JSON mode, parses
        the result, and retries on a parse failure, an empty response, or a transient
        provider error.

        Use this instead of `complete` + manual json parsing for any call whose
        output must be machine-readable. Returns the parsed dict/list; raises
        LLMError when the retries are exhausted.
        """
        from core.utils import safe_json_loads
        response_format = {"type": "json_object"}
        raw = await self._complete_retrying_transient(
            provider, model, system, messages, temperature, max_tokens, response_format
        )

        # An empty body means the model never got to write anything — on a reasoning model
        # that is the budget running out during reasoning. Corrective feedback cannot help a
        # model that never spoke; only more room can, so retry with a bigger budget rather
        # than falling through to the malformed-JSON path below.
        if not (raw or "").strip():
            roomier = max(max_tokens * 3, JSON_COMPLETION_MAX_TOKENS * 2)
            logger.warning(
                "complete_json got an empty response — retrying with max_tokens=%d (was %d) | model=%s",
                roomier, max_tokens, model,
            )
            raw = await self._complete_retrying_transient(
                provider, model, system, messages, temperature, roomier, response_format
            )
            if not (raw or "").strip():
                raise LLMError(
                    f"complete_json got an empty response from {model} even at "
                    f"max_tokens={roomier} — the model produced no content"
                )

        try:
            return safe_json_loads(raw)
        except Exception as first_err:
            if settings.MOCK_MODE:
                raise LLMError(f"complete_json got unparseable mock response: {first_err}")
            logger.warning("complete_json parse failed — retrying once | model=%s error=%s", model, first_err)
            retry_messages = messages + [
                {"role": "assistant", "content": raw[:2000]},
                {"role": "user", "content": (
                    "Your previous response was not valid JSON. Return ONLY the JSON "
                    "object/array — no prose, no markdown fences, no explanation."
                )},
            ]
            raw = await self._complete_retrying_transient(
                provider, model, system, retry_messages, temperature, max_tokens, response_format
            )
            try:
                return safe_json_loads(raw)
            except Exception as second_err:
                raise LLMError(f"complete_json returned unparseable JSON after retry: {second_err}")

    async def _complete_retrying_transient(
        self, provider, model, system, messages, temperature, max_tokens, response_format,
        attempts: int = 3,
    ) -> str:
        """`complete`, retrying provider-side blips (429 / 5xx / timeouts) with backoff.

        Without this a single rate-limit hiccup surfaces to the user as a hard failure —
        agents that call complete_json turn the raised LLMError into a canned "failed,
        please retry" card, which reads as permanently broken rather than momentarily busy.
        Only transient statuses are retried; a 4xx is re-raised immediately.
        """
        last_err: Exception | None = None
        for attempt in range(attempts):
            if attempt:
                await asyncio.sleep(2 ** attempt)  # 2s, 4s
            try:
                return await self.complete(
                    provider, model, system, messages, temperature, max_tokens, response_format
                )
            except Exception as exc:
                if not _is_transient_llm_error(exc):
                    raise
                last_err = exc
                logger.warning(
                    "complete_json transient provider error — attempt %d/%d | model=%s | %s",
                    attempt + 1, attempts, model, exc,
                )
        raise LLMError(f"provider unavailable after {attempts} attempts: {last_err}")

    async def _real_complete(self, provider, model, system, messages, temperature, max_tokens, response_format):
        import time
        from langfuse import Langfuse as _Langfuse
        from core.observability import get_llm_context, get_langfuse

        obs_ctx = get_llm_context()
        lf = get_langfuse()
        generation = None

        if lf:
            try:
                if obs_ctx.trace_id is None:
                    obs_ctx.trace_id = _Langfuse.create_trace_id()
                generation = lf.start_observation(
                    trace_context={"trace_id": obs_ctx.trace_id},
                    name=f"complete.{provider}",
                    as_type="generation",
                    model=model,
                    input={"system": system, "messages": messages},
                    model_parameters={"temperature": temperature, "max_tokens": max_tokens},
                    metadata={"agent": obs_ctx.agent_slug, "org_id": obs_ctx.org_id},
                )
            except Exception:
                pass

        t0 = time.perf_counter()
        retries = [1, 3, 9]
        last_exc = None
        for delay in [0] + retries:
            if delay:
                await asyncio.sleep(delay)
            try:
                if provider == "gemini":
                    result = await self._gemini_complete(model, system, messages, temperature, max_tokens, json_mode=bool(response_format))
                    input_text = system + " ".join(str(m.get("content", "")) for m in messages)
                    pt, ct = self.count_tokens(input_text), self.count_tokens(result)
                elif provider == "openai":
                    result, pt, ct = await self._openai_complete(model, system, messages, temperature, max_tokens, response_format)
                else:
                    raise LLMError(f"Unknown provider: {provider}")
                if generation:
                    try:
                        generation.update(
                            output=result,
                            usage_details={"input": pt, "output": ct},
                            metadata={"latency_ms": int((time.perf_counter() - t0) * 1000), "agent": obs_ctx.agent_slug, "org_id": obs_ctx.org_id},
                        )
                        generation.end()
                    except Exception:
                        pass
                return result
            except Exception as e:
                last_exc = e
        if generation:
            try:
                generation.update(level="ERROR", status_message=str(last_exc))
                generation.end()
            except Exception:
                pass
        raise LLMError(f"LLM call failed after retries: {last_exc}")

    async def _gemini_complete(self, model, system, messages, temperature, max_tokens, json_mode=False):
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        contents = [
            types.Content(
                role="user" if m["role"] == "user" else "model",
                parts=[types.Part(text=m["content"] if isinstance(m["content"], str) else str(m["content"]))],
            )
            for m in messages
        ]
        response = await client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=temperature,
                max_output_tokens=max_tokens,
                response_mime_type="application/json" if json_mode else None,
                # gemini-2.5-* are thinking models: left unbounded, "thinking"
                # tokens eat into max_output_tokens and can exhaust the whole
                # budget (finish_reason=MAX_TOKENS), leaving response.text=None.
                # These are plain text-generation calls — no reasoning needed —
                # so disable thinking to give the full budget to the output.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        # response.text is None when the model produced no text part (e.g. it
        # hit MAX_TOKENS, or output was safety-blocked). Returning None here
        # crashes downstream (.strip(), count_tokens). Surface a clear error so
        # the retry loop can react and logs explain why.
        text = response.text
        if text is None:
            finish = None
            try:
                print("Gemini response candidates:", response.candidates)
                print(response)
                finish = response.candidates[0].finish_reason
            except Exception:
                pass
            raise LLMError(f"Gemini returned no text (finish_reason={finish})")
        return text

    async def _openai_complete(self, model, system, messages, temperature, max_tokens, response_format):
        import openai as _openai
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        oai_messages = [{"role": "system", "content": system}] + messages
        kwargs = _openai_completion_kwargs(model, temperature, max_tokens)
        kwargs["messages"] = oai_messages
        if response_format:
            kwargs["response_format"] = response_format
        resp = await client.chat.completions.create(**kwargs)
        usage = resp.usage
        return resp.choices[0].message.content, usage.prompt_tokens, usage.completion_tokens

    async def stream(
        self,
        provider: str,
        model: str,
        system: str,
        messages: list,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        if settings.MOCK_MODE:
            mock_text = _select_mock_response(system, messages)
            chunks = _chunk_text(mock_text, chunk_size=7)
            for chunk in chunks:
                await asyncio.sleep(0.04)
                yield chunk
            return
        async for token in self._real_stream(provider, model, system, messages, temperature):
            yield token

    async def _real_stream(self, provider, model, system, messages, temperature):
        import time
        from langfuse import Langfuse as _Langfuse
        from core.observability import get_llm_context, get_langfuse

        obs_ctx = get_llm_context()
        lf = get_langfuse()
        generation = None

        if lf:
            try:
                if obs_ctx.trace_id is None:
                    obs_ctx.trace_id = _Langfuse.create_trace_id()
                generation = lf.start_observation(
                    trace_context={"trace_id": obs_ctx.trace_id},
                    name=f"stream.{provider}",
                    as_type="generation",
                    model=model,
                    input={"system": system, "messages": messages},
                    model_parameters={"temperature": temperature},
                    metadata={"agent": obs_ctx.agent_slug, "org_id": obs_ctx.org_id},
                )
            except Exception:
                pass

        t0 = time.perf_counter()
        accumulated: list[str] = []
        retries = [1, 3, 9]
        last_exc = None
        succeeded = False

        for delay in [0] + retries:
            if delay:
                await asyncio.sleep(delay)
            try:
                if provider == "gemini":
                    async for token in self._gemini_stream(model, system, messages, temperature):
                        accumulated.append(token)
                        yield token
                    succeeded = True
                    break
                elif provider == "openai":
                    async for token in self._openai_stream(model, system, messages, temperature):
                        accumulated.append(token)
                        yield token
                    succeeded = True
                    break
                else:
                    raise LLMError(f"Unknown provider: {provider}")
            except Exception as e:
                last_exc = e
                accumulated = []

        if generation:
            try:
                full_text = "".join(accumulated)
                input_text = system + " ".join(str(m.get("content", "")) for m in messages)
                if succeeded:
                    generation.update(
                        output=full_text,
                        usage_details={"input": self.count_tokens(input_text), "output": self.count_tokens(full_text)},
                        metadata={"latency_ms": int((time.perf_counter() - t0) * 1000), "agent": obs_ctx.agent_slug, "org_id": obs_ctx.org_id},
                    )
                else:
                    generation.update(level="ERROR", status_message=str(last_exc))
                generation.end()
            except Exception:
                pass

        if not succeeded:
            raise LLMError(f"LLM stream failed after retries: {last_exc}")

    async def _gemini_stream(self, model, system, messages, temperature):
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        contents = [
            types.Content(
                role="user" if m["role"] == "user" else "model",
                parts=[types.Part(text=m["content"] if isinstance(m["content"], str) else str(m["content"]))],
            )
            for m in messages
        ]
        async for chunk in client.aio.models.generate_content_stream(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=temperature,
            ),
        ):
            if chunk.text:
                yield chunk.text

    async def _openai_stream(self, model, system, messages, temperature):
        """Token stream over the plain `create(stream=True)` API.

        Not `client.chat.completions.stream(...).text_stream`: that helper's
        `text_stream` attribute was removed in the openai v3 SDK, so the call
        raised AttributeError on every attempt and the retry loop turned it
        into "LLM stream failed after retries". `create(stream=True)` has the
        same shape across v1-v3.
        """
        import openai as _openai
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        oai_messages = [{"role": "system", "content": system}] + messages
        stream_kwargs = _openai_completion_kwargs(model, temperature)
        stream_kwargs["messages"] = oai_messages
        stream_kwargs["stream"] = True
        stream = await client.chat.completions.create(**stream_kwargs)
        async for chunk in stream:
            if not chunk.choices:
                continue
            text = chunk.choices[0].delta.content
            if text:
                yield text

    # ── Tool-calling completion ───────────────────────────────────────────

    async def complete_with_tools(
        self,
        provider: str,
        model: str,
        system: str,
        messages: list,
        tools: list[ToolDefinition],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        tool_choice: str = "auto",
    ) -> LLMToolResponse:
        """Complete with tool/function calling support. Returns text OR tool calls."""
        if settings.MOCK_MODE:
            return await self._mock_complete_with_tools(system, messages, tools)
        return await self._real_complete_with_tools(
            provider, model, system, messages, tools, temperature, max_tokens, tool_choice
        )

    async def _real_complete_with_tools(
        self, provider, model, system, messages, tools, temperature, max_tokens, tool_choice="auto"
    ) -> LLMToolResponse:
        import time
        from langfuse import Langfuse as _Langfuse
        from core.observability import get_llm_context, get_langfuse

        obs_ctx = get_llm_context()
        lf = get_langfuse()
        generation = None

        if lf:
            try:
                if obs_ctx.trace_id is None:
                    obs_ctx.trace_id = _Langfuse.create_trace_id()
                generation = lf.start_observation(
                    trace_context={"trace_id": obs_ctx.trace_id},
                    name=f"complete_with_tools.{provider}",
                    as_type="generation",
                    model=model,
                    input={"system": system, "messages": messages},
                    model_parameters={"temperature": temperature, "max_tokens": max_tokens},
                    metadata={"agent": obs_ctx.agent_slug, "org_id": obs_ctx.org_id},
                )
            except Exception:
                pass

        t0 = time.perf_counter()
        retries = [1, 3, 9]
        last_exc = None
        for delay in [0] + retries:
            if delay:
                await asyncio.sleep(delay)
            try:
                if provider == "gemini":
                    result = await self._gemini_complete_with_tools(
                        model, system, messages, tools, temperature, max_tokens, tool_choice
                    )
                    input_text = system + " ".join(str(m.get("content", "")) for m in messages)
                    pt = self.count_tokens(input_text)
                    output_text = result.content or " ".join(tc.name for tc in result.tool_calls)
                    ct = self.count_tokens(output_text)
                elif provider == "openai":
                    result, pt, ct = await self._openai_complete_with_tools(
                        model, system, messages, tools, temperature, max_tokens, tool_choice
                    )
                else:
                    raise LLMError(f"Unknown provider: {provider}")
                if generation:
                    try:
                        output_repr = result.content or f"[{len(result.tool_calls)} tool call(s): {', '.join(tc.name for tc in result.tool_calls)}]"
                        generation.update(
                            output=output_repr,
                            usage_details={"input": pt, "output": ct},
                            metadata={
                                "latency_ms": int((time.perf_counter() - t0) * 1000),
                                "finish_reason": result.finish_reason,
                                "tool_calls": [tc.name for tc in result.tool_calls],
                                "agent": obs_ctx.agent_slug,
                                "org_id": obs_ctx.org_id,
                            },
                        )
                        generation.end()
                    except Exception:
                        pass
                return result
            except Exception as e:
                last_exc = e
        if generation:
            try:
                generation.update(level="ERROR", status_message=str(last_exc))
                generation.end()
            except Exception:
                pass
        raise LLMError(f"LLM tool call failed after retries: {last_exc}")

    async def _openai_complete_with_tools(
        self, model, system, messages, tools, temperature, max_tokens, tool_choice="auto"
    ) -> tuple:
        import openai as _openai
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        oai_messages = [{"role": "system", "content": system}] + messages
        oai_tools = tool_defs_to_openai(tools)
        kwargs = _openai_completion_kwargs(model, temperature, max_tokens, for_tools=True)
        kwargs["messages"] = oai_messages
        kwargs["tools"] = oai_tools
        kwargs["tool_choice"] = tool_choice
        resp = await client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        usage = resp.usage
        pt, ct = usage.prompt_tokens, usage.completion_tokens
        if choice.message.tool_calls:
            calls = []
            for tc in choice.message.tool_calls:
                try:
                    args = _json.loads(tc.function.arguments)
                except Exception:
                    args = {}
                calls.append(ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=args,
                ))
            return LLMToolResponse(
                content=choice.message.content,
                tool_calls=calls,
                finish_reason="tool_calls",
            ), pt, ct
        return LLMToolResponse(
            content=choice.message.content or "",
            tool_calls=[],
            finish_reason="stop",
        ), pt, ct

    async def _gemini_complete_with_tools(
        self, model, system, messages, tools, temperature, max_tokens, tool_choice="auto"
    ) -> LLMToolResponse:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        gem_declarations = tool_defs_to_gemini(tools)
        gem_tools = types.Tool(function_declarations=gem_declarations)

        contents = [
            types.Content(
                role="user" if m["role"] == "user" else "model",
                parts=[types.Part(text=m["content"] if isinstance(m["content"], str) else str(m["content"]))],
            )
            for m in messages
        ]

        gem_config_kwargs: dict = dict(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_tokens,
            tools=[gem_tools],
        )
        if tool_choice == "none":
            gem_config_kwargs["tool_config"] = types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="NONE")
            )
        response = await client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(**gem_config_kwargs),
        )

        # Check for function calls in response
        calls = []
        text_parts = []
        for part in response.candidates[0].content.parts:
            if hasattr(part, "function_call") and part.function_call.name:
                fc = part.function_call
                args = dict(fc.args) if fc.args else {}
                calls.append(ToolCall(
                    name=fc.name,
                    arguments=args,
                ))
            elif hasattr(part, "text") and part.text:
                text_parts.append(part.text)

        if calls:
            return LLMToolResponse(
                content="\n".join(text_parts) if text_parts else None,
                tool_calls=calls,
                finish_reason="tool_calls",
            )
        return LLMToolResponse(
            content="\n".join(text_parts) or response.text,
            tool_calls=[],
            finish_reason="stop",
        )

    async def _mock_complete_with_tools(
        self, system: str, messages: list, tools: list[ToolDefinition]  # noqa: ARG002
    ) -> LLMToolResponse:
        """Mock mode: always return a text response — tool selection is LLM-driven in real mode."""
        await asyncio.sleep(0.05)
        return LLMToolResponse(
            content=_select_mock_response(system, messages),
            tool_calls=[],
            finish_reason="stop",
        )

    async def generate_image_with_image_bytes(
        self,
        prompt: str,
        images: list[bytes],
        aspect_ratio: str = "1:1"
    ) -> str:
        """Image generation with raw reference image bytes via Gemini."""
        if settings.MOCK_MODE:
            await asyncio.sleep(0.05)
            return _RED_PNG_B64

        import time
        import base64 as _base64
        from langfuse import Langfuse as _Langfuse
        from core.observability import get_llm_context, get_langfuse
        from google import genai
        from google.genai import types

        obs_ctx = get_llm_context()
        lf = get_langfuse()
        generation = None
        t0 = time.perf_counter()

        if lf:
            try:
                if obs_ctx.trace_id is None:
                    obs_ctx.trace_id = _Langfuse.create_trace_id()

                generation = lf.start_observation(
                    trace_context={"trace_id": obs_ctx.trace_id},
                    name="generate_image_with_references",
                    as_type="generation",
                    model=settings.GEMINI_IMAGE_MODEL,
                    input={
                        "prompt": prompt[:500],
                        "num_references": len(images),
                        "aspect_ratio": aspect_ratio,
                    },
                    model_parameters={
                        "aspect_ratio": aspect_ratio,
                        "num_references": len(images),
                    },
                )
            except Exception:
                pass

        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            full_prompt = (
                f"{prompt}\n\n"
                f"Output image dimensions: {_aspect_ratio_hint(aspect_ratio)}."
            )

            logger.info(
                "generate_image_with_references | refs=%s prompt_len=%s",
                len(images),
                len(full_prompt),
            )

            parts = [types.Part.from_text(text=full_prompt)]

            for idx, img_bytes in enumerate(images):
                logger.info(
                    "reference_%s original_size_kb=%.2f",
                    idx + 1,
                    len(img_bytes) / 1024,
                )

                squared = _pad_to_square(img_bytes)

                optimized = _resize_for_reference(
                    squared,
                    max_side=512,
                )

                logger.info(
                    "reference_%s resized_size_kb=%.2f",
                    idx + 1,
                    len(optimized) / 1024,
                )

                parts.append(
                    types.Part.from_bytes(
                        data=optimized,
                        mime_type="image/png",
                    )
                )

            # aspect_ratio as a real API parameter — the text hint alone is only
            # advisory and Gemini frequently returns square images for 16:9 requests
            image_config = None
            if aspect_ratio in ("1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"):
                image_config = types.ImageConfig(aspect_ratio=aspect_ratio)

            response = await client.aio.models.generate_content(
                model=settings.GEMINI_IMAGE_MODEL,
                contents=parts,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=image_config,
                ),
            )

            logger.info(
                "generate_image_with_references | response received"
            )

            candidate = (
                response.candidates[0]
                if response.candidates
                else None
            )

            if candidate is None or candidate.content is None:
                detail = _describe_image_failure(
                    response,
                    candidate,
                )

                logger.warning(
                    "generate_image_with_references | no image content | %s",
                    detail,
                )

                logger.warning(
                    "FULL GEMINI RESPONSE:\n%s",
                    response,
                )

                raise LLMError(
                    f"Gemini returned no image content ({detail})"
                )

            for part in candidate.content.parts:
                if getattr(part, "inline_data", None) is not None:

                    b64 = _base64.b64encode(
                        part.inline_data.data
                    ).decode()

                    if generation:
                        try:
                            generation.update(
                                output="[image generated]",
                                usage_details={
                                    "input": 0,
                                    "output": 1,
                                    "total": 1,
                                    "unit": "IMAGES",
                                },
                                metadata={
                                    "latency_ms": int(
                                        (time.perf_counter() - t0)
                                        * 1000
                                    ),
                                    "aspect_ratio": aspect_ratio,
                                    "num_references": len(images),
                                    "org_id": obs_ctx.org_id,
                                    "agent": obs_ctx.agent_slug,
                                },
                            )
                            generation.end()
                        except Exception:
                            pass

                    return b64

            detail = _describe_image_failure(
                response,
                candidate,
            )

            logger.warning(
                "generate_image_with_references | no image data | %s",
                detail,
            )

            logger.warning(
                "FULL GEMINI RESPONSE:\n%s",
                response,
            )

            raise LLMError(
                f"Gemini returned no image data ({detail})"
            )

        except Exception as e:
            logger.exception(
                "generate_image_with_references failed"
            )

            if generation:
                try:
                    generation.update(
                        level="ERROR",
                        status_message=str(e),
                    )
                    generation.end()
                except Exception:
                    pass

            raise

    async def generate_image(self, prompt: str, aspect_ratio: str = "1:1") -> str:
        """Image generation with no reference images — pure text-to-image."""
        return await self.generate_image_with_image_bytes(prompt, [], aspect_ratio)

    async def generate_image_with_reference(
        self, prompt: str, reference_image_b64: str, aspect_ratio: str = "1:1"
    ) -> str:
        """Image generation with a single base64 reference image."""
        return await self.generate_image_with_image_bytes(
            prompt, [base64.b64decode(reference_image_b64)], aspect_ratio
        )

    async def generate_image_with_references(
        self, prompt: str, reference_images_b64: list[str], aspect_ratio: str = "1:1"
    ) -> str:
        """Image generation with multiple base64 reference images."""
        return await self.generate_image_with_image_bytes(
            prompt, [base64.b64decode(b64) for b64 in reference_images_b64], aspect_ratio
        )

    async def _create_video_segment(
        self,
        client,
        create_kwargs: dict,
        index: int,
        total: int,
    ):
        """Render one 10-second segment, retrying just that segment on failure.

        Scoped to a single segment on purpose: each one is an independent billed render, and
        the caller's `previous_interaction_id` still refers to the last SUCCESSFUL segment,
        so a retry continues the existing footage rather than starting the video over.
        """
        last_err: BaseException | None = None
        for attempt in range(VIDEO_SEGMENT_ATTEMPTS):
            if attempt:
                # Rate limits need real breathing room; anything else is likely transient.
                is_rate_limited = "429" in str(last_err) or "RESOURCE_EXHAUSTED" in str(last_err).upper()
                await asyncio.sleep(30 + attempt * 30 if is_rate_limited else 2 * attempt)
            try:
                interaction = await asyncio.wait_for(
                    client.aio.interactions.create(**create_kwargs),
                    timeout=VIDEO_SEGMENT_TIMEOUT,
                )
                if interaction.status not in ("completed", "incomplete"):
                    raise LLMError(
                        f"Gemini Omni interaction did not complete: status={interaction.status}"
                    )
                return interaction
            except Exception as err:
                last_err = err
                logger.warning(
                    "generate_video | segment %d/%d attempt %d/%d failed | error=%s",
                    index + 1, total, attempt + 1, VIDEO_SEGMENT_ATTEMPTS, err,
                )
        logger.error(
            "generate_video | segment %d/%d failed after %d attempts | %d segment(s) already "
            "rendered are lost | error=%s",
            index + 1, total, VIDEO_SEGMENT_ATTEMPTS, index, last_err,
        )
        raise LLMError(
            f"Gemini Omni segment {index + 1}/{total} failed after "
            f"{VIDEO_SEGMENT_ATTEMPTS} attempts: {last_err}"
        )

    async def generate_video(
        self,
        segment_prompts: list[str],
        images: list[tuple[bytes, str]] | None = None,
        aspect_ratio: str = "16:9",
        generate_audio: bool = True,
    ) -> bytes:
        """Video generation via Gemini Omni (`interactions.create`).

        `segment_prompts` holds one prompt per 10-second segment: the first opens the shot,
        each subsequent one extends the footage generated so far by another 10 seconds.
        Extensions are chained with `previous_interaction_id` (which needs `store=True` on
        the interaction it points at), and each extension returns the CUMULATIVE video — so
        the final interaction's output is the whole clip, not just the last segment.

        `images` (list of (bytes, mime_type) pairs, up to 5 + an optional logo) present =
        image-to-video, absent = text-to-video. They are attached to the opening segment
        only; later segments inherit them through the interaction chain."""
        if not segment_prompts:
            raise LLMError("generate_video requires at least one segment prompt")
        duration_seconds = len(segment_prompts) * VIDEO_SEGMENT_SECONDS
        if duration_seconds > MAX_VIDEO_SECONDS:
            raise LLMError(
                f"Video duration {duration_seconds}s exceeds the {MAX_VIDEO_SECONDS}s maximum"
            )

        if settings.MOCK_MODE:
            await asyncio.sleep(0.05)
            return base64.b64decode(_MOCK_VIDEO_MP4_B64)

        import time
        from langfuse import Langfuse as _Langfuse
        from core.observability import get_llm_context, get_langfuse
        from google import genai

        obs_ctx = get_llm_context()
        lf = get_langfuse()
        generation = None
        t0 = time.perf_counter()

        if lf:
            try:
                if obs_ctx.trace_id is None:
                    obs_ctx.trace_id = _Langfuse.create_trace_id()

                generation = lf.start_observation(
                    trace_context={"trace_id": obs_ctx.trace_id},
                    name="generate_video",
                    as_type="generation",
                    model=_OMNI_VIDEO_MODEL,
                    input={
                        "segment_prompts": [p[:500] for p in segment_prompts],
                        "num_images": len(images) if images else 0,
                        "aspect_ratio": aspect_ratio,
                        "duration_seconds": duration_seconds,
                    },
                    model_parameters={
                        "aspect_ratio": aspect_ratio,
                        "duration_seconds": duration_seconds,
                        "num_segments": len(segment_prompts),
                        "generate_audio": generate_audio,
                    },
                )
            except Exception:
                pass

        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            logger.info(
                "generate_video | num_images=%s segments=%s duration=%s",
                len(images) if images else 0,
                len(segment_prompts),
                duration_seconds,
            )

            audio_note = (
                "Include natural ambient/sync audio." if generate_audio else "No audio."
            )
            image_parts: list[dict] = [
                {
                    "type": "image",
                    "data": base64.b64encode(img_bytes).decode(),
                    "mime_type": mime_type,
                }
                for img_bytes, mime_type in (images or [])
            ]

            interaction = None
            previous_interaction_id: str | None = None

            for index, segment_prompt in enumerate(segment_prompts):
                is_opening = index == 0

                # `aspect_ratio` is only accepted on the opening shot — an extension
                # inherits the framing of the footage it continues, and passing it again
                # is rejected. `store` is what makes the interaction chainable.
                response_format: dict = {
                    "type": "video",
                    "duration": f"{VIDEO_SEGMENT_SECONDS}s",
                }
                if is_opening:
                    response_format["aspect_ratio"] = aspect_ratio

                if is_opening:
                    full_prompt = f"{segment_prompt}\n\nVideo aspect ratio: {aspect_ratio}. {audio_note}"
                    segment_input = image_parts + [{"type": "text", "text": full_prompt}]
                else:
                    full_prompt = (
                        f"{segment_prompt}\n\nContinue seamlessly from the final frame of the "
                        f"footage so far, holding the same subject, wardrobe, setting, lighting, "
                        f"colour grade, camera language, and sound world. {audio_note}"
                    )
                    segment_input = [{"type": "text", "text": full_prompt}]

                create_kwargs: dict = {
                    "model": _OMNI_VIDEO_MODEL,
                    "input": segment_input,
                    "response_format": response_format,
                    "store": True,
                }
                if previous_interaction_id:
                    create_kwargs["previous_interaction_id"] = previous_interaction_id

                # Retrying happens HERE, per segment, not around the whole chain: every
                # segment is a separate ~$1 render, and `previous_interaction_id` still
                # points at the last segment that succeeded, so a retry resumes from the
                # failure instead of re-rendering (and re-paying for) the footage already
                # in the can.
                interaction = await self._create_video_segment(
                    client, create_kwargs, index, len(segment_prompts)
                )

                previous_interaction_id = interaction.id
                logger.info(
                    "generate_video | segment %d/%d done | %ds of %ds",
                    index + 1,
                    len(segment_prompts),
                    (index + 1) * VIDEO_SEGMENT_SECONDS,
                    duration_seconds,
                )

            # The last interaction carries the full cumulative clip, not just its own segment.
            video_content = interaction.output_video
            if video_content is None:
                raise LLMError("Gemini Omni returned no video content")

            if video_content.data:
                video_bytes = base64.b64decode(video_content.data)
            elif video_content.uri:
                # The Files-API URI needs API-key auth to download — a raw GET 401s.
                video_bytes = await client.aio.files.download(file=video_content.uri)
            else:
                raise LLMError("Gemini Omni video content has neither inline data nor a URI")

            logger.info("generate_video | done | bytes=%d", len(video_bytes))

            if generation:
                try:
                    generation.update(
                        output="[video generated]",
                        usage_details={
                            "input": 0,
                            # One billable render per 10s segment, not per request.
                            "output": len(segment_prompts),
                            "total": len(segment_prompts),
                            "unit": "VIDEOS",
                        },
                        metadata={
                            "latency_ms": int((time.perf_counter() - t0) * 1000),
                            "aspect_ratio": aspect_ratio,
                            "duration_seconds": duration_seconds,
                            "num_segments": len(segment_prompts),
                            "org_id": obs_ctx.org_id,
                            "agent": obs_ctx.agent_slug,
                        },
                    )
                    generation.end()
                except Exception:
                    pass

            return video_bytes

        except Exception as e:
            logger.exception("generate_video failed")

            if generation:
                try:
                    generation.update(level="ERROR", status_message=str(e))
                    generation.end()
                except Exception:
                    pass

            raise

    async def complete_with_vision(
        self,
        file_bytes: bytes,
        prompt: str,
        mime_type: str = "application/pdf",
    ) -> str:
        """Send a file (PDF or image) + text prompt to Gemini Flash vision.
        Handles text, tables (returns markdown), images, and scanned pages."""
        if settings.MOCK_MODE:
            return "[Mock vision extraction: all contract text, tables, and clauses extracted successfully]"

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        parts = [
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            types.Part.from_text(text=prompt),
        ]
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=parts,
        )
        return response.text

    async def complete_with_vision_multi(
        self,
        files: list[tuple[bytes, str]],
        prompt: str,
    ) -> str:
        """Same as complete_with_vision but grounds the response in multiple reference
        images/files at once (e.g. several product photos from different angles)."""
        if settings.MOCK_MODE:
            return "[Mock vision extraction: all contract text, tables, and clauses extracted successfully]"

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        parts = [types.Part.from_bytes(data=data, mime_type=mime) for data, mime in files]
        parts.append(types.Part.from_text(text=prompt))
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=parts,
        )
        return response.text

    def count_tokens(self, text: str, model: str = "gpt-4.1-mini") -> int:
        """Approximate token count."""
        try:
            import tiktoken
            enc = tiktoken.encoding_for_model(model)
            return len(enc.encode(text))
        except Exception:
            # Fallback: ~4 chars per token
            return len(text) // 4

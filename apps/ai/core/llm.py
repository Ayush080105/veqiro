import asyncio
import base64
import json as _json
from typing import AsyncGenerator
from core.config import settings
from core.exceptions import LLMError
from core.tools import (
    ToolDefinition, ToolCall, ToolResult, LLMToolResponse,
    tool_defs_to_openai, tool_defs_to_gemini,
    format_tool_result_messages,
)

# Provider + model constants
GEMINI_FLASH = ("gemini", "gemini-2.5-flash")
GPT4O_MINI = ("openai", "gpt-4o-mini")
EMBEDDING_MODEL = ("openai", "text-embedding-3-small")

def _aspect_to_size(aspect_ratio: str, model: str = "dall-e-3") -> str:
    """Map aspect ratio to the correct size string for the given model."""
    if "dall-e-3" in model:
        return {
            "1:1":  "1024x1024",
            "16:9": "1792x1024",
            "9:16": "1024x1792",
            "4:3":  "1792x1024",
        }.get(aspect_ratio, "1024x1024")
    return {
        "1:1":  "1024x1024",
        "16:9": "1536x1024",
        "9:16": "1024x1536",
        "4:3":  "1536x1024",
    }.get(aspect_ratio, "1024x1024")


def _detect_image_mime(data: bytes) -> str:
    """Detect image mime type from magic bytes. Defaults to image/jpeg."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return "image/jpeg"  # FF D8 FF or unknown


# A minimal 1x1 red PNG in base64
_RED_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
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

---
*DISCLAIMER: This is AI-generated information for educational purposes only. Consult a qualified attorney for specific legal advice.*
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

    async def _real_complete(self, provider, model, system, messages, temperature, max_tokens, response_format):
        retries = [1, 3, 9]
        last_exc = None
        for delay in [0] + retries:
            if delay:
                await asyncio.sleep(delay)
            try:
                if provider == "gemini":
                    return await self._gemini_complete(model, system, messages, temperature, max_tokens)
                elif provider == "openai":
                    return await self._openai_complete(model, system, messages, temperature, max_tokens, response_format)
                else:
                    raise LLMError(f"Unknown provider: {provider}")
            except Exception as e:
                last_exc = e
        raise LLMError(f"LLM call failed after retries: {last_exc}")

    async def _gemini_complete(self, model, system, messages, temperature, max_tokens):
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gm = genai.GenerativeModel(
            model,
            system_instruction=system,
            generation_config={"temperature": temperature, "max_output_tokens": max_tokens},
        )
        history = []
        for m in messages[:-1]:
            role = "user" if m["role"] == "user" else "model"
            history.append({"role": role, "parts": [m["content"]]})
        chat = gm.start_chat(history=history)
        last_msg = messages[-1]["content"] if messages else ""
        response = await asyncio.to_thread(chat.send_message, last_msg)
        return response.text

    async def _openai_complete(self, model, system, messages, temperature, max_tokens, response_format):
        import openai as _openai
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        oai_messages = [{"role": "system", "content": system}] + messages
        kwargs = {"model": model, "messages": oai_messages, "temperature": temperature, "max_tokens": max_tokens}
        if response_format:
            kwargs["response_format"] = response_format
        resp = await client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content

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
        retries = [1, 3, 9]
        last_exc = None
        for delay in [0] + retries:
            if delay:
                await asyncio.sleep(delay)
            try:
                if provider == "gemini":
                    async for token in self._gemini_stream(model, system, messages, temperature):
                        yield token
                    return
                elif provider == "openai":
                    async for token in self._openai_stream(model, system, messages, temperature):
                        yield token
                    return
                else:
                    raise LLMError(f"Unknown provider: {provider}")
            except Exception as e:
                last_exc = e
        raise LLMError(f"LLM stream failed after retries: {last_exc}")

    async def _gemini_stream(self, model, system, messages, temperature):
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        gm = genai.GenerativeModel(
            model,
            system_instruction=system,
            generation_config={"temperature": temperature},
        )
        last_msg = messages[-1]["content"] if messages else ""

        def _sync_stream():
            return gm.generate_content(last_msg, stream=True)

        response = await asyncio.to_thread(_sync_stream)
        for chunk in response:
            if chunk.text:
                yield chunk.text

    async def _openai_stream(self, model, system, messages, temperature):
        import openai as _openai
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        oai_messages = [{"role": "system", "content": system}] + messages
        async with client.chat.completions.stream(
            model=model, messages=oai_messages, temperature=temperature
        ) as stream:
            async for text in stream.text_stream:
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
    ) -> LLMToolResponse:
        """Complete with tool/function calling support. Returns text OR tool calls."""
        if settings.MOCK_MODE:
            return await self._mock_complete_with_tools(system, messages, tools)
        return await self._real_complete_with_tools(
            provider, model, system, messages, tools, temperature, max_tokens
        )

    async def _real_complete_with_tools(
        self, provider, model, system, messages, tools, temperature, max_tokens
    ) -> LLMToolResponse:
        retries = [1, 3, 9]
        last_exc = None
        for delay in [0] + retries:
            if delay:
                await asyncio.sleep(delay)
            try:
                if provider == "gemini":
                    return await self._gemini_complete_with_tools(
                        model, system, messages, tools, temperature, max_tokens
                    )
                elif provider == "openai":
                    return await self._openai_complete_with_tools(
                        model, system, messages, tools, temperature, max_tokens
                    )
                else:
                    raise LLMError(f"Unknown provider: {provider}")
            except Exception as e:
                last_exc = e
        raise LLMError(f"LLM tool call failed after retries: {last_exc}")

    async def _openai_complete_with_tools(
        self, model, system, messages, tools, temperature, max_tokens
    ) -> LLMToolResponse:
        import openai as _openai
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        oai_messages = [{"role": "system", "content": system}] + messages
        oai_tools = tool_defs_to_openai(tools)
        resp = await client.chat.completions.create(
            model=model,
            messages=oai_messages,
            tools=oai_tools,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        choice = resp.choices[0]
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
            )
        return LLMToolResponse(
            content=choice.message.content or "",
            tool_calls=[],
            finish_reason="stop",
        )

    async def _gemini_complete_with_tools(
        self, model, system, messages, tools, temperature, max_tokens
    ) -> LLMToolResponse:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        # Build Gemini tool declarations
        gem_declarations = tool_defs_to_gemini(tools)
        gem_tools = genai.types.Tool(function_declarations=gem_declarations)

        gm = genai.GenerativeModel(
            model,
            system_instruction=system,
            generation_config={"temperature": temperature, "max_output_tokens": max_tokens},
            tools=[gem_tools],
        )

        # Build history for Gemini
        history = []
        for m in messages[:-1]:
            role = "user" if m["role"] == "user" else "model"
            # Handle dict content (tool results) vs string content
            if isinstance(m.get("content"), str):
                history.append({"role": role, "parts": [m["content"]]})
            elif isinstance(m.get("content"), list):
                # Gemini function response parts
                parts = []
                for part in m["content"]:
                    if isinstance(part, str):
                        parts.append(part)
                    else:
                        parts.append(part)
                if parts:
                    history.append({"role": role, "parts": parts})

        chat = gm.start_chat(history=history)
        last_msg = messages[-1]["content"] if messages else ""

        if isinstance(last_msg, str):
            response = await asyncio.to_thread(chat.send_message, last_msg)
        else:
            response = await asyncio.to_thread(chat.send_message, last_msg)

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

    async def generate_image(self, prompt: str, aspect_ratio: str = "1:1") -> str:
        """Text-to-image via OpenAI. Model controlled by IMAGE_MODEL env var. Returns base64 PNG."""
        if settings.MOCK_MODE:
            await asyncio.sleep(0.05)
            return _RED_PNG_B64
        import openai as _openai
        model = settings.IMAGE_MODEL
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        kwargs: dict = dict(
            model=model,
            prompt=prompt,
            size=_aspect_to_size(aspect_ratio, model),
            n=1,
        )
        if model == "dall-e-3":
            kwargs["quality"] = "hd"
            kwargs["response_format"] = "b64_json"
        response = await client.images.generate(**kwargs)
        return response.data[0].b64_json

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

    async def generate_image_with_image_bytes(
        self, prompt: str, images: list[bytes], aspect_ratio: str = "1:1"
    ) -> str:
        """Image editing/generation with raw reference image bytes via gpt-image-2.
        Uses images.edit so the model incorporates the references into the output."""
        if settings.MOCK_MODE:
            await asyncio.sleep(0.05)
            return _RED_PNG_B64
        import io
        import openai as _openai
        client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        # Wrap each bytes blob as a named file-like object for the multipart upload
        def _to_file(data: bytes, idx: int) -> io.BytesIO:
            mime = _detect_image_mime(data)
            ext = "png" if "png" in mime else "jpg"
            buf = io.BytesIO(data)
            buf.name = f"ref_{idx}.{ext}"
            return buf

        ref_files = [_to_file(img, i) for i, img in enumerate(images)]

        model = settings.IMAGE_MODEL
        try:
            response = await client.images.edit(
                model=model,
                image=ref_files,
                prompt=prompt,
                size=_aspect_to_size(aspect_ratio, model),
                n=1,
            )
            return response.data[0].b64_json
        except Exception as e:
            import logging
            logging.getLogger("llm").warning("images.edit failed (%s) — falling back to images.generate", e)
            return await self.generate_image(prompt, aspect_ratio)

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

    def count_tokens(self, text: str, model: str = "gpt-4o-mini") -> int:
        """Approximate token count."""
        try:
            import tiktoken
            enc = tiktoken.encoding_for_model(model)
            return len(enc.encode(text))
        except Exception:
            # Fallback: ~4 chars per token
            return len(text) // 4

from openai import AsyncOpenAI, APIError, RateLimitError
import os
import json
import asyncio
import logging
from typing import List, Dict, Any

log = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# -----------------------------
# CRITIC PROMPT
# -----------------------------
CRITIC_SYSTEM = """
You are "Reality Critic AI" — a brutally honest, high-IQ thinking partner with zero tolerance for wishful thinking.

Your process (think internally before writing JSON):
1. Steelman the user's idea — find the strongest version of their argument.
2. Then destroy it — surface every logical flaw, unvalidated assumption, and hidden risk.
3. Contrast what the user *believes* is true with what evidence or first principles actually suggest.

Field instructions:
- "analysis": 2-4 sentences. Assess the idea critically — not encouragingly.
- "flaws": Specific logical errors, circular reasoning, or structural weaknesses in their thinking. Not generic critique.
- "assumptions": Things the user is treating as facts but has never validated. Each item should be falsifiable.
- "reality_check": The ground truth. What does the data, market, or logic actually say vs. what the user assumes?
- "follow_up_question": ONE question that forces the user to confront their single biggest blind spot. Make it uncomfortable.

Rules:
- Return ONLY valid JSON. No text outside the JSON block.
- Be direct. Diplomacy is not your job.

Format:
{
  "analysis": "...",
  "flaws": ["...", "..."],
  "assumptions": ["...", "..."],
  "reality_check": "...",
  "follow_up_question": "..."
}
"""


# -----------------------------
# MEMORY PROMPT
# -----------------------------
MEMORY_SYSTEM = """
You are a memory editor AI. Your job is to keep a running user context accurate and useful.

You will receive:
- CURRENT CONTEXT (the base truth)
- CHAT HISTORY
- LATEST USER MESSAGE
- LATEST AI RESPONSE

Instructions:
- DO NOT rewrite from scratch. Edit like a document — change only what needs changing.
- ADD new insights from the latest exchange.
- REMOVE stale or resolved items from "problems" — if the user has moved past an issue, drop it.
- MERGE lists without duplicates.
- Infer "behavior_patterns" from how the user communicates (e.g., avoids numbers, speaks in hypotheticals) — not just what they say.
- "recent_insights" should reflect the 2-3 most important learnings from this conversation turn, not a running log.

Return ONLY valid JSON:

{
  "user_profile": "...",
  "current_focus": "...",
  "goals": ["...", "..."],
  "problems": ["...", "..."],
  "behavior_patterns": ["...", "..."],
  "recent_insights": ["...", "..."]
}
"""


# -----------------------------
# HELPERS
# -----------------------------
async def call_llm(messages: List[Dict], json_mode: bool = True) -> str:
    kwargs = dict(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    for attempt in range(3):
        try:
            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except RateLimitError:
            if attempt == 2:
                raise
            await asyncio.sleep(2 ** attempt)
        except APIError:
            if attempt == 2:
                raise
            await asyncio.sleep(2 ** attempt)


def safe_parse(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        log.warning("LLM returned non-JSON output: %s", text[:200])
        return {"error": "Invalid JSON", "raw_output": text}


def format_chat(chat_history: List[Dict[str, str]]) -> str:
    return "\n".join([f"{m['role']}: {m['content']}" for m in chat_history])


def format_context(context: Dict[str, Any]) -> str:
    return json.dumps(context, indent=2)


# -----------------------------
# MERGE LOGIC
# -----------------------------
def merge_lists(old, new):
    old = old or []
    new = new or []
    return list(dict.fromkeys(old + new))


def merge_context(old_ctx, new_ctx):
    if "error" in new_ctx:
        log.warning("Memory update failed — keeping existing context")
        return old_ctx

    merged = old_ctx.copy()

    for key in new_ctx:
        if isinstance(new_ctx[key], list):
            merged[key] = merge_lists(old_ctx.get(key), new_ctx[key])
        else:
            merged[key] = new_ctx[key] or old_ctx.get(key)

    return merged


# -----------------------------
# FALLBACK RESPONSE
# -----------------------------
FALLBACK_RESPONSE = {
    "analysis": "Unable to generate analysis at this time.",
    "flaws": [],
    "assumptions": [],
    "reality_check": "Please try again.",
    "follow_up_question": "",
}


# -----------------------------
# MAIN PIPELINE
# -----------------------------
async def reality_pipeline(
    chat_history: List[Dict[str, str]],
    context: Dict[str, Any],
    question: str
):
    chat_text = format_chat(chat_history)
    context_text = format_context(context)

    # ------------------ CRITIC ------------------
    critic_messages = [
        {"role": "system", "content": CRITIC_SYSTEM},
        {
            "role": "user",
            "content": f"""Context:
{context_text}

Chat History:
{chat_text}

User:
{question}"""
        }
    ]

    log.info("Calling critic LLM")
    critic_raw = await call_llm(critic_messages)
    critic_output = safe_parse(critic_raw)

    if "error" in critic_output:
        log.warning("Critic LLM parse failed — using fallback")
        critic_output = FALLBACK_RESPONSE

    # ------------------ MEMORY ------------------
    memory_messages = [
        {"role": "system", "content": MEMORY_SYSTEM},
        {
            "role": "user",
            "content": f"""CURRENT CONTEXT:
{context_text}

CHAT HISTORY:
{chat_text}

LATEST USER MESSAGE:
{question}

LATEST AI RESPONSE:
{json.dumps(critic_output, indent=2)}

Update the context."""
        }
    ]

    log.info("Calling memory LLM")
    memory_raw = await call_llm(memory_messages)
    memory_output = safe_parse(memory_raw)

    updated_context = merge_context(context, memory_output)

    return {
        "response": critic_output,
        "updated_context": updated_context
    }

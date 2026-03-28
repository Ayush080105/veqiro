from openai import AsyncOpenAI
import os
import json
from typing import List, Dict, Any

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# -----------------------------
# CRITIC PROMPT
# -----------------------------
CRITIC_SYSTEM = """
You are "Reality Critic AI" — a brutally honest, high-IQ thinking partner.

Your job:
- Challenge the user's thinking
- Identify flaws and assumptions
- Push for clarity

IMPORTANT:
- Ask ONLY ONE powerful follow-up question
- Return ONLY valid JSON (no text outside JSON)

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
# MEMORY PROMPT (FIXED)
# -----------------------------
MEMORY_SYSTEM = """
You are a memory editor AI.

Your job is to UPDATE an existing user context.

You will receive:
- CURRENT CONTEXT (this is the base truth)
- CHAT HISTORY
- LATEST USER MESSAGE
- LATEST AI RESPONSE

Instructions:
- DO NOT rewrite from scratch
- MODIFY only where needed
- ADD new insights
- KEEP existing useful data
- MERGE lists (avoid duplicates)
- PRESERVE continuity

Think like editing a document.

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
async def call_llm(messages):
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content


def safe_parse(text: str):
    try:
        return json.loads(text)
    except Exception:
        return {"error": "Invalid JSON", "raw_output": text}


def format_chat(chat_history: List[Dict[str, str]]) -> str:
    return "\n".join([f"{m['role']}: {m['content']}" for m in chat_history])


def format_context(context: Dict[str, Any]) -> str:
    return json.dumps(context, indent=2)


# -----------------------------
# MERGE LOGIC (CRITICAL)
# -----------------------------
def merge_lists(old, new):
    old = old or []
    new = new or []
    return list(dict.fromkeys(old + new))


def merge_context(old_ctx, new_ctx):
    if "error" in new_ctx:
        return old_ctx

    merged = old_ctx.copy()

    for key in new_ctx:
        if isinstance(new_ctx[key], list):
            merged[key] = merge_lists(old_ctx.get(key), new_ctx[key])
        else:
            merged[key] = new_ctx[key] or old_ctx.get(key)

    return merged


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
            "content": f"""
Context:
{context_text}

Chat History:
{chat_text}

User:
{question}
"""
        }
    ]

    critic_raw = await call_llm(critic_messages)
    critic_output = safe_parse(critic_raw)

    # ------------------ MEMORY (FIXED) ------------------
    memory_messages = [
        {"role": "system", "content": MEMORY_SYSTEM},
        {
            "role": "user",
            "content": f"""
CURRENT CONTEXT:
{context_text}

CHAT HISTORY:
{chat_text}

LATEST USER MESSAGE:
{question}

LATEST AI RESPONSE:
{json.dumps(critic_output, indent=2)}

Update the context.
"""
        }
    ]

    memory_raw = await call_llm(memory_messages)
    memory_output = safe_parse(memory_raw)

    # ✅ FINAL MERGE (THIS FIXES YOUR ISSUE)
    updated_context = merge_context(context, memory_output)

    return {
        "response": critic_output,
        "updated_context": updated_context
    }
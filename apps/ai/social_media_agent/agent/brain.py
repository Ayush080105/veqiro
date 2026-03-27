"""
brain.py
--------
Updated for LangChain v1+ (uses LangGraph instead of deprecated AgentExecutor)
"""

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, AIMessage

from social_media_agent.agent.intent_detector import detect_intent
from social_media_agent.agent.brand_kit import load_brand_kit, brand_kit_to_context_string
from social_media_agent.agent.post_generator import generate_posts
from social_media_agent.agent.image_generator import generate_image
from social_media_agent.agent.chat_handler import general_chat

from typing import Optional, List
import json


# ── Agent system prompt ────────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPT = """You are an expert AI Social Media Manager Employee working for a brand.

You have access to three tools:
1. `generate_posts`
2. `generate_image`
3. `general_chat`

{brand_context}

IMPORTANT RULES:
- Always pass the full brand_context string to every tool call.
- If a user asks for posts AND an image in the same message, call both tools.
- Be decisive.
- Maintain brand voice.
"""


# ── Tools ─────────────────────────────────────────────────────────────────────

ALL_TOOLS = [generate_posts, generate_image, general_chat]


# ── Main agent runner ─────────────────────────────────────────────────────────

def run_social_media_agent(
    user_message: str,
    conversation_history: Optional[List[dict]] = None,
    brand_kit_override: Optional[dict] = None,
) -> dict:

    # ── 1. Load brand kit ─────────────────────────────────────────────────────
    brand_kit = load_brand_kit(override=brand_kit_override)
    brand_context = brand_kit_to_context_string(brand_kit)

    # ── 2. Detect intent ──────────────────────────────────────────────────────
    intent_result = detect_intent(user_message)

    # ── 3. Initialize LLM ─────────────────────────────────────────────────────
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.5,
    )

    # ── 4. Create LangGraph agent ─────────────────────────────────────────────
    agent = create_react_agent(
        model=llm,
        tools=ALL_TOOLS,
    )

    # ── 5. Build message history ──────────────────────────────────────────────
    messages = []

    if conversation_history:
        for turn in conversation_history:
            role = turn.get("role", "user")
            content = turn.get("content", "")

            if role == "user":
                messages.append({"role": "user", "content": content})
            elif role == "assistant":
                messages.append({"role": "assistant", "content": content})

    # ── 6. Add current message with intent hint + system prompt ───────────────
    intent_hint = _build_intent_hint(
        intent_result.intent,
        user_message,
        brand_context
    )

    messages.append({
        "role": "user",
        "content": f"{AGENT_SYSTEM_PROMPT.format(brand_context=brand_context)}\n\n{intent_hint}"
    })

    # ── 7. Run agent ──────────────────────────────────────────────────────────
    result = agent.invoke({
        "messages": messages
    })

    # ── 8. Extract response ───────────────────────────────────────────────────
    final_response = result["messages"][-1].content

    return {
        "intent": intent_result.intent,
        "intent_confidence": intent_result.confidence,
        "intent_reasoning": intent_result.reasoning,
        "response": final_response,
        "tool_outputs": []  # No intermediate steps in LangGraph
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_intent_hint(intent: str, user_message: str, brand_context: str) -> str:
    hints = {
        "post_ideas": f"[Route to: generate_posts]\nUser: {user_message}",
        "generate_image": f"[Route to: generate_image]\nUser: {user_message}",
        "general_chat": f"[Route to: general_chat]\nUser: {user_message}",
    }
    return hints.get(intent, user_message)


def _safe_parse_json(text: str):
    try:
        return json.loads(text)
    except Exception:
        return text
"""
brain.py
--------
The core LangChain agent (the "brain") for the Social Media Manager AI Employee.

Flow:
  1. Receive user message + brand kit (from payload or local file)
  2. Run intent detection (standalone LLM call — NOT a tool)
  3. Based on intent, invoke the appropriate LangChain tool:
     - post_ideas     → generate_posts tool
     - generate_image → generate_image tool
     - general_chat   → general_chat tool
  4. Return structured response

The agent is also wired with ALL tools so the LLM can call them autonomously
if intent detection routes to general_chat but the LLM decides it needs more.
"""

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from ai.social_media_agent.agent.intent_detector import detect_intent
from ai.social_media_agent.agent.brand_kit import load_brand_kit, brand_kit_to_context_string
from ai.social_media_agent.agent.post_generator import generate_posts
from ai.social_media_agent.agent.image_generator import generate_image
from ai.social_media_agent.agent.chat_handler import general_chat

from typing import Optional, List
import json


# ── Agent system prompt ────────────────────────────────────────────────────────

AGENT_SYSTEM_PROMPT = """You are an expert AI Social Media Manager Employee working for a brand.

You have access to three tools:
1. `generate_posts`  — use when the user wants post ideas, captions, or content suggestions
2. `generate_image`  — use when the user wants to generate or visualize an image
3. `general_chat`    — use for all other conversations, strategy, advice, and questions

{brand_context}

IMPORTANT RULES:
- Always pass the full brand_context string to every tool call — it ensures everything stays on-brand.
- If a user asks for posts AND an image in the same message, call both tools.
- Be decisive. Don't ask clarifying questions unless truly necessary.
- Respond in a conversational, helpful tone that matches the brand voice.
"""


# ── Tools registry ─────────────────────────────────────────────────────────────

ALL_TOOLS = [generate_posts, generate_image, general_chat]


# ── Intent → Tool routing map ──────────────────────────────────────────────────

INTENT_TO_TOOL_NAME = {
    "post_ideas": "generate_posts",
    "generate_image": "generate_image",
    "general_chat": "general_chat",
}


# ── Main agent runner ──────────────────────────────────────────────────────────

def run_social_media_agent(
    user_message: str,
    conversation_history: Optional[List[dict]] = None,
    brand_kit_override: Optional[dict] = None,
) -> dict:
    """
    Main entry point for the Social Media Manager agent.

    Args:
        user_message: The latest message from the user.
        conversation_history: List of {"role": "user"|"assistant", "content": "..."} dicts.
        brand_kit_override: If provided, use this brand kit instead of the local JSON file.

    Returns:
        dict with keys: intent, intent_confidence, intent_reasoning, response, raw_tool_output
    """

    # ── 1. Load brand kit ──────────────────────────────────────────────────────
    brand_kit = load_brand_kit(override=brand_kit_override)
    brand_context = brand_kit_to_context_string(brand_kit)

    # ── 2. Detect intent ───────────────────────────────────────────────────────
    intent_result = detect_intent(user_message)

    # ── 3. Build the LangChain agent ───────────────────────────────────────────
    llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

    prompt = ChatPromptTemplate.from_messages([
        ("system", AGENT_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_openai_tools_agent(llm, ALL_TOOLS, prompt)

    executor = AgentExecutor(
        agent=agent,
        tools=ALL_TOOLS,
        verbose=True,
        return_intermediate_steps=True,
        max_iterations=5,
    )

    # ── 4. Build chat history for context ─────────────────────────────────────
    chat_history = []
    if conversation_history:
        for turn in conversation_history:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role == "user":
                chat_history.append(HumanMessage(content=content))
            elif role == "assistant":
                chat_history.append(AIMessage(content=content))

    # ── 5. Craft input with intent hint to guide the agent ────────────────────
    intent_hint = _build_intent_hint(intent_result.intent, user_message, brand_context, conversation_history)

    # ── 6. Run agent ───────────────────────────────────────────────────────────
    result = executor.invoke({
        "input": intent_hint,
        "brand_context": brand_context,
        "chat_history": chat_history,
    })

    # ── 7. Parse tool outputs ──────────────────────────────────────────────────
    raw_tool_outputs = []
    if result.get("intermediate_steps"):
        for action, observation in result["intermediate_steps"]:
            raw_tool_outputs.append({
                "tool": action.tool,
                "tool_input": action.tool_input,
                "output": _safe_parse_json(observation),
            })

    return {
        "intent": intent_result.intent,
        "intent_confidence": intent_result.confidence,
        "intent_reasoning": intent_result.reasoning,
        "response": result.get("output", ""),
        "tool_outputs": raw_tool_outputs,
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_intent_hint(intent: str, user_message: str, brand_context: str, history: Optional[List[dict]]) -> str:
    """Wraps user message with a routing hint based on detected intent."""
    hints = {
        "post_ideas": f"[Route to: generate_posts] User wants post ideas. brand_context is available.\n\nUser: {user_message}",
        "generate_image": f"[Route to: generate_image] User wants an image generated. brand_context is available.\n\nUser: {user_message}",
        "general_chat": f"[Route to: general_chat] General conversation or advice needed. Include conversation_history if available.\n\nUser: {user_message}",
    }
    return hints.get(intent, user_message)


def _safe_parse_json(text: str):
    """Try to parse JSON string, return raw string if it fails."""
    try:
        return json.loads(text)
    except Exception:
        return text
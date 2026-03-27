"""
intent_detector.py
------------------
Detects the user's intent from their message using a direct LLM call.
Intents:
  - "post_ideas"     : user wants social media post ideas/suggestions
  - "generate_image" : user wants an image generated
  - "general_chat"   : general question, conversation, brand advice, etc.

This is a standalone LLM call — NOT a LangChain tool — so it runs BEFORE
the agent decides which tool to invoke. Think of it as a router.
"""

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
import json


INTENT_SYSTEM_PROMPT = """You are an intent classification engine for a social media AI assistant.

Given a user message, classify it into exactly one of these intents:
- "post_ideas"     : The user wants social media post ideas, content suggestions, caption ideas, post topics, or a content calendar.
- "generate_image" : The user wants to generate, create, or visualize an image, graphic, or visual content.
- "general_chat"   : Everything else — brand advice, questions, general conversation, feedback, strategy discussions.

Respond ONLY with a valid JSON object in this exact format:
{
  "intent": "<one of: post_ideas | generate_image | general_chat>",
  "confidence": <float between 0 and 1>,
  "reasoning": "<one short sentence explaining why>"
}

Do not output anything else. No markdown, no explanation outside the JSON.
"""


class IntentResult(BaseModel):
    intent: str
    confidence: float
    reasoning: str


def detect_intent(user_message: str, model_name: str = "gpt-4o-mini") -> IntentResult:
    """
    Runs a lightweight LLM call to classify the user's intent.
    Returns an IntentResult with intent, confidence, and reasoning.
    """
    llm = ChatOpenAI(model=model_name, temperature=0)

    messages = [
        SystemMessage(content=INTENT_SYSTEM_PROMPT),
        HumanMessage(content=user_message),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    # Strip markdown fences if model misbehaves
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    parsed = json.loads(raw)

    # Validate intent is one of the allowed values
    allowed_intents = {"post_ideas", "generate_image", "general_chat"}
    if parsed["intent"] not in allowed_intents:
        parsed["intent"] = "general_chat"

    return IntentResult(**parsed)
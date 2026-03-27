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


INTENT_SYSTEM_PROMPT = """You are a highly accurate intent classification engine for a social media AI assistant.

Your job is to classify the user's request into EXACTLY ONE intent:

- "post_ideas"
- "generate_image"
- "general_chat"

CORE PRINCIPLE:
Default to "generate_image" for most creative or social media requests.

---

DETAILED RULES:

1. GENERATE IMAGE (DEFAULT — MOST COMMON)
Use "generate_image" if the user is asking for:
- Instagram posts, ads, creatives, visuals, banners, thumbnails
- anything that will RESULT in a visual output
- promotional content (offers, launches, campaigns)
- phrases like:
  - "make a post"
  - "create an ad"
  - "design something"
  - "instagram post"
  - "promotion"
  - "offer post"

IMPORTANT:
Even if the user does NOT explicitly say "generate image",
if the request implies a visual → choose "generate_image"

Examples:
- "make an instagram post" → generate_image
- "create ad for coffee" → generate_image
- "design a promotional post" → generate_image

---

2. POST IDEAS (RARE — ONLY WHEN EXPLICIT)
Use "post_ideas" ONLY if the user is clearly asking for:
- ideas, suggestions, concepts, strategies

Examples:
- "give me post ideas"
- "suggest content ideas"
- "content calendar ideas"
- "what should I post?"

If the user asks to CREATE something → DO NOT use post_ideas

---

3. GENERAL CHAT
Use "general_chat" for:
- strategy, advice, feedback
- branding, marketing discussions
- questions, explanations, conversations

---

4. EDGE CASE HANDLING

- "make a post" → generate_image
- "instagram post" → generate_image
- "ad campaign visual" → generate_image
- "ideas for posts" → post_ideas
- If user intent is unclear but creative → generate_image
- If completely ambiguous → general_chat

---

IMPORTANT:
- Prioritize OUTPUT TYPE over wording
- If the result is likely visual → generate_image
- Be decisive

---

Respond ONLY with valid JSON:

{
  "intent": "<post_ideas | generate_image | general_chat>",
  "confidence": <float between 0 and 1>,
  "reasoning": "<one short sentence>"
}
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
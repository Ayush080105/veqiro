"""
chat_handler.py
---------------
LangChain tool: handles general conversation, brand strategy questions,
advice, and anything that doesn't fit post generation or image creation.
"""

from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from pydantic import BaseModel
from typing import Optional, List
import json


class ChatHandlerInput(BaseModel):
    user_message: str
    brand_context: str
    conversation_history: Optional[List[dict]] = None  # [{"role": "user"|"assistant", "content": "..."}]


CHAT_SYSTEM_TEMPLATE = """You are a dedicated AI Social Media Manager for the following brand.

{brand_context}

Your responsibilities:
- Answer brand strategy questions
- Give advice on content, timing, engagement, trends
- Help brainstorm campaigns, themes, or content directions
- Discuss analytics, audience growth, platform best practices
- Be the brand's expert voice — always aligned with the brand identity above

Personality: Match the brand's voice. Be helpful, concise, and insightful.
Never go off-brand. If asked about something unrelated to social media or the brand, gently redirect.
"""


@tool("general_chat", args_schema=ChatHandlerInput)
def general_chat(
    user_message: str,
    brand_context: str,
    conversation_history: Optional[List[dict]] = None,
) -> str:
    """
    Handles general conversation, brand strategy questions, and social media advice.
    Maintains conversation context through history. Returns a helpful, on-brand response.
    """
    llm = ChatOpenAI(model="gpt-4o", temperature=0.6)

    system_prompt = CHAT_SYSTEM_TEMPLATE.format(brand_context=brand_context)
    messages = [SystemMessage(content=system_prompt)]

    # Inject conversation history
    if conversation_history:
        for turn in conversation_history:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=user_message))

    response = llm.invoke(messages)

    return json.dumps({
        "response": response.content.strip(),
        "type": "general_chat",
    })
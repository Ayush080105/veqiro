from pydantic import BaseModel
from typing import Optional, List


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = []
    brand_kit: Optional[dict] = None


class ChatResponse(BaseModel):
    reply: str
    intent: str
    intent_confidence: float
    intent_reasoning: str
    tool_outputs: list
    brand_name: str
    generated_image: Optional[dict] = None
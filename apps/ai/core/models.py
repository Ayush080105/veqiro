from pydantic import BaseModel, ConfigDict


class Message(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    user_id: str
    conversation_id: str
    message: str
    history: list[Message] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "conversation_id": "conv_456",
                "message": "Help me create a LinkedIn post about our product launch",
                "history": [],
            }
        }
    )


class ChatSyncResponse(BaseModel):
    response: str
    agent: str
    message_id: str
    tokens_used: int
    model_used: str
    metadata: dict = {}
    image: "ImageResult | None" = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "response": "Here's a LinkedIn post for your product launch...",
                "agent": "maya",
                "message_id": "msg_abc123",
                "tokens_used": 420,
                "model_used": "gemini-1.5-flash",
                "metadata": {},
            }
        }
    )


class ImageResult(BaseModel):
    image_base64: str
    content_type: str = "image/png"
    prompt_used: str


class DataPoint(BaseModel):
    date: str
    value: float

    model_config = ConfigDict(
        json_schema_extra={"example": {"date": "2025-01-15", "value": 42500.0}}
    )


class RAGChunk(BaseModel):
    id: str = ""
    content: str
    source_type: str = ""
    source_agent: str = ""
    metadata: dict = {}
    score: float = 0.0

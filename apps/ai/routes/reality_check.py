from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from reality_check_agent.agent_tool import reality_pipeline

router = APIRouter()


# -------------------------
# Schemas
# -------------------------
class Message(BaseModel):
    role: str
    content: str


class CriticRequest(BaseModel):
    chat_history: List[Message]
    context: Dict[str, Any]
    question: str


# -------------------------
# Endpoint
# -------------------------
@router.post("/chat")
async def critic_chat(req: CriticRequest):
    try:
        result = await reality_pipeline(
            chat_history=[msg.dict() for msg in req.chat_history],  # ✅ convert to dict
            context=req.context,
            question=req.question
        )

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
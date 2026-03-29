# from fastapi import APIRouter, HTTPException
# from pydantic import BaseModel
# from typing import List, Dict, Any, Optional
# import uuid
# from reality_check_agent.agent_tool import reality_pipeline
# from reality_check_agent.context_store import get_context, save_context

# router = APIRouter()


# # -------------------------
# # Schemas
# # -------------------------
# class Message(BaseModel):
#     role: str
#     content: str


# class CriticRequest(BaseModel):
#     chat_history: List[Message]
#     context: Dict[str, Any] = {}
#     question: str
#     session_id: Optional[str] = None


# # -------------------------
# # Endpoint
# # -------------------------
# @router.post("/chat")
# async def critic_chat(req: CriticRequest):
#     try:
#         # Resolve session
#         session_id = req.session_id or str(uuid.uuid4())

#         # Load persisted context if session exists, otherwise use request context
#         if req.session_id:
#             context = get_context(session_id)
#         else:
#             context = req.context

#         result = await reality_pipeline(
#             chat_history=[msg.model_dump() for msg in req.chat_history],
#             context=context,
#             question=req.question,
#         )

#         # Persist updated context
#         save_context(session_id, result["updated_context"])

#         return {
#             "status": "success",
#             "session_id": session_id,
#             "data": result,
#         }

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

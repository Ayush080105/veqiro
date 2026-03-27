from fastapi import APIRouter, HTTPException
from schemas.chat import ChatRequest, ChatResponse

from social_media_agent.agent.brain import run_social_media_agent
from social_media_agent.agent.brand_kit import load_brand_kit
from social_media_agent.agent.image_generator import (
    get_last_generated_image,
    clear_last_generated_image,
)

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    clear_last_generated_image()

    history = [
        {"role": msg.role, "content": msg.content}
        for msg in (request.conversation_history or [])
    ]

    result = run_social_media_agent(
        user_message=request.message,
        conversation_history=history,
        brand_kit_override=request.brand_kit,
    )

    brand_kit = load_brand_kit(override=request.brand_kit)

    return ChatResponse(
        reply=result["response"],
        intent=result["intent"],
        intent_confidence=result["intent_confidence"],
        intent_reasoning=result["intent_reasoning"],
        tool_outputs=result["tool_outputs"],
        brand_name=brand_kit.get("company_name", "Unknown Brand"),
        generated_image=get_last_generated_image(),
    )
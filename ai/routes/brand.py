from fastapi import APIRouter, HTTPException
from social_media_agent.agent.brand_kit import (
    load_brand_kit,
    brand_kit_to_context_string,
)

router = APIRouter()


@router.get("/")
def get_brand_kit():
    try:
        brand_kit = load_brand_kit()
        context = brand_kit_to_context_string(brand_kit)
        return {"brand_kit": brand_kit, "context_preview": context}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="brand_kit.json not found.")


@router.post("/preview")
def preview_brand_kit(brand_kit: dict):
    context = brand_kit_to_context_string(brand_kit)
    return {"context_preview": context}
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from fastapi.concurrency import run_in_threadpool
from social_media_agent.agent.image_regen import ImageRegenTool

router = APIRouter()


# ---------------------------------------------------------
# REQUEST SCHEMA
# ---------------------------------------------------------
class ImageRegenRequest(BaseModel):
    image_url: str   # R2 blob URL
    prompt: str


# ---------------------------------------------------------
# FETCH FROM R2
# ---------------------------------------------------------
async def fetch_r2_image(url: str) -> bytes:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(url)

            if res.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail="Failed to fetch image from R2"
                )

            # Optional size check
            if len(res.content) > 10 * 1024 * 1024:
                raise HTTPException(
                    status_code=400,
                    detail="Image too large (max 10MB)"
                )

            return res.content

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching image: {str(e)}"
        )


# ---------------------------------------------------------
# ENDPOINT
# ---------------------------------------------------------
@router.post("/regenerate")
async def regenerate_image(req: ImageRegenRequest):

    try:
        # 1. Fetch image from R2
        image_bytes = await fetch_r2_image(req.image_url)

        # 2. Run tool (threadpool because it's blocking)
        result = await run_in_threadpool(
            ImageRegenTool.run,
            req.prompt,
            image_bytes
        )

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
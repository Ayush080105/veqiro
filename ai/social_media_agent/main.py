"""
main.py
-------
FastAPI application for the Social Media Manager AI Employee.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

load_dotenv()

from agent.brain import run_social_media_agent
from agent.brand_kit import load_brand_kit, brand_kit_to_context_string
from agent.image_generator import get_last_generated_image, clear_last_generated_image

app = FastAPI(
    title="Social Media Manager AI Employee",
    description="AI-powered social media manager with intent detection, post generation, and image creation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────────────────────

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
    generated_image: Optional[dict] = None  # { data, mime_type, prompt_used, aspect_ratio }


class BrandKitResponse(BaseModel):
    brand_kit: dict
    context_preview: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "employee": "Social Media Manager", "version": "1.0.0"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Clear any image from a previous request
    clear_last_generated_image()

    history = [
        {"role": msg.role, "content": msg.content}
        for msg in (request.conversation_history or [])
    ]

    try:
        result = run_social_media_agent(
            user_message=request.message,
            conversation_history=history,
            brand_kit_override=request.brand_kit,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    brand_kit = load_brand_kit(override=request.brand_kit)
    brand_name = brand_kit.get("company_name", "Unknown Brand")

    # Attach generated image if any (base64 stored in image_generator module)
    generated_image = get_last_generated_image() or None

    return ChatResponse(
        reply=result["response"],
        intent=result["intent"],
        intent_confidence=result["intent_confidence"],
        intent_reasoning=result["intent_reasoning"],
        tool_outputs=result["tool_outputs"],
        brand_name=brand_name,
        generated_image=generated_image,
    )


@app.get("/brand-kit", response_model=BrandKitResponse)
def get_brand_kit():
    try:
        brand_kit = load_brand_kit()
        context = brand_kit_to_context_string(brand_kit)
        return BrandKitResponse(brand_kit=brand_kit, context_preview=context)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="brand_kit.json not found.")


@app.post("/brand-kit/preview")
def preview_brand_kit(brand_kit: dict):
    context = brand_kit_to_context_string(brand_kit)
    return {"context_preview": context}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


@app.get("/last-image")
def get_last_image():
    """Returns the last generated image directly viewable in the browser."""
    from fastapi.responses import HTMLResponse

    img = get_last_generated_image()
    if not img or not img.get("data"):
        return HTMLResponse("<h3 style='font-family:sans-serif;padding:24px'>No image generated yet. Ask the agent to generate one first.</h3>")

    prompt = img.get("prompt_used", "")
    aspect = img.get("aspect_ratio", "")
    html = f"""
    <html>
    <body style="background:#111;color:#fff;font-family:sans-serif;padding:24px;text-align:center">
        <h2>Last Generated Image</h2>
        <p style="color:#aaa;max-width:700px;margin:0 auto 16px">Aspect ratio: {aspect}</p>
        <img src="data:image/png;base64,{img['data']}"
             style="max-width:800px;width:100%;border-radius:12px;box-shadow:0 4px 32px #0008"/>
        <p style="color:#888;max-width:700px;margin:16px auto;font-size:13px">
            <b>Prompt used:</b><br>{prompt}
        </p>
    </body>
    </html>
    """
    return HTMLResponse(html)
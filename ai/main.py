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

from ai.social_media_agent.agent.brain import run_social_media_agent
from ai.social_media_agent.agent.brand_kit import load_brand_kit, brand_kit_to_context_string
from ai.social_media_agent.agent.image_generator import get_last_generated_image, clear_last_generated_image

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






import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai.data_analyst_agent.agent import AnalystAgent
from ai.data_analyst_agent.tools.file_handler import save_upload
from ai.data_analyst_agent.tools.schema_extractor import extract_schema

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
log = logging.getLogger("ai-analyst")

# In-memory registry: dataset_id → absolute CSV path
DATASETS: dict[str, Path] = {}

agent = AnalystAgent()


# ── Request / Response Schemas ─────────────────────────────────────────────────
class QueryRequest(BaseModel):
    dataset_id: str
    query: str


class InsightsRequest(BaseModel):
    dataset_id: str


class UploadResponse(BaseModel):
    dataset_id: str
    columns: list[str]
    row_count: int


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """Accept a CSV or Excel file, persist it, and return dataset metadata."""
    dataset_id = str(uuid.uuid4())
    try:
        csv_path = await save_upload(file, dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    DATASETS[dataset_id] = csv_path
    schema = extract_schema(csv_path)
    log.info(
        "Uploaded dataset %s  (%d cols, %d rows)",
        dataset_id,
        len(schema["columns"]),
        schema["row_count"],
    )

    return UploadResponse(
        dataset_id=dataset_id,
        columns=schema["columns"],
        row_count=schema["row_count"],
    )


@app.post("/query")
async def query_dataset(req: QueryRequest):
    """Run a natural-language query against an uploaded dataset."""
    if req.dataset_id not in DATASETS:
        raise HTTPException(
            status_code=404, detail=f"Dataset '{req.dataset_id}' not found."
        )

    csv_path = DATASETS[req.dataset_id]
    log.info("Query on dataset %s: %r", req.dataset_id, req.query)

    try:
        result = await agent.run(csv_path=csv_path, query=req.query)
    except Exception as exc:
        log.exception("Agent error for dataset %s", req.dataset_id)
        raise HTTPException(status_code=500, detail=str(exc))

    return result


@app.post("/insights")
async def auto_insights(req: InsightsRequest):
    """Generate automatic insights for a dataset without a specific user query."""
    if req.dataset_id not in DATASETS:
        raise HTTPException(
            status_code=404, detail=f"Dataset '{req.dataset_id}' not found."
        )

    csv_path = DATASETS[req.dataset_id]
    log.info("Auto-insights on dataset %s", req.dataset_id)

    try:
        result = await agent.auto_insights(csv_path=csv_path)
    except Exception as exc:
        log.exception("Insights error for dataset %s", req.dataset_id)
        raise HTTPException(status_code=500, detail=str(exc))

    return result


@app.get("/datasets")
async def list_datasets():
    """List all currently loaded dataset IDs."""
    return {"datasets": list(DATASETS.keys())}


@app.get("/health")
async def health():
    return {"status": "ok"}
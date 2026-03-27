from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from schemas.chat import ChatRequest, ChatResponse

from social_media_agent.agent.brain import run_social_media_agent
from social_media_agent.agent.brand_kit import load_brand_kit, fetch_images

from social_media_agent.agent.image_generator import (
    get_last_generated_image,
    clear_last_generated_image,
)

from PIL import Image
import io

router = APIRouter()


# ---------------------------------------------------------
# 🔥 HELPER: MAKE LOGO SQUARE (ONLY FOR LOGO)
# ---------------------------------------------------------
def make_square(image_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

    max_dim = max(img.size)
    square = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))

    paste_x = (max_dim - img.width) // 2
    paste_y = (max_dim - img.height) // 2

    square.paste(img, (paste_x, paste_y))

    buffer = io.BytesIO()
    square.save(buffer, format="PNG")

    return buffer.getvalue()


# ---------------------------------------------------------
# MAIN CHAT ENDPOINT
# ---------------------------------------------------------
@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):

    # ---------------------------------------------------------
    # VALIDATION
    # ---------------------------------------------------------
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    clear_last_generated_image()

    # ---------------------------------------------------------
    # FORMAT HISTORY
    # ---------------------------------------------------------
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in (request.conversation_history or [])
    ]

    # ---------------------------------------------------------
    # LOAD BRAND KIT
    # ---------------------------------------------------------
    brand_kit = load_brand_kit(override=request.brand_kit or {})

    # ---------------------------------------------------------
    # 🔥 ROLE-BASED IMAGE EXTRACTION
    # ---------------------------------------------------------
    images_to_fetch = []
    selected_colors = []

    if brand_kit.get("use_brand_colors"):
        selected_colors = brand_kit.get("brand_colors", [])

    if brand_kit.get("use_mascot") and brand_kit.get("mascot_url"):
        images_to_fetch.append({
            "type": "mascot",
            "url": brand_kit["mascot_url"]
        })

    if brand_kit.get("use_logo") and brand_kit.get("logo_url"):
        images_to_fetch.append({
            "type": "logo",
            "url": brand_kit["logo_url"]
        })

    if brand_kit.get("use_reference_images") and brand_kit.get("reference_images"):
        for url in brand_kit["reference_images"]:
            images_to_fetch.append({
                "type": "reference",
                "url": url
            })

    brand_kit["brand_colors"] = selected_colors or []

    # ---------------------------------------------------------
    # 🔥 FETCH + PROCESS IMAGES
    # ---------------------------------------------------------
    try:
        brand_images = []

        if images_to_fetch:
            urls = [img["url"] for img in images_to_fetch]
            fetched_images = await fetch_images(urls)

            for meta, img_bytes in zip(images_to_fetch, fetched_images):
                img_type = meta["type"]

                # ✅ ONLY square the logo
                if img_type == "logo":
                    img_bytes = make_square(img_bytes)

                brand_images.append({
                    "type": img_type,
                    "data": img_bytes
                })

    except Exception as e:
        print("❌ Image fetch failed:", e)
        brand_images = []

    # ---------------------------------------------------------
    # 🔍 DEBUG LOGGING
    # ---------------------------------------------------------
    print("\n================ IMAGE DEBUG =================")
    for img in brand_images:
        print(f"{img['type']} → {len(img['data'])} bytes")
    print("Total:", len(brand_images))
    print("================================================\n")

    # ---------------------------------------------------------
    # RUN AGENT
    # ---------------------------------------------------------
    try:
        result = await run_social_media_agent(
            user_message=request.message,
            conversation_history=history,
            brand_kit_override=brand_kit,
            brand_images=brand_images,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    # ---------------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------------
    return ChatResponse(
        reply=result["response"],
        intent=result["intent"],
        intent_confidence=result["intent_confidence"],
        intent_reasoning=result["intent_reasoning"],
        tool_outputs=result["tool_outputs"],
        brand_name=brand_kit.get("company_name", "Unknown Brand"),
        generated_image=get_last_generated_image(),
    )


# ---------------------------------------------------------
# VIEW LAST IMAGE
# ---------------------------------------------------------
@router.get("/last-image")
def view_last_image():

    img = get_last_generated_image()

    if not img or not img.get("data"):
        return HTMLResponse(
            "<h3 style='font-family:sans-serif;padding:24px'>No image generated yet.</h3>"
        )

    prompt = img.get("prompt_used", "")
    aspect = img.get("aspect_ratio", "")

    html = f"""
    <html>
    <body style="background:#111;color:#fff;font-family:sans-serif;padding:24px;text-align:center">

        <h2>Latest Generated Image</h2>

        <p style="color:#aaa;">Aspect Ratio: {aspect}</p>

        <img 
            src="data:image/png;base64,{img['data']}" 
            style="max-width:800px;width:100%;border-radius:12px;box-shadow:0 4px 32px #0008"
        />

        <p style="color:#888;margin-top:20px;font-size:13px;max-width:700px;margin-left:auto;margin-right:auto;">
            <b>Prompt used:</b><br>{prompt}
        </p>

    </body>
    </html>
    """

    return HTMLResponse(content=html)
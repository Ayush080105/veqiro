from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
from typing import Optional, List, Dict

from google import genai
from google.genai import types

import os
import base64
import json
import logging


# ── Logging ────────────────────────────────────────────────
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ── In-memory store ────────────────────────────────────────
_last_generated_image: dict = {}


def get_last_generated_image() -> dict:
    return _last_generated_image.copy()


def clear_last_generated_image():
    _last_generated_image.clear()


# ── INPUT SCHEMA ───────────────────────────────────────────
class ImageGeneratorInput(BaseModel):
    user_request: str
    brand_context: str
    aspect_ratio: Optional[str] = "1:1"
    brand_images: Optional[List[Dict]] = None


# ── Prompt Builder ─────────────────────────────────────────
PROMPT_BUILDER_SYSTEM = """You are an expert AI image prompt engineer.

Create a HIGH-QUALITY image generation prompt.

RULES:
- Do NOT describe mascot or logo visually (they are provided as images)
- Focus on scene, action, composition, and mood
- Use brand colors strongly
- Keep it realistic and visually appealing

Return ONLY prompt text.
Max 120 words.
"""


def build_image_prompt(user_request: str, brand_context: str) -> str:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.6)

    messages = [
        SystemMessage(content=PROMPT_BUILDER_SYSTEM),
        HumanMessage(content=f"{brand_context}\n\nUser wants: {user_request}")
    ]

    return llm.invoke(messages).content.strip()


# ── MIME DETECTOR ──────────────────────────────────────────
def detect_mime(img: bytes) -> str:
    if img.startswith(b"\x89PNG"):
        return "image/png"
    elif img.startswith(b"\xff\xd8"):
        return "image/jpeg"
    return "image/jpeg"


# ── MAIN TOOL ──────────────────────────────────────────────
@tool("generate_image", args_schema=ImageGeneratorInput)
def generate_image(
    user_request: str,
    brand_context: str,
    aspect_ratio: str = "1:1",
    brand_images: Optional[List[Dict]] = None,
) -> str:
    """
    Generates a branded image using role-based images.
    """

    logger.info("🚀 Starting image generation...")
    logger.info(f"🔥 images received: {len(brand_images) if brand_images else 0}")

    # ── Build Prompt ───────────────────────────────────────
    image_prompt = build_image_prompt(user_request, brand_context)

    instruction = f"""
You are generating a premium branded marketing image.

STRICT RULES:

1. MASCOT (if provided):
- MUST be actively interacting with the scene
- NEVER standing idle or pasted
- Must engage with objects (holding cup, sitting, pouring coffee, etc.)
- Must follow lighting, perspective, and depth

2. LOGO (if provided):
- MUST be embedded naturally (NOT floating)
- Place on real surfaces like:
  - coffee cup
  - packaging
  - table engraving
  - wall signage
- Must follow lighting and perspective

3. REALISM:
- No sticker-like overlays
- All elements must blend naturally
- Consistent shadows, lighting, and depth

4. STYLE:
- Cinematic lighting
- High realism
- Clean composition
- Strong brand colors

---

{image_prompt}
"""

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return json.dumps({"error": "GOOGLE_API_KEY not set"})

    try:
        client = genai.Client(api_key=api_key)

        contents = [instruction]

        # ── ROLE-BASED MULTIMODAL INPUT ─────────────────────
        if brand_images:
            logger.info(f"🖼️ Processing {len(brand_images)} images")

            for img_obj in brand_images:
                img_type = img_obj.get("type")
                img_data = img_obj.get("data")

                if not img_data:
                    continue

                # 🔥 Stronger semantic binding
                if img_type == "mascot":
                    contents.append(
                        "This is the mascot character. It must be part of the scene and interacting naturally."
                    )

                elif img_type == "logo":
                    contents.append(
                        "This is the official brand logo. Integrate it into the environment realistically."
                    )

                elif img_type == "reference":
                    contents.append(
                        "This is a reference image for style and lighting."
                    )

                contents.append(
                    types.Part.from_bytes(
                        data=img_data,
                        mime_type=detect_mime(img_data)
                    )
                )

        else:
            logger.warning("⚠️ No brand images provided")

        # ── Generate ───────────────────────────────────────
        logger.info("🎨 Sending request to Gemini...")

        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=contents,
        )

        logger.info("🎨 Response received")

        # ── Extract Image ──────────────────────────────────
        image_bytes = None

        for candidate in getattr(response, "candidates", []):
            for part in candidate.content.parts:
                if getattr(part, "inline_data", None):
                    image_bytes = part.inline_data.data
                    break

        if not image_bytes:
            return json.dumps({"error": "No image returned"})

        logger.info("✅ Image generated successfully")

        # ── Store Result ───────────────────────────────────
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        _last_generated_image.update({
            "data": b64_image,
            "mime_type": "image/png",
            "prompt_used": instruction,
            "aspect_ratio": aspect_ratio
        })

        return json.dumps({
            "success": True,
            "image_ready": True,
            "aspect_ratio": aspect_ratio
        })

    except Exception as e:
        logger.exception("❌ Generation failed")
        return json.dumps({"error": str(e)})
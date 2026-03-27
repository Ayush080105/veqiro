import uuid
import base64
import logging
from typing import Dict, List
from io import BytesIO
import os
from PIL import Image
from google import genai
from dotenv import load_dotenv
load_dotenv()
import logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found")


# ---------------------------------------------------------
# INIT CLIENT
# ---------------------------------------------------------
client = genai.Client(api_key=GOOGLE_API_KEY)
MODEL_NAME = "imagen-4.0-generate-001"


# ---------------------------------------------------------
# SYSTEM PROMPT
# ---------------------------------------------------------
SYSTEM_PROMPT = """
You are a professional AI visual prompt engineer and image designer.

STRICT RULES:
- Preserve identity exactly
- Do NOT change face, age, gender
- Improve lighting, clarity, composition
- No text, watermark, logos
- Output ONE high-quality image
"""


# ---------------------------------------------------------
# TOOL
# ---------------------------------------------------------
class ImageRegenTool:

    @staticmethod
    def run(prompt: str, image_bytes: bytes) -> Dict:

        if not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        if not image_bytes:
            raise ValueError("Image is required")

        try:
            session_id = str(uuid.uuid4())

            pil_image = Image.open(BytesIO(image_bytes)).convert("RGBA")

            final_prompt = f"""
User Prompt:
"{prompt}"

Enhance with:
- Professional lighting
- Sharp focus
- Premium composition
- Balanced colors
"""

            logger.info(f"🎨 Using model: {MODEL_NAME}")

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=[SYSTEM_PROMPT + "\n\n" + final_prompt, pil_image],
            )

            variations: List[Dict] = []

            # 🔥 Robust extraction (new SDK safe)
            for candidate in getattr(response, "candidates", []):
                for part in candidate.content.parts:
                    if getattr(part, "inline_data", None):
                        data = part.inline_data.data
                        if data:
                            variations.append({
                                "base64": base64.b64encode(data).decode()
                            })

            if not variations:
                raise RuntimeError("No image returned from Gemini")

            return {
                "session_id": session_id,
                "model": MODEL_NAME,
                "prompt": prompt,
                "image_base64": variations[0]["base64"]  # ✅ return single image
            }

        except Exception as e:
            logger.exception("Image regeneration failed")
            raise RuntimeError(str(e))
"""
image_generator.py
------------------
LangChain tool: generates images using Google Gemini Imagen 4.
Builds a brand-aware prompt via GPT-4o-mini first, then calls Gemini.

IMPORTANT: Base64 image data is stored in module-level `_last_generated_image`
and never returned to the LLM agent — doing so would send 400k+ tokens back
into GPT-4o's context and blow the rate limit. The FastAPI layer reads
`get_last_generated_image()` and attaches it to the final API response.
"""

from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel
from typing import Optional
from google import genai
from google.genai import types
import os
import base64
import json


# ── In-memory image store (last generated image) ──────────────────────────────
_last_generated_image: dict = {}


def get_last_generated_image() -> dict:
    """Called by main.py to attach image data to the API response."""
    return _last_generated_image.copy()


def clear_last_generated_image():
    """Call before each new request to avoid stale images."""
    _last_generated_image.clear()


class ImageGeneratorInput(BaseModel):
    user_request: str
    brand_context: str
    aspect_ratio: Optional[str] = "1:1"


PROMPT_BUILDER_SYSTEM = """You are an AI image prompt engineer specializing in brand-consistent visuals.

Given a brand kit and a user's image request, write a detailed image generation prompt that:
1. Captures exactly what the user wants
2. Reflects the brand's visual identity, color palette, and image style
3. Includes lighting, mood, composition, and style descriptors
4. Is optimized for photorealistic or stylized AI image generation

Return ONLY the image prompt as plain text. No explanation, no markdown, just the prompt.
Keep it under 400 words.
"""


def build_image_prompt(user_request: str, brand_context: str) -> str:
    """Uses GPT-4o-mini to build a brand-aware image generation prompt."""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    messages = [
        SystemMessage(content=PROMPT_BUILDER_SYSTEM),
        HumanMessage(content=f"{brand_context}\n\nUser wants: {user_request}"),
    ]
    response = llm.invoke(messages)
    return response.content.strip()


@tool("generate_image", args_schema=ImageGeneratorInput)
def generate_image(
    user_request: str,
    brand_context: str,
    aspect_ratio: str = "1:1",
) -> str:
    """
    Generates a brand-consistent image using Google Gemini Imagen 4.
    Returns only metadata to the agent — base64 is stored separately.
    """
    image_prompt = build_image_prompt(user_request, brand_context)

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return json.dumps({"error": "GOOGLE_API_KEY not set", "prompt_used": image_prompt})

    try:
        client = genai.Client(api_key=api_key)

        result = client.models.generate_images(
            model="imagen-4.0-generate-001",
            prompt=image_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio=aspect_ratio,
                safety_filter_level="block_low_and_above",
                person_generation="allow_adult",
            ),
        )

        if not result.generated_images:
            return json.dumps({"error": "No images returned from Gemini", "prompt_used": image_prompt})

        # Store base64 at module level — never send to LLM
        image_bytes = result.generated_images[0].image.image_bytes
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        _last_generated_image["data"] = b64_image
        _last_generated_image["mime_type"] = "image/png"
        _last_generated_image["prompt_used"] = image_prompt
        _last_generated_image["aspect_ratio"] = aspect_ratio

        # Return only metadata to the agent
        return json.dumps({
            "success": True,
            "image_ready": True,
            "prompt_used": image_prompt,
            "aspect_ratio": aspect_ratio,
            "message": "Image generated successfully and is ready in the response.",
        })

    except Exception as e:
        return json.dumps({"error": str(e), "prompt_used": image_prompt})
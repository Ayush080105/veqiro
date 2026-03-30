import base64
import io

from core.models import ImageResult
from core.config import settings

# A minimal 1x1 placeholder PNG in base64
_PLACEHOLDER_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)


async def _fetch_asset(url: str) -> bytes | None:
    """Fetch image bytes from a URL (R2 or any CDN). Returns None on failure."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=settings.R2_FETCH_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception:
        return None


def _overlay_logo(base_b64: str, logo_bytes: bytes) -> str:
    """PIL-composite logo onto bottom-right of the base image. Returns new base64 PNG."""
    from PIL import Image
    base_img = Image.open(io.BytesIO(base64.b64decode(base_b64))).convert("RGBA")
    logo_img = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
    # Scale logo to 15% of base image width, preserve aspect ratio
    logo_w = max(int(base_img.width * 0.15), 1)
    logo_h = max(int(logo_img.height * (logo_w / logo_img.width)), 1)
    logo_img = logo_img.resize((logo_w, logo_h), Image.LANCZOS)
    # Place bottom-right with 20px padding
    x = base_img.width - logo_w - 20
    y = base_img.height - logo_h - 20
    base_img.paste(logo_img, (x, y), logo_img)
    buf = io.BytesIO()
    base_img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


async def generate_social_image(
    prompt: str,
    brand_kit,
    platform: str,
    aspect_ratio: str = "1:1",
    use_logo: bool = False,
    use_mascot: bool = False,
) -> ImageResult:
    """Generate a social media image.
    - use_mascot: fetches mascot from brand_kit.mascot_url and passes as reference to Gemini
    - use_logo: fetches logo from brand_kit.logo_url and PIL-overlays it bottom-right
    Mock mode returns a placeholder PNG regardless of flags.
    """
    from core.brand_kit import get_image_prompt_context
    context = get_image_prompt_context(brand_kit) if brand_kit else ""
    full_prompt = f"{context}. {prompt}. Optimized for {platform} ({aspect_ratio} format)." if context else f"{prompt}. Optimized for {platform}."

    if settings.MOCK_MODE:
        return ImageResult(
            image_base64=_PLACEHOLDER_B64,
            content_type="image/png",
            prompt_used=full_prompt,
        )

    from core.llm import LLMClient
    llm = LLMClient()

    # Fetch brand assets if requested
    mascot_bytes: bytes | None = None
    logo_bytes: bytes | None = None

    if use_mascot and brand_kit and brand_kit.mascot_url:
        mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
    if use_logo and brand_kit and brand_kit.logo_url:
        logo_bytes = await _fetch_asset(brand_kit.logo_url)

    # Build mascot-aware prompt
    if mascot_bytes:
        mascot_prompt = (
            f"{full_prompt} "
            "The mascot character shown in the reference image should appear naturally in the scene, "
            "actively engaged with the topic in a contextually appropriate way."
        )
        b64 = await llm.generate_image_with_reference(
            mascot_prompt,
            base64.b64encode(mascot_bytes).decode(),
            aspect_ratio=aspect_ratio,
        )
    else:
        b64 = await llm.generate_image(full_prompt, aspect_ratio=aspect_ratio)

    # Overlay logo (PIL composite — exact/deterministic placement)
    if logo_bytes and b64:
        b64 = _overlay_logo(b64, logo_bytes)

    return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

from core.models import ImageResult
from core.config import settings

# A minimal 1x1 placeholder PNG in base64
_PLACEHOLDER_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)


async def generate_social_image(
    prompt: str,
    brand_kit,
    platform: str,
    aspect_ratio: str = "1:1",
) -> ImageResult:
    """Generate an image for social media content.
    In mock mode returns a placeholder base64 PNG."""
    if settings.MOCK_MODE:
        context = ""
        if brand_kit:
            from core.brand_kit import get_image_prompt_context
            context = get_image_prompt_context(brand_kit)
        full_prompt = f"{context}. {prompt}. Optimized for {platform}." if context else prompt
        return ImageResult(
            image_base64=_PLACEHOLDER_B64,
            content_type="image/png",
            prompt_used=full_prompt,
        )

    from core.llm import LLMClient
    from core.brand_kit import get_image_prompt_context

    llm = LLMClient()
    context = get_image_prompt_context(brand_kit) if brand_kit else ""
    full_prompt = f"{context}. {prompt}. Optimized for {platform} ({aspect_ratio} format)."
    b64 = await llm.generate_image(full_prompt, aspect_ratio=aspect_ratio)
    return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

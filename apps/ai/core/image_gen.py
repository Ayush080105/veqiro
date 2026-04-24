import io
import base64
import logging

from core.models import ImageResult
from core.config import settings

logger = logging.getLogger("image_gen")

_PLACEHOLDER_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)

_PLATFORM_STYLE = {
    "linkedin": "clean corporate editorial, bold typography, professional lighting, 1200x628 landscape",
    "instagram": "vibrant lifestyle photography, high contrast, eye-catching composition, 1080x1080 square",
    "twitter":  "punchy bold graphic, minimal, strong focal point, 1600x900 landscape",
}

_ASPECT_FOR_PLATFORM = {
    "linkedin": "16:9",
    "instagram": "1:1",
    "twitter":  "16:9",
}


async def _fetch_asset(url: str) -> bytes | None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=settings.R2_FETCH_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception:
        return None


def _build_base_prompt(topic: str, platform: str, brand_kit, aspect_ratio: str, context_hints: str = "") -> str:
    style = _PLATFORM_STYLE.get(platform, "professional social media graphic")

    # Colors
    colors = ""
    if brand_kit and brand_kit.brand_colors:
        c = brand_kit.brand_colors
        colors = (
            f"Brand color palette — primary: {c.get('primary', '')}, "
            f"secondary: {c.get('secondary', '')}, accent: {c.get('accent', '')}. "
            f"These colors must dominate the entire design. "
        )

    # Fonts
    fonts = ""
    if brand_kit and brand_kit.brand_fonts:
        f_ = brand_kit.brand_fonts
        heading = f_.get("heading") or f_.get("primary") or f_.get("display")
        body = f_.get("body") or f_.get("secondary")
        if heading:
            fonts += f"Heading font: {heading}. "
        if body:
            fonts += f"Body font: {body}. "
        if fonts:
            fonts = f"Typography: {fonts}Use these fonts for all text in the image. "

    # Brand identity
    brand = ""
    if brand_kit:
        if brand_kit.company_name:
            brand += f"Brand: {brand_kit.company_name}. "
        if brand_kit.brand_voice:
            brand += f"Brand voice/visual tone: {brand_kit.brand_voice}. "
        if brand_kit.key_differentiators:
            brand += f"Brand tagline/differentiator (can use as visual sub-copy): \"{brand_kit.key_differentiators}\". "

    # Audience & industry
    context = ""
    if brand_kit:
        if brand_kit.industry:
            context += f"Industry: {brand_kit.industry}. "
        if brand_kit.target_audience:
            context += f"Audience: {brand_kit.target_audience}. "

    # Platform-specific tone from brand kit
    platform_tone = ""
    if brand_kit and brand_kit.platform_tones:
        tone = brand_kit.platform_tones.get(platform.lower())
        if tone:
            platform_tone = f"Brand's {platform} tone: {tone}. "

    context_section = f"Key messaging to reflect visually: {context_hints}. " if context_hints else ""

    return (
        f"Design a premium {platform} social media graphic ({aspect_ratio}). "
        f"Main topic: \"{topic}\". "
        f"{context_section}"
        f"{brand}"
        f"{colors}"
        f"{fonts}"
        f"{context}"
        f"{platform_tone}"
        f"Visual style: {style}. "
        f"TYPOGRAPHY: Include bold, well-designed text directly in the image. "
        f"Derive a SHORT punchy headline (3-6 words max) that captures the essence of the topic — do NOT copy the topic text verbatim. "
        f"Pull 1-2 key stats or power phrases from the context and display them as supporting text. "
        f"Text must be clean, modern, perfectly legible, and part of the design — not an afterthought. "
        f"COMPOSITION: Strong visual hierarchy, intentional layout, cohesive color story. "
        f"Output must look like it was designed by a top-tier social media creative director."
    )


async def generate_social_image(
    prompt: str,
    platform: str,
    aspect_ratio: str = "",
    use_logo: bool = False,
    use_mascot: bool = False,
    user_id: str = "",
    brand_kit=None,
    context_hints: str = "",
    reference_urls: list[str] | None = None,
) -> ImageResult:
    """Generate a premium social media image.

    Both mascot and logo are passed as raw image bytes directly to Gemini.
    Gemini is given explicit numbered reference instructions so it knows
    which asset is the mascot character and which is the logo, and how to
    use each naturally within the scene.
    """
    if not aspect_ratio:
        aspect_ratio = _ASPECT_FOR_PLATFORM.get(platform, "1:1")

    # ── Load brand kit (always) ───────────────────────────────────────────
    if brand_kit is None and user_id:
        from core.brand_kit import load_brand_kit
        brand_kit = await load_brand_kit(user_id)
        logger.info("brand_kit auto-loaded | user=%s company=%s", user_id, brand_kit.company_name)

    base_prompt = _build_base_prompt(prompt, platform, brand_kit, aspect_ratio, context_hints)

    logger.info(
        "image_gen start | user=%s platform=%s aspect=%s use_logo=%s use_mascot=%s brand=%s",
        user_id or "anon", platform, aspect_ratio, use_logo, use_mascot,
        brand_kit.company_name if brand_kit else "none",
    )

    if settings.MOCK_MODE:
        return ImageResult(image_base64=_PLACEHOLDER_B64, content_type="image/png", prompt_used=base_prompt)

    from core.llm import LLMClient
    llm = LLMClient()

    # ── Reference-image mode: theme/mood inspiration + brand kit ─────────
    has_references = bool(reference_urls)
    if has_references:
        import asyncio as _asyncio
        ref_bytes_list = await _asyncio.gather(*[_fetch_asset(url) for url in reference_urls])
        ref_images_ext = [b for b in ref_bytes_list if b]
        if not ref_images_ext:
            logger.warning("all reference fetches failed | user=%s urls=%s — falling through to brand kit mode", user_id, reference_urls)
        else:
            all_images: list[bytes] = list(ref_images_ext)
            extra_instructions: list[str] = []

            if use_mascot and brand_kit and brand_kit.mascot_url:
                mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
                if mascot_bytes:
                    all_images.append(mascot_bytes)
                    idx = len(all_images)
                    extra_instructions.append(
                        f"Reference image {idx} is a mascot character. "
                        f"Study the character's visual identity — shape, colors, face, style, proportions. "
                        f"Recreate this character in a COMPLETELY NEW scene. "
                        f"Place the character naturally in the scene, actively engaged with the topic, in a dynamic pose."
                    )
                    logger.info("mascot reference added (ref mode) | user=%s", user_id)

            if use_logo and brand_kit and brand_kit.logo_url:
                logo_bytes = await _fetch_asset(brand_kit.logo_url)
                if logo_bytes:
                    all_images.append(logo_bytes)
                    idx = len(all_images)
                    extra_instructions.append(
                        f"Reference image {idx} is the brand logo. "
                        f"Reproduce it with PIXEL-PERFECT fidelity — exact shapes, colors, proportions. "
                        f"Place it prominently on a billboard, screen, or signage. Large, sharp, blended into the scene."
                    )
                    logger.info("logo reference added (ref mode) | user=%s", user_id)

            theme_instructions = "\n".join(
                f"Reference image {i+1}: Study its overall theme, mood, and general visual direction. Use as loose inspiration only — do NOT copy layouts, text, or specific elements."
                for i in range(len(ref_images_ext))
            )
            full_prompt = (
                f"{base_prompt}\n\n"
                f"THEME INSPIRATION: The reference images are mood/theme guides — extract their general vibe, "
                f"dominant energy, and overall feel. Create a completely original design that reflects the same "
                f"mood while applying the brand kit above. Do NOT reproduce any elements from the references.\n\n"
                f"{theme_instructions}"
                + ("\n" + "\n".join(extra_instructions) if extra_instructions else "")
            )
            b64 = await llm.generate_image_with_image_bytes(full_prompt, all_images, aspect_ratio=aspect_ratio)
            logger.info("image_gen reference+brand done | user=%s refs=%d logo=%s mascot=%s", user_id, len(ref_images_ext), use_logo, use_mascot)
            return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

    ref_images: list[bytes] = []
    ref_instructions: list[str] = []

    if use_mascot and brand_kit and brand_kit.mascot_url:
        mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
        if mascot_bytes:
            ref_images.append(mascot_bytes)
            idx = len(ref_images)
            ref_instructions.append(
                f"Reference image {idx} is a mascot character. "
                f"Study the character's visual identity — shape, colors, face, style, proportions. "
                f"Recreate this character in a COMPLETELY NEW scene built from scratch. "
                f"Do NOT use any background or environment from the reference. "
                f"Place the character naturally in the scene, actively engaged with the topic, "
                f"in a dynamic pose that fits the composition."
            )
            logger.info("mascot reference added | user=%s url=%s", user_id, brand_kit.mascot_url)
        else:
            logger.warning("mascot fetch failed | user=%s url=%s", user_id, brand_kit.mascot_url)

    if use_logo and brand_kit and brand_kit.logo_url:
        logo_bytes = await _fetch_asset(brand_kit.logo_url)
        if logo_bytes:
            ref_images.append(logo_bytes)
            idx = len(ref_images)
            ref_instructions.append(
                f"Reference image {idx} is the brand logo. "
                f"CRITICAL: reproduce the logo with PIXEL-PERFECT fidelity — exact same shapes, "
                f"exact same colors, exact same proportions as the reference. Do NOT redraw it, "
                f"simplify it, reinterpret it, or change anything about it. "
                f"Place it prominently in the scene so it is immediately visible and occupies a "
                f"meaningful area of the composition — on a large billboard, filling a screen or monitor, "
                f"printed boldly on a product or packaging, or featured on signage. "
                f"It must feel like a natural, intentional part of the scene — large, sharp, and blended in, "
                f"not floating or pasted on top."
            )
            logger.info("logo reference added | user=%s url=%s", user_id, brand_kit.logo_url)
        else:
            logger.warning("logo fetch failed | user=%s url=%s", user_id, brand_kit.logo_url)

    if ref_images:
        logo_only = use_logo and not use_mascot and len(ref_images) == 1
        preamble = (
            "CRITICAL INSTRUCTION: Build a COMPLETELY NEW social media scene from scratch. "
            "Do NOT edit, modify, or use the reference image itself as the scene. "
            "The reference is ONLY the brand logo — extract it and place it into your newly created scene.\n\n"
            if logo_only else ""
        )
        full_prompt = base_prompt + "\n\n" + preamble + "\n".join(ref_instructions)
        b64 = await llm.generate_image_with_image_bytes(full_prompt, ref_images, aspect_ratio=aspect_ratio)
        logger.info("image generated with %d reference(s) logo_only=%s | user=%s", len(ref_images), logo_only, user_id)
    else:
        full_prompt = base_prompt
        b64 = await llm.generate_image(base_prompt, aspect_ratio=aspect_ratio)
        logger.info("image generated (no references) | user=%s", user_id)

    logger.info("image_gen done | user=%s platform=%s", user_id or "anon", platform)
    return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

import io
import base64
import colorsys
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

# Hue angle thresholds → color name (colorsys HSV hue is 0-1, multiply by 360 for degrees)
_HUE_STOPS: list[tuple[float, str]] = [
    (15,  "red"),
    (38,  "orange"),
    (65,  "yellow"),
    (150, "green"),
    (190, "teal"),
    (255, "blue"),
    (285, "violet"),
    (325, "magenta"),
    (360, "red"),
]


def _hex_to_color_name(hex_code: str) -> str:
    """Convert a CSS hex color code to a human-readable name for safe prompt injection."""
    if not hex_code:
        return ""
    h = hex_code.strip().lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    if len(h) != 6:
        return h  # unknown format — return without the # at minimum
    try:
        r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
        hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
        # Achromatic cases
        if val < 0.12:
            return "near-black"
        if val > 0.92 and sat < 0.08:
            return "near-white"
        if sat < 0.12:
            return "dark gray" if val < 0.5 else "light gray"
        # Map hue angle to name
        hue_deg = hue * 360
        name = "red"
        for threshold, color in _HUE_STOPS:
            if hue_deg <= threshold:
                name = color
                break
        # Lightness qualifier
        if val < 0.35:
            return f"deep {name}"
        if val > 0.82 and sat < 0.55:
            return f"light {name}"
        if sat > 0.75 and val > 0.6:
            return f"vivid {name}"
        return name
    except Exception:
        return h


async def _fetch_asset(url: str) -> bytes | None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=settings.R2_FETCH_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception:
        return None


def _build_base_prompt(topic: str, platform: str, brand_kit, aspect_ratio: str, context_hints: str = "", text_spec: dict | None = None) -> str:
    style = _PLATFORM_STYLE.get(platform, "professional social media graphic")

    # Colors — kept as hex for accuracy; framed as design values so the model never prints them as text
    colors = ""
    if brand_kit and brand_kit.brand_colors:
        c = brand_kit.brand_colors
        primary = c.get("primary", "")
        secondary = c.get("secondary", "")
        accent = c.get("accent", "")
        color_parts = []
        if primary:
            color_parts.append(f"primary {_hex_to_color_name(primary)} ({primary})")
        if secondary:
            color_parts.append(f"secondary {_hex_to_color_name(secondary)} ({secondary})")
        if accent:
            color_parts.append(f"accent {_hex_to_color_name(accent)} ({accent})")
        if color_parts:
            colors = (
                f"BRAND COLOR VALUES (apply to design only — NEVER print these codes as text): "
                f"{', '.join(color_parts)}. "
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

    # Brand identity — framed as visual atmosphere direction, never as text to render
    brand = ""
    if brand_kit:
        brand_parts = []
        if brand_kit.company_name:
            brand_parts.append(f"brand: {brand_kit.company_name}")
        if brand_kit.brand_voice:
            brand_parts.append(f"visual atmosphere/mood: {brand_kit.brand_voice}")
        if brand_kit.key_differentiators:
            brand_parts.append(f"brand personality: {brand_kit.key_differentiators}")
        if brand_parts:
            brand = (
                f"[BRAND ATMOSPHERE — use to inform visual mood, style, and feel ONLY — "
                f"do NOT copy, paraphrase, or render any of this as visible text in the image]: "
                f"{'; '.join(brand_parts)}. "
            )

    # Audience & industry — context only, not text
    context = ""
    if brand_kit:
        ctx_parts = []
        if brand_kit.industry:
            ctx_parts.append(f"industry: {brand_kit.industry}")
        if brand_kit.target_audience:
            ctx_parts.append(f"audience: {brand_kit.target_audience}")
        if ctx_parts:
            context = (
                f"[AUDIENCE CONTEXT — for visual direction only, do NOT render as text]: "
                f"{'; '.join(ctx_parts)}. "
            )

    # Platform-specific tone — design energy direction only
    platform_tone = ""
    if brand_kit and brand_kit.platform_tones:
        tone = brand_kit.platform_tones.get(platform.lower())
        if tone:
            platform_tone = (
                f"[PLATFORM ENERGY — inform composition energy and feel ONLY, do NOT render as text]: "
                f"{tone}. "
            )

    # context_hints is composition/narrative guidance only — never rendered as text
    composition_context = (
        f"[COMPOSITION CONTEXT — for visual direction only, do NOT render as text]: {context_hints}. "
        if context_hints else ""
    )

    # Pre-specified text to render exactly — prevents spelling mistakes and hallucinations
    exact_text_block = ""
    if text_spec:
        lines = []
        if text_spec.get("headline"):
            lines.append(f'• Headline: "{text_spec["headline"]}"')
        if text_spec.get("stat"):
            lines.append(f'• Stat: "{text_spec["stat"]}"')
        if text_spec.get("subtext"):
            lines.append(f'• Subtext: "{text_spec["subtext"]}"')
        if lines:
            exact_text_block = (
                "EXACT TEXT TO RENDER — copy these strings letter-for-letter, zero changes:\n"
                + "\n".join(lines)
                + "\nDO NOT paraphrase, abbreviate, or alter any word or character. "
                "Render the text exactly as written.\n"
            )

    # Typography instruction differs based on whether text is pre-specified
    if text_spec:
        typography = (
            "TYPOGRAPHY: Render ONLY the text from EXACT TEXT TO RENDER above — nothing else invented. "
            "Text must be bold, modern, perfectly legible, and integrated into the design as a core element. "
        )
    else:
        typography = (
            "TYPOGRAPHY: Include bold, well-designed text directly in the image. "
            "Derive a SHORT punchy headline (3-6 words max) from the TOPIC ONLY — do NOT copy the topic text verbatim and do NOT lift phrases from the brand atmosphere or audience context sections. "
            "You may add a very brief supporting line (5-8 words) relevant to the topic. "
            "Text must be clean, modern, perfectly legible, and part of the design — not an afterthought. "
        )

    # Guardrails — explicit list of what must never appear as visible text
    guardrails_extra = (
        "  ✗ Any text NOT from EXACT TEXT TO RENDER — do not invent or add any extra text\n"
        if text_spec else
        "  ✗ Internal instructions, prompt fragments, meta commentary, or analytical summaries\n"
    )
    guardrails = (
        "=== TEXT GUARDRAILS ===\n"
        "ABSOLUTELY NEVER render any of the following as visible text in the image:\n"
        "  ✗ Hex color codes like #6C3CE1, #FF5733, or rgb(108,60,225) — apply as color values only, never print them\n"
        "  ✗ Text inside square brackets: [COMPOSITION CONTEXT], [VISUAL DIRECTION ONLY], [BRAND ATMOSPHERE], [AUDIENCE CONTEXT], [PLATFORM ENERGY], [EXACT TEXT TO RENDER]\n"
        "  ✗ The words: prompt, system, instruction, context, composition, palette, brand colors, rgb\n"
        "  ✗ Slide numbers, bullet markers, list syntax, or numbered sequences\n"
        "  ✗ Any text from the composition context, brand atmosphere, audience context, or platform energy sections\n"
        "  ✗ Brand voice phrases, company differentiators, taglines, or audience descriptors — these inform visual style only, never appear as image text\n"
        + guardrails_extra
        + "=== END GUARDRAILS ==="
    )

    return (
        f"Design a premium {platform} social media graphic ({aspect_ratio}). "
        f"Main topic: \"{topic}\". "
        f"{composition_context}"
        f"{brand}"
        f"{colors}"
        f"{fonts}"
        f"{context}"
        f"{platform_tone}"
        f"Visual style: {style}. "
        f"{typography}"
        f"{exact_text_block}"
        f"COMPOSITION: Dynamic, bold, brand-driven. Use full-bleed brand colors, asymmetric layouts, "
        f"oversized typography, diagonal splits, or large geometric brand-color shapes. "
        f"FORBIDDEN: bordered card inside canvas, square frame inside square, centered text on plain gradient, "
        f"generic white panel on colored background — these look like stock templates. "
        f"Output must look like it was designed by a top-tier social media creative director. "
        f"{guardrails}"
    )


async def generate_social_image(
    prompt: str,
    platform: str,
    aspect_ratio: str = "",
    use_logo: bool = False,
    use_mascot: bool = False,
    user_id: str = "",
    organization_id: str = "",
    brand_kit=None,
    context_hints: str = "",
    text_spec: dict | None = None,
    reference_urls: list[str] | None = None,
    carousel_anchor_b64: str | None = None,
    campaign_mode: bool = False,
    brand_images: list | None = None,
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
    if brand_kit is None and organization_id:
        from core.brand_kit import load_brand_kit
        brand_kit = await load_brand_kit(organization_id)
        logger.info("brand_kit auto-loaded | org=%s company=%s", organization_id, brand_kit.company_name)

    base_prompt = _build_base_prompt(prompt, platform, brand_kit, aspect_ratio, context_hints, text_spec)

    logger.info(
        "image_gen start | user=%s platform=%s aspect=%s use_logo=%s use_mascot=%s brand=%s",
        user_id or "anon", platform, aspect_ratio, use_logo, use_mascot,
        brand_kit.company_name if brand_kit else "none",
    )

    if settings.MOCK_MODE:
        return ImageResult(image_base64=_PLACEHOLDER_B64, content_type="image/png", prompt_used=base_prompt)

    from core.llm import LLMClient
    llm = LLMClient()

    # ── Carousel continuity mode: slide 1 is the visual anchor ───────────
    if carousel_anchor_b64:
        import base64 as _base64
        from core.llm import _resize_for_reference
        raw_anchor = _base64.b64decode(carousel_anchor_b64)
        # Downscale to 512 px — enough for style matching, avoids API input size errors
        anchor_images: list[bytes] = [_resize_for_reference(raw_anchor, max_side=512)]
        anchor_instructions = [
            "Reference image 1 is slide 1 of this carousel. "
            "CRITICAL — match its EXACT design template: same background color and texture, "
            "same color palette, same layout grid and margins, same typography weight and style, "
            "same decorative motif and its position, same logo/brand placement (corner, size). "
            "Only the headline text and visual illustration change per slide. "
            "The set of carousel images MUST look like they came from a single design template."
        ]
        if use_mascot and brand_kit and brand_kit.mascot_url:
            mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
            if mascot_bytes:
                anchor_images.append(mascot_bytes)
                anchor_instructions.append(
                    f"Reference image {len(anchor_images)} is the brand mascot. "
                    f"Place it in the same position and size as it appears in slide 1."
                )
        if use_logo and brand_kit and brand_kit.logo_url:
            logo_bytes = await _fetch_asset(brand_kit.logo_url)
            if logo_bytes:
                anchor_images.append(logo_bytes)
                anchor_instructions.append(
                    f"Reference image {len(anchor_images)} is the brand logo. "
                    f"Place it in the exact same position, size, and styling as in slide 1."
                )
        full_prompt = base_prompt + "\n\n" + "\n".join(anchor_instructions)
        b64 = await llm.generate_image_with_image_bytes(full_prompt, anchor_images, aspect_ratio=aspect_ratio)
        logger.info("image_gen carousel-anchor done | user=%s slide", user_id or "anon")
        return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

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

            if campaign_mode:
                # ── Campaign mode: subject identity reference, NOT pose/composition copy ──
                product_instructions = "\n".join(
                    f"Reference image {i+1} shows the campaign subject (character, product, or mascot). "
                    f"Use it to understand WHAT they look like — their visual identity, appearance, style, and colours. "
                    f"Then REINTERPRET them in a completely original scene that matches the composition role specified. "
                    f"The reference tells you WHO they are, NOT how to pose them. "
                    f"Every photo in this campaign must show the subject from a DIFFERENT angle, in a DIFFERENT pose, "
                    f"in a DIFFERENT scene or environment. Do NOT copy the reference image's pose, framing, or background."
                    for i in range(len(ref_images_ext))
                )

                if use_mascot and brand_kit and brand_kit.mascot_url:
                    mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
                    if mascot_bytes:
                        all_images.append(mascot_bytes)
                        idx = len(all_images)
                        extra_instructions.append(
                            f"Reference image {idx} is a brand mascot character. "
                            f"Include ONLY as a small, tasteful supporting element — e.g. peeking from a corner, "
                            f"appearing small in the background, or as a subtle accent. "
                            f"The PRODUCT from the first reference images remains the undeniable hero. "
                            f"DO NOT make the mascot the primary or equal subject."
                        )
                        logger.info("mascot reference added (campaign mode) | user=%s", user_id)

                if use_logo and brand_kit and brand_kit.logo_url:
                    logo_bytes = await _fetch_asset(brand_kit.logo_url)
                    if logo_bytes:
                        all_images.append(logo_bytes)
                        idx = len(all_images)
                        extra_instructions.append(
                            f"Reference image {idx} is the brand logo. "
                            f"Reproduce it with PIXEL-PERFECT fidelity — exact shapes, exact colors, exact proportions, every detail. "
                            f"Do NOT simplify, redraw, or reinterpret it. "
                            f"Place it as a clean, sharp corner overlay (top-right or bottom-right), "
                            f"occupying roughly 8-12% of the image width. Must not compete with the product hero."
                        )
                        logger.info("logo reference added (campaign mode) | user=%s", user_id)

                full_prompt = (
                    f"{base_prompt}\n\n"
                    f"PRODUCT CAMPAIGN PHOTOGRAPH: The uploaded product is the absolute hero of this image. "
                    f"Every compositional decision — lighting, angle, background, props — exists to showcase the product. "
                    f"This is a professional product campaign shot, not a brand awareness graphic.\n\n"
                    f"{product_instructions}"
                    + ("\n" + "\n".join(extra_instructions) if extra_instructions else "")
                )
            else:
                # ── Standard mode: reference images are mood/theme inspiration ──
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
                            f"Reproduce it with PIXEL-PERFECT fidelity — exact shapes, exact colors, exact proportions, every detail. "
                            f"Do NOT simplify, redraw, or reinterpret it. "
                            f"Place it as a clean, sharp corner overlay (top-right or bottom-right), "
                            f"occupying roughly 8-12% of the image width. Crisp and exact."
                        )
                        logger.info("logo reference added (ref mode) | user=%s", user_id)

                if brand_images:
                    import asyncio as _asyncio
                    bi_urls = [bi.url if hasattr(bi, "url") else bi["url"] for bi in brand_images]
                    bi_prompts = [bi.prompt if hasattr(bi, "prompt") else bi.get("prompt") for bi in brand_images]
                    bi_bytes_list = await _asyncio.gather(*[_fetch_asset(url) for url in bi_urls])
                    for bi_bytes, bi_prompt, bi_url in zip(bi_bytes_list, bi_prompts, bi_urls):
                        if bi_bytes:
                            all_images.append(bi_bytes)
                            idx = len(all_images)
                            if bi_prompt:
                                extra_instructions.append(f"Reference image {idx}: {bi_prompt}")
                            else:
                                extra_instructions.append(
                                    f"Reference image {idx} is a brand asset. "
                                    f"Study its subjects, characters, objects, or visual elements. "
                                    f"Recreate them within the newly generated scene in a pose, angle, or context "
                                    f"that fits the composition naturally — do NOT copy the reference background or layout. "
                                    f"Ensure the key subjects remain clearly present and recognizable."
                                )
                            logger.info("brand_image added (ref mode) | user=%s idx=%d", user_id, idx)
                        else:
                            logger.warning("brand_image fetch failed (ref mode) | user=%s url=%s", user_id, bi_url)

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
            logger.info("image_gen reference+brand done | user=%s refs=%d logo=%s mascot=%s campaign=%s", user_id, len(ref_images_ext), use_logo, use_mascot, campaign_mode)
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
                f"Reproduce it with PIXEL-PERFECT fidelity — exact shapes, exact colors, exact proportions, every detail. "
                f"Do NOT simplify, redraw, reinterpret, or approximate it. "
                f"Place it as a clean, sharp overlay in one corner of the image (top-right or bottom-right preferred), "
                f"occupying roughly 8-12% of the image width. It must look crisp and exactly like the reference."
            )
            logger.info("logo reference added | user=%s url=%s", user_id, brand_kit.logo_url)
        else:
            logger.warning("logo fetch failed | user=%s url=%s", user_id, brand_kit.logo_url)

    # ── Persistent brand images: user-selected assets with optional instructions ──
    if brand_images:
        import asyncio as _asyncio
        bi_urls = [bi.url if hasattr(bi, "url") else bi["url"] for bi in brand_images]
        bi_prompts = [bi.prompt if hasattr(bi, "prompt") else bi.get("prompt") for bi in brand_images]
        bi_bytes_list = await _asyncio.gather(*[_fetch_asset(url) for url in bi_urls])
        for bi_bytes, bi_prompt, bi_url in zip(bi_bytes_list, bi_prompts, bi_urls):
            if bi_bytes:
                ref_images.append(bi_bytes)
                idx = len(ref_images)
                if bi_prompt:
                    ref_instructions.append(f"Reference image {idx}: {bi_prompt}")
                else:
                    ref_instructions.append(
                        f"Reference image {idx} is a brand asset. "
                        f"Study its subjects, characters, objects, or visual elements. "
                        f"Recreate them within the newly generated scene in a pose, angle, or context "
                        f"that fits the composition naturally — do NOT copy the reference background or layout. "
                        f"Ensure the key subjects remain clearly present and recognizable."
                    )
                logger.info("brand_image added | user=%s idx=%d has_prompt=%s", user_id, idx, bool(bi_prompt))
            else:
                logger.warning("brand_image fetch failed | user=%s url=%s", user_id, bi_url)

    if ref_images:
        logo_only = use_logo and not use_mascot and len(ref_images) == 1
        preamble = (
            "CRITICAL INSTRUCTION: Build a COMPLETELY NEW social media scene from scratch. "
            "Do NOT use the reference image as the scene background. "
            "The reference is the brand logo — reproduce it with PIXEL-PERFECT fidelity (exact shapes, colors, proportions) "
            "and place it as a clean, sharp corner overlay in the newly created scene. "
            "Do NOT simplify, redraw, or reinterpret the logo design.\n\n"
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

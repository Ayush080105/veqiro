import logging

from core.brand_kit import BrandKit, get_platform_tone
from core.llm import LLMClient, GEMINI_FLASH
from core.models import VideoResult

logger = logging.getLogger("video_gen")


_TEXT_ACCURACY_GUARDRAIL = (
    "TEXT ACCURACY — NON-NEGOTIABLE: Any text that appears anywhere in the video — on the "
    "product, on the brand logo, in on-screen captions, or on any label, sign, or package — "
    "must be spelled correctly and rendered legibly, with every character matching its "
    "source exactly. No garbled, duplicated, invented, or misspelled characters. A single "
    "spelling or typography error is a failure. If a piece of text cannot be rendered "
    "clearly and correctly, keep it soft-focus or out of frame rather than guessing at it."
)

_PRODUCT_FIDELITY_GUARDRAIL = (
    "PRODUCT FIDELITY — NON-NEGOTIABLE: Reproduce the product from the reference image(s) "
    "EXACTLY as shown in every shot. Do not alter its shape, proportions, colors, materials, "
    "finish, or design details. Do not add, remove, resize, or reposition any part of it. "
    "The product must look like the same physical object in every frame, not a redesigned "
    "or reimagined version of it."
)

_SCENE_PLAN_SYSTEM = f"""\
You are a professional short-form video director planning shots for an AI video generator.
Output ONLY a timestamped shot list — no preamble, no markdown fences, no commentary.

Format: one line per shot, e.g. "0-2s: <what happens, camera move, framing>".

Rules:
- Shots must sum EXACTLY to the target duration — no gaps, no overrun.
- Structure: one opening establishing beat, one or two development beats, and a clear
  closing beat that deliberately resolves the action (a settle, a hold, a button moment).
  The video must never end mid-action or feel like it was cut off abruptly — it must play
  like a complete, self-contained ad with a beginning, middle, and end.
- Each shot description must be concrete and filmable: camera position/move, subject
  action, framing. No abstract language.
- Keep continuity — the subject, setting, and style stay consistent across shots unless
  the concept explicitly calls for a scene change.

{_TEXT_ACCURACY_GUARDRAIL}
"""

_SCENE_PLAN_SYSTEM_WITH_IMAGE = _SCENE_PLAN_SYSTEM + f"""
You are given one or more reference images of the actual product/subject, optionally from
different angles. Ground every shot in exactly what you see — do not invent or guess at
details the images don't clearly show.

{_PRODUCT_FIDELITY_GUARDRAIL}
"""

# Mirrors the wording used for logo compositing in image generation (core/image_gen.py) —
# same "mandatory, faithful reproduction, corner placement" pattern, adapted for video.
_LOGO_INSTRUCTION = (
    "MANDATORY: The LAST reference image provided is the brand logo. You MUST include it "
    "in the video — its absence is a failure. Reproduce it with EXACT accuracy: identical "
    "shape, colors, and proportions — do not simplify, redraw, or reinterpret it. If the logo "
    "contains any text, reproduce every character exactly as shown; a misspelled or altered "
    "logo is a failure, not a stylistic variation. Composite it as a subtle corner watermark "
    "(bottom-right preferred), visible clearly for at least the final 1-2 seconds, occupying "
    "roughly 8-12% of the frame width. It must never obscure or compete with the main subject."
)


def build_video_prompt(
    prompt: str,
    platform: str,
    brand_kit: BrandKit | None = None,
) -> str:
    """Enrich a raw user prompt with brand voice/tone context for text-to-video generation."""
    tone = get_platform_tone(brand_kit, platform) if brand_kit else None
    parts = [
        "Cinematic short-form social video, smooth camera motion, professional lighting.",
        f"Scene: {prompt}",
    ]
    if tone:
        parts.append(f"Tone and mood: {tone}.")
    if brand_kit and brand_kit.brand_voice:
        parts.append(f"Brand voice: {brand_kit.brand_voice}.")
    return " ".join(parts)


def add_logo_instruction(prompt: str) -> str:
    """Append the mandatory logo-compositing instruction to a video prompt. Call this
    only when a logo image is being appended as the LAST entry in the images list."""
    return f"{prompt}\n\n{_LOGO_INSTRUCTION}"


def add_product_fidelity_guardrail(prompt: str) -> str:
    """Append the mandatory product-fidelity instruction to a video prompt. Call this
    whenever real product reference images are included in the images list."""
    return f"{prompt}\n\n{_PRODUCT_FIDELITY_GUARDRAIL}"


async def plan_video_scenes(
    llm: LLMClient,
    concept: str,
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> str:
    """Break a video concept into a timed shot list so the generated video fills the
    full target duration with a deliberate ending instead of cutting off abruptly."""
    prompt = (
        f"Video concept: {concept}\n"
        f"Target duration: exactly {duration_seconds} seconds.\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    shot_list = await llm.complete(
        *GEMINI_FLASH,
        system=_SCENE_PLAN_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=500,
    )
    return (
        f"{concept}\n\n"
        f"Shot-by-shot timeline (follow exactly, total runtime {duration_seconds}s):\n"
        f"{shot_list.strip()}"
    )


async def plan_video_scenes_with_images(
    llm: LLMClient,
    concept: str,
    images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> str:
    """Same as plan_video_scenes, but grounds the shot list in one or more reference
    images (e.g. product photos from different angles) so shots describe the real
    subject, not a guessed one. Do not pass the brand logo here — this is for the
    product/subject references only; logo compositing is handled separately."""
    prompt = (
        f"Video concept: {concept}\n"
        f"Target duration: exactly {duration_seconds} seconds.\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    full_prompt = f"{_SCENE_PLAN_SYSTEM_WITH_IMAGE}\n\n{prompt}"
    if len(images) == 1:
        shot_list = await llm.complete_with_vision(
            file_bytes=images[0][0],
            prompt=full_prompt,
            mime_type=images[0][1],
        )
    else:
        shot_list = await llm.complete_with_vision_multi(files=images, prompt=full_prompt)
    return (
        f"{concept}\n\n"
        f"Shot-by-shot timeline (follow exactly, total runtime {duration_seconds}s):\n"
        f"{shot_list.strip()}"
    )


async def generate_maya_video(
    llm: LLMClient,
    prompt: str,
    images: list[tuple[bytes, str]] | None = None,
    aspect_ratio: str = "16:9",
    duration_seconds: int = 8,
) -> VideoResult:
    """Call Gemini Omni and wrap the result as a VideoResult (base64-encoded, ready for the API response)."""
    import base64

    # Applied directly to the final generation prompt (not just the planning-stage system
    # prompt) so the model that actually renders the video sees the hard constraint too.
    final_prompt = f"{prompt}\n\n{_TEXT_ACCURACY_GUARDRAIL}"

    video_bytes = await llm.generate_video(
        prompt=final_prompt,
        images=images,
        aspect_ratio=aspect_ratio,
        duration_seconds=duration_seconds,
    )
    return VideoResult(
        video_base64=base64.b64encode(video_bytes).decode(),
        content_type="video/mp4",
        prompt_used=prompt,
    )

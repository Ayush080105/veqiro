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
You are an award-winning commercial director and cinematographer writing a single
continuous action description for a world-class, premium AI-generated video advertisement.
Output ONLY that description — no preamble, no markdown, no headings, no shot numbers, and
NEVER any timestamps or time ranges (do not write things like "0-2s:", "first half", "at
the 3 second mark", etc.).

Write it as one flowing, richly specific passage of natural language — the way a skilled
director would narrate a continuous take to a cinematographer. Use concrete, vivid
production vocabulary throughout: specific camera work, specific lighting, specific
texture/material detail, and specific color and mood. Always choose the most vivid,
concrete word available — never vague or generic language.

Choose the visual style, lighting, mood, and pacing that genuinely fit THIS product/
category and brief — do not default to one fixed "luxury/glamour" look for everything.
For example: a pharmaceutical or health product calls for clinical precision, trustworthy
scientific visualization, and calm reassurance, not perfume-ad glamour or opulent jewelry
lighting. A fragrance or luxury good calls for glamour and opulence. A tech product calls
for clean, minimal, futuristic precision. A food product calls for warm, appetizing,
tactile detail. Infer the right register from the concept below and commit to it fully —
never let one generic "premium cinematic" template override what the concept actually
calls for.

Where the concept describes a specific problem, benefit, or process (e.g. a health
condition, a use case, an emotional pain point), invent one clear visual metaphor that
dramatizes exactly that — grounded in what the concept literally asks for, not a generic
substitute (e.g. if the concept is about a digestive or internal process, show that
process and the product visibly resolving it — do not fall back to a generic "product
floating in a clean studio" shot instead). Ground the metaphor in plausible physical
imagery; never depict impossible effects or make exaggerated, false, or misleading claims
about what the product/service actually does — symbolize the benefit, don't overstate it.

Always build toward a clear reveal of the product/subject, in whatever register fits its
category and mood, ending on a sharp, well-composed final shot. If reference images are
provided, every detail of the real subject's appearance, packaging, logo, typography,
color, and proportions — drawn from ALL of the images provided, not just one — must be
reproduced with total fidelity, never redesigned, simplified, or altered.

DIALOGUE & ON-SCREEN SPEECH: Only include spoken dialogue or on-screen speech if the
concept genuinely calls for it — never invent a line just to have one. When you do include
one, keep it to a single short, natural line — a handful of words, not a full sentence — so
it can be spoken completely and land before the video ends, with clear time left on either
side for the visual setup and the closing/reveal beat. Natural speech runs roughly 2-3
words per second, so a 4-6 second video only has room for a very short phrase (about 3-6
words); even at 8-10 seconds, keep it to one short sentence at most — never a full
paragraph or multiple exchanges. Fold the line into the flowing narrative exactly as a
director would describe it being delivered in the moment (e.g. "...she exhales and says,
'Relief, finally.'") — never introduce it as a separate timed cue (no "at 3 seconds she
says..." phrasing).

Rules:
- The video must feel like a complete, self-contained piece with a clear beginning, a
  middle development, and a deliberate closing beat that resolves the action (a settle, a
  hold, a button moment, dialogue reaching its final line). It must never end mid-action,
  mid-sentence, or feel cut off, no matter how short the target duration is.
- Any dialogue or on-screen speech must be short enough to finish completely and
  naturally within the runtime — never trail off, get cut short, or leave a line
  unfinished.
- Keep continuity — the subject, setting, and style stay consistent throughout unless the
  concept explicitly calls for a scene change.
- End your description with one final line starting with "Style:" listing comma-separated
  production/technical descriptors that match THIS concept's actual category and mood (not
  a fixed luxury template) — e.g. clinical and trustworthy medical visualization for a
  health product, or hyper-realistic glamour lighting for a fragrance — plus any fidelity
  constraints that apply (e.g. preserve every logo, color, texture, and design element
  exactly as provided, across all reference images; no misleading or exaggerated claims).

{_TEXT_ACCURACY_GUARDRAIL}
"""

_SCENE_PLAN_SYSTEM_WITH_IMAGE = _SCENE_PLAN_SYSTEM + f"""
You are given one or more reference images of the actual product/subject, optionally from
different angles. Ground every part of the narrative in exactly what you see — across ALL
of the images provided, not just the first one — and do not invent or guess at details
none of the images clearly show.

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
        "Professional short-form commercial video. Camera work, lighting, and mood should "
        "match the product category and concept described below — not a fixed template.",
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
    """Turn a video concept into one continuous natural-language narrative (no
    timestamps or shot labels) so the generated video fills the full target duration
    with a deliberate ending instead of cutting off abruptly."""
    prompt = (
        f"Video concept: {concept}\n"
        f"This video will run for exactly {duration_seconds} seconds — write a narrative "
        f"that naturally fills that time and reaches a satisfying, resolved conclusion by "
        f"the end. Do not mention seconds, timestamps, or any timing markers anywhere in "
        f"your description.\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    narrative = await llm.complete(
        *GEMINI_FLASH,
        system=_SCENE_PLAN_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=1000,
    )
    return f"{concept}\n\n{narrative.strip()}"


async def plan_video_scenes_with_images(
    llm: LLMClient,
    concept: str,
    images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> str:
    """Same as plan_video_scenes, but grounds the narrative in one or more reference
    images (e.g. product photos from different angles) so the description matches the
    real subject, not a guessed one. Do not pass the brand logo here — this is for the
    product/subject references only; logo compositing is handled separately."""
    prompt = (
        f"Video concept: {concept}\n"
        f"This video will run for exactly {duration_seconds} seconds — write a narrative "
        f"that naturally fills that time and reaches a satisfying, resolved conclusion by "
        f"the end. Do not mention seconds, timestamps, or any timing markers anywhere in "
        f"your description.\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    full_prompt = f"{_SCENE_PLAN_SYSTEM_WITH_IMAGE}\n\n{prompt}"
    if len(images) == 1:
        narrative = await llm.complete_with_vision(
            file_bytes=images[0][0],
            prompt=full_prompt,
            mime_type=images[0][1],
        )
    else:
        narrative = await llm.complete_with_vision_multi(files=images, prompt=full_prompt)
    return f"{concept}\n\n{narrative.strip()}"


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

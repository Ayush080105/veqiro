"""Maya video generation: storyboard sheets, the render call, and logo animation.

Planning lives in core/video_director.py (brief -> structured shot plan) and prompt assembly
in core/video_prompt_compiler.py (plan -> one prompt per 10-second segment). This module keeps
what sits around them: the optional storyboard collage, the thin wrapper that hands compiled
prompts to Gemini Omni, and the hardcoded logo-animation styles.
"""

import asyncio
import base64
import logging
import math

from core.image_gen import product_identity_instructions
from core.llm import GEMINI_FLASH, LLMClient, VIDEO_SEGMENT_SECONDS
from core.logo_animation_styles import LOGO_STYLE_DATA
from core.models import VideoResult
from core.video_director import segments_for
from core.video_prompt_compiler import audio_block

logger = logging.getLogger("video_gen")

# Beats per storyboard sheet — one 3x3 collage is generated per 10-second segment, so a
# 40s video is planned as four sheets of nine beats rather than nine beats stretched thin.
BEATS_PER_SEGMENT = 9

_STORYBOARD_PRODUCT_FIDELITY = (
    "PRODUCT FIDELITY: where the product appears, reproduce it exactly as the reference images "
    "show it — shape, proportions, colours, materials, finish, logo and printed text. Never "
    "redesign or reimagine it."
)

_STORYBOARD_ARC_SINGLE = """\
Beat 1 (hook): an opening that earns attention — an intriguing detail, an establishing shot of the
setting, or the anticipation just before the moment (a hand reaching in, a plate being set down,
an ingredient in motion). Beats 2-3 (build/context): the world around the product comes alive —
the setting, the person, the desire or problem the product answers, each beat advancing the story.
Beats 4-5 (escalation/process): the process, service, or interaction that builds toward the
payoff — a chef finishing a plate, a server presenting it, someone reaching for it, the product
being prepared or revealed step by step. Beat 6 (hero/product moment): the product's defining
moment, usually the instant a person engages with it directly — taking a bite, pouring, applying,
unboxing — shown with total clarity. Beats 7-8 (payoff/reaction): the emotional payoff unfolding —
a satisfied reaction, a genuine smile, a close-up of pure enjoyment, the result of using the
product visible in the person or the scene. Beat 9 (closing/CTA): a calm, resolved final frame —
a clean settled hero shot of the product (with logo/packaging clearly readable if provided), the
scene at rest — the frame the video will hold on as it ends, never mid-action."""


def _storyboard_arc(total_beats: int, num_segments: int) -> str:
    """The beat-by-beat arc spec. One segment keeps the proven nine-beat wording; longer
    videos get the same shape stretched proportionally over 9 beats per segment, with the
    resolution held back to the very last beat."""
    if num_segments == 1:
        return _STORYBOARD_ARC_SINGLE

    hook_end = max(1, round(total_beats * 0.08))
    build_end = round(total_beats * 0.33)
    escalate_end = round(total_beats * 0.62)
    hero_end = round(total_beats * 0.72)
    payoff_end = total_beats - 1
    return (
        f"Spread ONE advertisement's arc across all {total_beats} beats — this is a single "
        f"{total_beats * VIDEO_SEGMENT_SECONDS // BEATS_PER_SEGMENT}-second commercial, not "
        f"{num_segments} short ones stitched together.\n\n"
        f"Beat 1 to {hook_end} (hook): an opening that earns attention — an intriguing detail, an "
        f"establishing shot of the setting, or the anticipation just before the moment (a hand "
        f"reaching in, a plate being set down, an ingredient in motion).\n"
        f"Beats {hook_end + 1}-{build_end} (build/context): the world around the product comes "
        f"alive — the setting, the person, the desire or problem the product answers, each beat "
        f"advancing the story.\n"
        f"Beats {build_end + 1}-{escalate_end} (escalation/process): the process, service, or "
        f"interaction that builds toward the payoff — a chef finishing a plate, a server "
        f"presenting it, someone reaching for it, the product prepared or revealed step by step.\n"
        f"Beats {escalate_end + 1}-{hero_end} (hero/product moment): the product's defining "
        f"moment, usually the instant a person engages with it directly — taking a bite, pouring, "
        f"applying, unboxing — shown with total clarity.\n"
        f"Beats {hero_end + 1}-{payoff_end} (payoff/reaction): the emotional payoff unfolding — a "
        f"satisfied reaction, a genuine smile, a close-up of pure enjoyment, the result of using "
        f"the product visible in the person or the scene.\n"
        f"Beat {total_beats} (closing/CTA): a calm, resolved final frame — a clean settled hero "
        f"shot of the product (with logo/packaging clearly readable if provided), the scene at "
        f"rest — the frame the video will hold on as it ends, never mid-action.\n\n"
        f"The beats are rendered in groups of {BEATS_PER_SEGMENT}: beats 1-{BEATS_PER_SEGMENT} "
        f"are the first {VIDEO_SEGMENT_SECONDS}-second shot, the next {BEATS_PER_SEGMENT} are the "
        f"second, and so on. So every {BEATS_PER_SEGMENT}th beat hands off to the next shot: it "
        f"must sit mid-development, with the action still unfolding, never on a resolved or "
        f"settled-looking frame. Beat {total_beats} is the ONLY resolved frame in the whole "
        f"storyboard."
    )


def _continuity_block_instruction(num_segments: int) -> str:
    """Multi-sheet storyboards are drawn as independent images (feeding a rendered sheet back
    in as a reference makes the image model refuse outright), so the cast has to be pinned in
    words that every sheet prompt repeats verbatim."""
    if num_segments == 1:
        return ""
    return (
        'Before the beats, output ONE extra block: a line starting with "CONTINUITY:" that '
        "fixes what must not change from sheet to sheet — the recurring person (approximate "
        "age, hair colour and length, skin tone, build), their wardrobe, the location, the "
        "time of day, and the colour grade. Write it so two different artists reading only "
        "that line would draw the same person. Separate it from the first beat with the same "
        "three-dash line.\n\n"
    )


def _build_storyboard_system(total_beats: int, num_segments: int) -> str:
    return f"""\
You are an award-winning commercial director breaking a short video concept into a {total_beats}-beat
storyboard for a real advertisement — the kind that runs on TV or social, not a set of product
photography variations. A storyboard where every panel is just another angle on the same static
plate/bottle/box is a FAILURE, no matter how well-lit. Real ads sell a feeling: they put a person
in the frame — reaching for the product, preparing it, tasting it, reacting to it — because
audiences connect with a moment, not a still life.

{_storyboard_arc(total_beats, num_segments)}

For food, drink, hospitality, beauty, or any product meant to be used on or by a person, several
beats — especially the hero and payoff beats — MUST show a real person genuinely interacting with it (eating,
drinking, holding, applying, wearing) in a believable setting (e.g. a restaurant table, a kitchen,
a bathroom counter) — do not default to nine variations of the product sitting alone on a surface.
Only skip the human moments if the category genuinely doesn't call for them (e.g. an industrial
part, enterprise software). If a person appears in more than one beat, keep them the same person
across those beats for narrative continuity.

Each beat is one still frame a storyboard artist could draw — describe it as a single vivid,
concrete visual: framing/camera angle, who or what is in frame and what they're doing, the
setting, and mood/lighting. Describe a frozen moment, not a shot with camera movement or duration.
Keep each beat's paragraph SHORT — 1-2 tight sentences — since there are {total_beats} of them.
Vary the framing and setting meaningfully across the {total_beats} beats — do not repeat the same
composition, angle, or crop with only minor changes.

Match the register the concept actually calls for (clinical precision for a health product, warm
tactile detail for food, glamour for fragrance/luxury, clean futurism for tech, etc.) — never
default to one fixed "premium cinematic" look for everything.

If reference images of the real product are provided, the product itself must be reproduced
exactly as shown in them — same shape, color, materials, proportions, logo, and packaging — in
every beat where it appears. Never redesign or reimagine the product. This fidelity requirement is
about the product only — it does not mean every beat must be a repeat product shot; people, hands,
settings, and framing should still change beat to beat to tell a real story.

{_continuity_block_instruction(num_segments)}Output EXACTLY {total_beats} beats. Write each beat as one paragraph. Separate the {total_beats}
paragraphs with a line containing only three dashes (---) and nothing else. Do not number the
beats, and do not add headings, labels, or any text other than the {total_beats} beat paragraphs
and the dash separators.

{_STORYBOARD_PRODUCT_FIDELITY}
"""


async def plan_storyboard_beats(
    llm: LLMClient,
    concept: str,
    images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
) -> tuple[str, list[str]]:
    """Break a campaign video concept into storyboard beats (hook, build, escalation,
    hero/product moment, payoff, closing/CTA), grounded in the product reference images so
    the storyboard image and the later video narrative both depict the same real product.

    Returns (continuity, beats). `continuity` is a cast/wardrobe/location lock repeated into
    every sheet prompt so independently drawn sheets show the same person; it is empty for
    single-sheet storyboards, which have nothing to stay consistent with.

    Returns 9 beats per 10-second segment, flat and in story order — 9 for a 10s video, 36
    for a 40s one."""
    num_segments = segments_for(duration_seconds)
    total_beats = BEATS_PER_SEGMENT * num_segments
    system = _build_storyboard_system(total_beats, num_segments)
    prompt = (
        f"Video concept: {concept}\n"
        f"This video will run for exactly {duration_seconds} seconds, flowing through these "
        f"{total_beats} beats in order — pace each beat's content accordingly, with the final "
        f"beat as a held, resolved closing frame.\n"
        f"Aspect ratio: {aspect_ratio}. Platform: {platform}."
    )
    full_prompt = f"{system}\n\n{prompt}"
    if images:
        if len(images) == 1:
            raw = await llm.complete_with_vision(file_bytes=images[0][0], prompt=full_prompt, mime_type=images[0][1])
        else:
            raw = await llm.complete_with_vision_multi(files=images, prompt=full_prompt)
    else:
        raw = await llm.complete(
            *GEMINI_FLASH,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200 * total_beats,
        )

    beats = [b.strip() for b in raw.split("---") if b.strip()]
    if len(beats) not in (total_beats, total_beats + 1):
        beats = [b.strip() for b in raw.split("\n\n") if b.strip()]
    if not beats:
        beats = [raw.strip()]

    # The optional leading CONTINUITY block pins the cast across independently drawn sheets.
    continuity = ""
    if beats and beats[0].upper().startswith("CONTINUITY:"):
        continuity = beats.pop(0).split(":", 1)[1].strip()

    if len(beats) < total_beats:
        logger.warning(
            "storyboard beats came back short | got=%d want=%d", len(beats), total_beats
        )
        beats = beats + [beats[-1]] * (total_beats - len(beats))
    return continuity, beats[:total_beats]


def _build_storyboard_image_prompt(
    beats: list[str],
    concept: str,
    num_product_images: int,
    video_aspect_ratio: str,
    sheet_index: int = 0,
    sheet_count: int = 1,
    previous_sheet_last_beat: str | None = None,
    continuity: str = "",
) -> str:
    rows = math.ceil(len(beats) / 3)
    row_labels = (
        ["top", "middle", "bottom"] if rows == 3
        else ["top", "bottom"] if rows == 2
        else [f"row {i + 1}" for i in range(rows)]
    )
    panel_labels = [
        f"{row_labels[i // 3]}-{['left', 'center', 'right'][i % 3]}" for i in range(len(beats))
    ]
    panel_lines = "\n".join(
        f"Panel {i + 1} ({panel_labels[i]}): {beat}" for i, beat in enumerate(beats)
    )
    sheet_note = ""
    if sheet_count > 1:
        first = sheet_index * BEATS_PER_SEGMENT + 1
        last = first + len(beats) - 1
        sheet_note = (
            f"\n\nThis is sheet {sheet_index + 1} of {sheet_count} for one continuous "
            f"commercial — it covers beats {first}-{last} of "
            f"{BEATS_PER_SEGMENT * sheet_count}, the "
            f"{'opening' if sheet_index == 0 else 'closing' if sheet_index == sheet_count - 1 else 'middle'}"
            f" stretch. Draw only these 9 beats, but treat the styling as part of the whole "
            f"film: identical product, characters, wardrobe, location, lighting, and colour "
            f"grade as the rest of the commercial."
        )
        # Continuity is carried as TEXT, never by feeding a rendered sheet back in: the
        # image model returns IMAGE_OTHER (no image at all) when a 9-panel storyboard collage
        # is supplied as a reference, so sheets are drawn independently from the shared
        # concept, the product photos, and the handoff beat below.
        if continuity:
            sheet_note += (
                f" CAST AND SETTING LOCK — identical on every sheet of this commercial, follow "
                f"it exactly: {continuity}"
            )
        if previous_sheet_last_beat:
            sheet_note += (
                f" The previous sheet ended on this beat: \"{previous_sheet_last_beat}\" — open "
                f"this sheet from that exact moment, same person, wardrobe, location, and light, "
                f"so the two sheets read as one continuous film."
            )
    n = len(beats)
    return (
        "Generate ONE single image only: a square storyboard collage on a plain neutral "
        f"background, divided into EXACTLY {n} equal panels — {rows} rows of 3 columns — by thin "
        "clean divider lines, like a film director's storyboard sheet. The grid must contain "
        f"exactly {n} panels: never add an extra row or column, never repeat a panel, and never "
        "leave a panel empty. Each panel is a separate, self-contained illustration of "
        "one beat of the same commercial — same product, same characters, same overall visual "
        f"style and color grade across all {n} panels (each panel depicts one frame of a "
        f"{video_aspect_ratio} video), just a different pose, angle, or moment in "
        "each. Panels read left-to-right, top-to-bottom in story order, one panel per beat "
        f"below — {n} beats, {n} panels. Do not add any text, "
        f"captions, numbers, or labels inside the image — the {n} panels alone tell the story.\n\n"
        f"{panel_lines}\n\n"
        f"Overall concept for continuity: {concept}{sheet_note}\n\n"
        f"{product_identity_instructions(num_product_images)}"
    )


async def generate_video_storyboard(
    llm: LLMClient,
    concept: str,
    product_images: list[tuple[bytes, str]],
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
    logo_image: tuple[bytes, str] | None = None,
) -> tuple[list[str], list[str]]:
    """Generate one 3x3-grid storyboard collage image per 10-second segment (one panel per
    beat) plus the beat descriptions used to plan them, so the beats can be reused afterward
    to keep the actual video narrative in sync with what the storyboard shows.

    Returns (storyboard_images_base64, beats) — N sheets and 9xN beats, both in story order.
    All sheets are drawn in parallel from the same concept, the same product photos, and the
    beat their predecessor ended on, which is what keeps four sheets reading as one film."""
    num_segments = segments_for(duration_seconds)
    continuity, beats = await plan_storyboard_beats(
        llm, concept, product_images, duration_seconds, aspect_ratio, platform
    )

    product_bytes = [b for b, _ in product_images]
    logo_note = (
        "\n\nMANDATORY: The LAST reference image is the brand logo. Composite it as a small "
        "corner watermark in every panel, reproduced with exact accuracy — do not simplify or "
        "redraw it."
    )

    async def _sheet(index: int) -> str:
        sheet_beats = beats[index * BEATS_PER_SEGMENT : (index + 1) * BEATS_PER_SEGMENT]
        image_prompt = _build_storyboard_image_prompt(
            sheet_beats, concept, len(product_images), aspect_ratio,
            sheet_index=index, sheet_count=num_segments,
            previous_sheet_last_beat=beats[index * BEATS_PER_SEGMENT - 1] if index else None,
            continuity=continuity,
        )
        images = list(product_bytes)
        # The logo has to stay LAST so the "last reference image" wording holds.
        if logo_image:
            images.append(logo_image[0])
            image_prompt += logo_note
        # The collage sheet is always rendered square: on a non-square canvas (e.g. 9:16) the
        # image model pads the 3x3 grid with extra rows of duplicate panels to fill the page.
        # The video's aspect ratio is conveyed per-panel inside the prompt instead.
        last_err: Exception | None = None
        for attempt in range(2):
            try:
                return await llm.generate_image_with_image_bytes(image_prompt, images, aspect_ratio="1:1")
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "storyboard sheet %d/%d attempt %d failed | %s",
                    index + 1, num_segments, attempt + 1, exc,
                )
        logger.error(
            "image_pipeline_degraded=storyboard_sheet | sheet %d/%d failed after retry | reason=%s",
            index + 1, num_segments, last_err,
        )
        raise last_err  # type: ignore[misc]

    sheets = await asyncio.gather(*[_sheet(i) for i in range(num_segments)])
    return list(sheets), beats


async def generate_maya_video(
    llm: LLMClient,
    segment_prompts: list[str],
    images: list[tuple[bytes, str]] | None = None,
    aspect_ratio: str = "16:9",
) -> VideoResult:
    """Render already-compiled segment prompts with Gemini Omni and wrap the result.

    One prompt per 10-second segment; the clip runs 10s x len(segment_prompts). The prompts are
    sent exactly as given — every instruction was placed once by the compiler, and appending
    guardrails here is how the old pipeline ended up stating product fidelity twice."""
    video_bytes = await llm.generate_video(
        segment_prompts=segment_prompts,
        images=images,
        aspect_ratio=aspect_ratio,
    )
    return VideoResult(
        video_base64=base64.b64encode(video_bytes).decode(),
        content_type="video/mp4",
        # The prompts actually sent to the model, so debugging sees the real input.
        prompt_used="\n\n--- SEGMENT BREAK ---\n\n".join(segment_prompts),
    )


# ── Logo Animation (docs/MAYA_LOGO_ANIMATION.md) ────────────────────────────
# 102 hardcoded styles — no LLM planning step, unlike the campaign/storyboard
# flows above. style_id is the 1-based position in LOGO_STYLE_DATA, stable
# across releases since the frontend dropdown references styles by id.

LOGO_ANIMATION_STYLES: list[dict] = [
    {"id": i + 1, "name": name, "category": category}
    for i, (category, name, _prompt) in enumerate(LOGO_STYLE_DATA)
]

_LOGO_ANIMATION_PROMPTS: dict[int, str] = {
    i + 1: prompt for i, (_category, _name, prompt) in enumerate(LOGO_STYLE_DATA)
}

_LOGO_ANIM_FIDELITY_GUARDRAIL = (
    "LOGO FIDELITY — NON-NEGOTIABLE: The uploaded reference image is the ONLY subject of "
    "this video. Every frame builds toward, or already shows, that exact logo: identical "
    "shape, colors, and proportions. Do not redesign, restyle, simplify, or reinterpret it. "
    "If the logo contains text, every character must be spelled exactly as shown and fully "
    "legible at the moment the logo completes — a misspelled or altered logo is a failure, "
    "not a stylistic variation."
)

_LOGO_ANIM_ENDING_GUARDRAIL = (
    "ENDING — NON-NEGOTIABLE: By roughly the final 1.5-2 seconds, the logo is fully formed, "
    "centered, sharp, and at rest — camera settled, no new motion beginning. This final hold "
    "is a clean frame a viewer could pause on and immediately screenshot; never end "
    "mid-formation or mid-motion."
)

_LOGO_ANIM_ASPECT_NOTE = {
    "9:16": (
        "Compose for vertical viewing: keep the logo centered in the middle band of the "
        "frame with generous clean space above and below for platform UI overlays."
    ),
    "16:9": (
        "Compose for widescreen viewing: center the logo with balanced negative space on "
        "both sides, filling the frame with the surrounding scene/effect rather than empty bars."
    ),
}


def build_logo_animation_prompt(style_id: int, aspect_ratio: str) -> tuple[str, str]:
    """Return (final_prompt, style_name) for a hardcoded logo-animation style.

    Raises ValueError if style_id is out of range — callers should turn that into a 400.
    """
    core_action = _LOGO_ANIMATION_PROMPTS.get(style_id)
    if core_action is None:
        raise ValueError(f"Unknown logo animation style_id: {style_id}")
    style_name = LOGO_ANIMATION_STYLES[style_id - 1]["name"]
    aspect_note = _LOGO_ANIM_ASPECT_NOTE.get(aspect_ratio, _LOGO_ANIM_ASPECT_NOTE["9:16"])
    final_prompt = "\n\n".join([
        core_action,
        _LOGO_ANIM_FIDELITY_GUARDRAIL,
        aspect_note,
        # The same audio contract every Maya render gets, stated once. The style prompt names
        # the sound world; this adds the timing. The logo-specific ending below is the only
        # ending instruction.
        audio_block(dialogue_mode="none"),
        _LOGO_ANIM_ENDING_GUARDRAIL,
    ])
    return final_prompt, style_name

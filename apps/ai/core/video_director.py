"""The video director: turns a brief into a structured cinematic plan.

This replaces a planner that wrote free prose and split it on "---". Prose gave the render
model a mood but no decisions — no shot size, no lens, no depth of field — and let one
10-second take accumulate a cast, dialogue, a product interaction, a camera orbit and a
reveal all at once, which is exactly what a video model renders badly.

The plan is a set of per-segment decisions instead. It is produced by ONE text call (the
same call count the prose planner made) and then enforced in code: the model is asked to
respect the segment count and the speech budget, but `validate_plan` is what guarantees it.
A prompt is not a control.

Nothing here renders anything. `core/video_prompt_compiler.py` turns a plan into the
prompts Gemini Omni reads.
"""

from __future__ import annotations

import logging
import math
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from core.brand_kit import BrandKit, get_platform_tone
from core.llm import (
    GEMINI_FLASH,
    LLMClient,
    MAX_WORDS_PER_LINE,
    MAX_WORDS_PER_SEGMENT,
    SPEECH_CUTOFF_SECONDS,
    SPEECH_LEAD_IN_SECONDS,
    SPEECH_TAIL_SECONDS,
    SPEECH_WINDOW_SECONDS,
    SPEECH_WORDS_PER_SECOND,
    VIDEO_SEGMENT_SECONDS,
)
from core.utils import safe_json_loads

logger = logging.getLogger("video_director")

# Field caps keep a plan — and so every compiled prompt — dense rather than long. A director
# that writes a paragraph into "lens" is writing prose again.
_SHORT = 160
_MEDIUM = 400
_LONG = 700

# The final line of the film is the one most often clipped, so it gets the tightest budget.
FINAL_LINE_MAX_WORDS = max(3, MAX_WORDS_PER_LINE - 3)

DialogueMode = Literal["none", "on_camera", "voiceover"]
VideoFormat = Literal["product_film", "lifestyle", "ugc", "demo", "narrative", "atmospheric"]


def segments_for(duration_seconds: int) -> int:
    """How many 10-second renders make up a video of this length."""
    return max(1, math.ceil(duration_seconds / VIDEO_SEGMENT_SECONDS))


def _speech_budget(num_segments: int) -> tuple[int, int]:
    """Roughly how much spoken language a film of this length can actually carry.

    Budgeted off the per-segment SPEECH WINDOW rather than the raw runtime, because every
    10-second render opens with a lead-in and closes with a mandatory speech-free tail
    (core/llm.py), and words budgeted into that tail are words the renderer clips.
    """
    words = max(6, MAX_WORDS_PER_SEGMENT * num_segments)
    lines = max(1, round(words / MAX_WORDS_PER_LINE))
    return words, lines


# Placeholder values a model writes instead of omitting a field. Kept out of prompts, where
# "CONTINUITY: N/A" is noise the renderer has to read past.
_EMPTY_VALUES = {"n/a", "na", "none", "null", "-", "nil", "not applicable"}


def _clip(value: object, limit: int) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    if text.rstrip(".").lower() in _EMPTY_VALUES:
        return None
    return text[:limit] if text else None


# "pours granola into a bowl, then adds milk" is two actions in one take. Caught in code
# because the prompt alone did not stop it in live planning runs.
_SEQUENCED_ACTION = re.compile(r"\b(then|after which|followed by)\b", re.I)


# ── Plan models ──────────────────────────────────────────────────────────────


class _PlanModel(BaseModel):
    # The director is an LLM: unknown keys are ignored rather than failing the whole plan.
    model_config = ConfigDict(extra="ignore")


class DialogueLine(_PlanModel):
    speaker: str | None = None
    line: str

    @field_validator("speaker", mode="before")
    @classmethod
    def _speaker(cls, v):
        return _clip(v, _SHORT)

    @field_validator("line", mode="before")
    @classmethod
    def _line(cls, v):
        return _clip(v, _MEDIUM) or ""


class ProductSpec(_PlanModel):
    description: str | None = None
    identity_cues: list[str] = Field(default_factory=list)
    # Fine details read from the reference photos that must survive into every frame — the
    # ones a video model "corrects" or animates (closed eyes opened, a painted face made to
    # move). Named one by one because generic fidelity wording loses to the model's priors.
    detail_lock: list[str] = Field(default_factory=list)
    # The product carries depicted imagery (a painting, print, illustration, photo, character
    # art) that must stay still artwork rather than come to life.
    static_artwork: bool = False

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return _clip(v, _LONG)

    @field_validator("identity_cues", mode="before")
    @classmethod
    def _cues(cls, v):
        if not isinstance(v, list):
            return []
        return [c for c in (_clip(x, _SHORT) for x in v[:8]) if c]

    @field_validator("detail_lock", mode="before")
    @classmethod
    def _details(cls, v):
        if not isinstance(v, list):
            return []
        return [d for d in (_clip(x, 220) for x in v[:24]) if d]

    @field_validator("static_artwork", mode="before")
    @classmethod
    def _static(cls, v):
        return v is True or str(v).strip().lower() in ("true", "yes", "1")


class LookSpec(_PlanModel):
    color_treatment: str | None = None
    lighting_style: str | None = None

    @field_validator("*", mode="before")
    @classmethod
    def _cap(cls, v):
        return _clip(v, _MEDIUM)


class AudioSpec(_PlanModel):
    ambience: str | None = None
    music: str | None = None
    dialogue_mode: DialogueMode = "none"

    @field_validator("ambience", "music", mode="before")
    @classmethod
    def _cap(cls, v):
        return _clip(v, _MEDIUM)

    @field_validator("dialogue_mode", mode="before")
    @classmethod
    def _mode(cls, v):
        return v if v in ("none", "on_camera", "voiceover") else "none"


class SegmentPlan(_PlanModel):
    index: int = 0
    purpose: str | None = None
    shot_type: str | None = None
    subject: str | None = None
    product_state: str | None = None
    primary_action: str
    environment: str | None = None
    composition: str | None = None
    shot_size: str | None = None
    camera_angle: str | None = None
    camera_movement: str | None = None
    movement_speed: str | None = None
    lens: str | None = None
    depth_of_field: str | None = None
    focus: str | None = None
    lighting: str | None = None
    materials: str | None = None
    atmosphere: str | None = None
    color_treatment: str | None = None
    pacing: str | None = None
    sound: str | None = None
    dialogue: list[DialogueLine] = Field(default_factory=list)
    start_state: str | None = None
    end_state: str | None = None
    continuity: str | None = None

    @field_validator(
        "purpose", "shot_type", "shot_size", "camera_angle", "movement_speed", "lens",
        "depth_of_field", "focus", "pacing", mode="before",
    )
    @classmethod
    def _short(cls, v):
        return _clip(v, _SHORT)

    @field_validator(
        "subject", "product_state", "environment", "composition", "camera_movement",
        "lighting", "materials", "atmosphere", "color_treatment", "sound", "start_state",
        "end_state", "continuity", mode="before",
    )
    @classmethod
    def _medium(cls, v):
        return _clip(v, _MEDIUM)

    @field_validator("primary_action", mode="before")
    @classmethod
    def _action(cls, v):
        return _clip(v, _LONG) or ""

    @field_validator("dialogue", mode="before")
    @classmethod
    def _dialogue(cls, v):
        if not isinstance(v, list):
            return []
        # Accept bare strings as well as {speaker, line} objects.
        return [{"line": x} if isinstance(x, str) else x for x in v if x]


class VideoPlan(_PlanModel):
    format: VideoFormat = "product_film"
    concept: str = ""
    product: ProductSpec | None = None
    cast: str | None = None
    setting: str | None = None
    look: LookSpec = Field(default_factory=LookSpec)
    audio: AudioSpec = Field(default_factory=AudioSpec)
    segments: list[SegmentPlan] = Field(default_factory=list)

    @field_validator("format", mode="before")
    @classmethod
    def _format(cls, v):
        allowed = ("product_film", "lifestyle", "ugc", "demo", "narrative", "atmospheric")
        return v if v in allowed else "product_film"

    @field_validator("concept", mode="before")
    @classmethod
    def _concept(cls, v):
        return _clip(v, _LONG) or ""

    @field_validator("cast", "setting", mode="before")
    @classmethod
    def _lock(cls, v):
        return _clip(v, _LONG)


class PlanInvalid(ValueError):
    """The director's output could not be turned into a renderable plan."""


# ── Validation ───────────────────────────────────────────────────────────────


def _words(text: str) -> int:
    return len(text.split())


def _enforce_dialogue(plan: VideoPlan) -> None:
    """Hold every line to the speech budget the renderer can actually deliver.

    Over-long lines are dropped whole rather than truncated: a cut-off sentence spoken
    cleanly is still a cut-off sentence.
    """
    if plan.audio.dialogue_mode == "none":
        for seg in plan.segments:
            if seg.dialogue:
                logger.info("video plan | dropped %d line(s): dialogue_mode=none", len(seg.dialogue))
            seg.dialogue = []
        return

    last = len(plan.segments) - 1
    for i, seg in enumerate(plan.segments):
        kept: list[DialogueLine] = []
        total = 0
        for line in seg.dialogue:
            n = _words(line.line)
            if n == 0:
                continue
            if n > MAX_WORDS_PER_LINE or total + n > MAX_WORDS_PER_SEGMENT:
                logger.info(
                    "video plan | dropped line over budget | segment=%d words=%d", i + 1, n
                )
                continue
            kept.append(line)
            total += n
        if i == last and kept and _words(kept[-1].line) > FINAL_LINE_MAX_WORDS:
            logger.info("video plan | dropped over-long closing line | words=%d", _words(kept[-1].line))
            kept.pop()
        seg.dialogue = kept


def validate_plan(raw: object, num_segments: int, *, strict: bool = False) -> VideoPlan:
    """Turn director output into a plan the compiler can trust, or raise PlanInvalid.

    Structure is checked; content is enforced. Too FEW segments is invalid — padding by
    repeating the last one renders the same shot twice, which the prose planner used to do
    silently. Too many are trimmed.

    `strict` additionally rejects a take whose primary action is a sequence ("…, then …").
    The director uses it on its first attempt only, so the corrective retry can fix it; a
    second plan that still sequences is accepted rather than thrown away for the fallback.
    """
    if isinstance(raw, VideoPlan):
        data: object = raw.model_dump()
    else:
        data = raw
    if not isinstance(data, dict):
        raise PlanInvalid("plan is not a JSON object")
    try:
        plan = VideoPlan.model_validate(data)
    except ValidationError as err:
        raise PlanInvalid(f"plan failed schema validation: {err.errors()[:3]}") from err

    segments = [s for s in plan.segments if s.primary_action.strip()]
    if len(segments) < num_segments:
        raise PlanInvalid(
            f"plan has {len(segments)} usable segment(s); {num_segments} are required"
        )
    if len(segments) > num_segments:
        logger.info("video plan | trimmed %d extra segment(s)", len(segments) - num_segments)
    plan.segments = segments[:num_segments]

    if strict:
        sequenced = [
            s.index or i + 1 for i, s in enumerate(plan.segments)
            if _SEQUENCED_ACTION.search(s.primary_action)
        ]
        if sequenced:
            raise PlanInvalid(
                f"segment(s) {sequenced} have more than one action in primary_action "
                "(e.g. 'X, then Y'); keep ONE action per take and move the rest to another "
                "segment or drop it"
            )

    for i, seg in enumerate(plan.segments):
        seg.index = i + 1
        # The continuity chain: each shot opens where the previous one left off.
        if i > 0 and not seg.start_state and plan.segments[i - 1].end_state:
            seg.start_state = plan.segments[i - 1].end_state

    _enforce_dialogue(plan)
    return plan


def fallback_plan(brief: str, num_segments: int, has_product: bool) -> VideoPlan:
    """A deliberately plain plan, used only when the director fails twice.

    Simple, achievable hero shots render acceptably; an ambitious plan invented without the
    director would not. Logged by the caller as a degraded pipeline.
    """
    subject = "the product" if has_product else "the subject"
    beats = [
        ("hook", "close-up", "slow push-in", "85mm", "shallow depth of field",
         f"light slowly moves across {subject}, revealing its form and surface detail"),
        ("build", "medium close-up", "slow lateral dolly", "50mm", "shallow depth of field",
         f"{subject} is shown in a natural setting that fits the brief, one clear detail in focus"),
        ("hero", "medium", "controlled slow orbit", "50mm", "moderate depth of field",
         f"{subject} is the clear hero of the frame as the camera drifts around it"),
        ("close", "medium close-up", "slow push-in settling to a stop", "85mm", "shallow depth of field",
         f"{subject} settles into a clean, well-lit hero frame"),
    ]
    segments = []
    for i in range(num_segments):
        # Always end on the closing beat, whatever the length.
        beat = beats[-1] if i == num_segments - 1 else beats[min(i, len(beats) - 2)]
        purpose, size, move, lens, dof, action = beat
        segments.append(SegmentPlan(
            index=i + 1, purpose=purpose, shot_size=size, camera_movement=move,
            movement_speed="slow", lens=lens, depth_of_field=dof, primary_action=action,
        ))
    return VideoPlan(
        format="product_film" if has_product else "atmospheric",
        concept=_clip(brief, _LONG) or "",
        audio=AudioSpec(ambience="subtle, realistic ambience matching the setting", dialogue_mode="none"),
        segments=segments,
    )


# ── Director prompt ──────────────────────────────────────────────────────────


_SPEECH_TIMING_RULES = f"""\
SPEECH TIMING. The film is rendered in {VIDEO_SEGMENT_SECONDS}-second segments and the sound is \
cut dead at the end of every one — at a join as hard as at the end of the film.
- Nobody speaks in the first {SPEECH_LEAD_IN_SECONDS:g} second of a segment.
- All speech in a segment is finished by the {SPEECH_CUTOFF_SECONDS:g}-second mark, leaving the \
final {SPEECH_TAIL_SECONDS:g} seconds with no spoken words at all.
- That leaves about {SPEECH_WINDOW_SECONDS:g} seconds of speech per segment. At an unhurried \
{SPEECH_WORDS_PER_SECOND:g} words per second that is at most {MAX_WORDS_PER_SEGMENT} words in a \
segment, and no single line longer than {MAX_WORDS_PER_LINE} words. Count them.
- Never fix a long line by having it delivered faster. Cut words instead.
- Every line starts and finishes inside its own segment; never split a sentence across a join.
- The silent tail is never silent-sounding: ambience and score keep running through it."""


_DIRECTOR_ROLE = """\
You are the director and director of photography for a premium AI-generated commercial. You
turn a brief into a precise shot plan that a video model can render reliably. You make
decisions, not descriptions: every field you fill is a choice a cinematographer would commit to
on set."""


_RENDERER_LIMITS = f"""\
WHAT THE RENDERER CAN AND CANNOT DO — PLAN FOR IT.
- Each segment is ONE continuous {VIDEO_SEGMENT_SECONDS}-second take. There are no cuts, no
  split screens and no transitions inside a segment. Segments are chained, each continuing from
  the last frame of the previous one.
- ONE PRIMARY VISUAL ACTION PER SEGMENT. That is the default and it is the most important rule
  in this brief. A segment is a single cinematic moment, not a sequence of events:
  primary_action is one action, never "X, then Y" — give Y its own segment.
- Never stack these in one segment: several characters, dialogue, a complex product interaction,
  a camera orbit, an environment change, an object transformation, a reaction shot, a product
  reveal. Pick the one that matters and give the rest their own segment or drop them.
- At most two people in frame, and prefer one. Hands handling a product are hard; keep any
  interaction simple, slow and clearly visible.
- It cannot render reliable text. Plan no captions, titles, subtitles, URLs, prices, CTA text,
  graphics or on-screen messages. Only text physically printed on the real product may appear.

GOOD segment: "Extreme close-up, 100mm macro, shallow depth of field. The camera tracks slowly
sideways while a single condensation droplet runs down the perfume bottle."
BAD segment: "A woman walks into a bathroom, picks up the perfume, sprays it, the camera circles
her, flowers bloom, the room changes and she says the tagline while the bottle rotates."
Simplify every concept until each segment is as achievable as the good one."""


_CINEMATOGRAPHY = """\
CINEMATOGRAPHY IS A DECISION, NOT DECORATION. For each segment choose, from the concept:
- shot_size: extreme close-up, macro, close-up, medium close-up, medium, medium-wide, wide
- camera_angle: eye-level, low-angle, high-angle, overhead / top-down, three-quarter, profile
- camera_movement + movement_speed: locked-off, slow push-in, pull-back, lateral dolly, tracking
  shot, controlled orbit (partial arc), crane rise/descend, handheld drift (UGC only)
- lens: macro lens, 24mm, 35mm, 50mm, 85mm, 100mm macro, long lens compression
- depth_of_field + focus: shallow depth of field, deep focus, rack focus from A to B, focus
  holding on the label
- composition: centred hero, rule of thirds, negative space side, foreground element framing
- lighting (direction + quality), materials (reflections, refraction, surface texture,
  liquid/fabric/steam behaviour), atmosphere, color_treatment, pacing
Use only what serves the shot. Vary shot size and angle between segments so the film develops;
four versions of the same framing is a failure. Keep camera motion motivated and smooth."""


_PRODUCT_DIRECTION = """\
PRODUCT FILMS. When the brief sells a physical product, prioritise in this order: product
identity, geometry and proportions, materials and finish, branding and label, lighting,
reflections, composition, camera movement, environmental realism, premium commercial finish.
The reference images are the source of truth. In product.description and identity_cues describe
ONLY what is visible in them — shape, colours, materials, cap/closure, label layout, printed
brand text. Never invent packaging, colours, proportions, logos, materials or features, and never
claim benefits the brief does not state. Keep the product in a state the references show (closed,
open, poured) and say which in product_state.

MICRO-DETAIL LOCK. The video model redraws the product from the photos and "corrects" what it
thinks is wrong: it opens closed eyes, turns a neutral expression into a smile, straightens a
deliberate asymmetry, adds or drops small elements, re-spells text. When reference photos are
given, study them at full detail and fill product.detail_lock with every fine detail a viewer
could notice changing, each as one short, literal, checkable statement. Cover, where present:
faces and figures (eyes open or closed, gaze direction, expression, mouth, pose, hand
positions), how many of each element there are and where they sit, orientation and which way
things face, colours of specific regions, patterns and textures, borders and edges, printed text
verbatim, and anything unusual. Good: "the woman's eyes are fully closed", "exactly three gold
leaves, top-left corner", "brand text reads 'Aster & Co.' in white script". Set
product.static_artwork = true when the product carries a painting, print, illustration,
photograph or character art: that imagery is still artwork and must never come to life.

PRODUCT-SAFE CINEMATOGRAPHY, whenever reference photos are given. Every frame the model has to
invent is a frame where the product can drift, so plan shots that ask it to invent as little of
the product as possible:
- Show the product only from angles the photos actually show. No full orbits, turntable spins or
  reveals of a side, back or inside the photos do not cover.
- The product itself stays physically unchanged and still unless the brief needs it used. Put the
  motion in the camera, the light, reflections and the environment.
- Keep the details in detail_lock clearly visible and at a scale the photos support; do not push a
  macro lens onto a detail the photos do not show sharply.
- No hands, props, steam or foreground elements covering the key details, and no transformations,
  melting, morphing or stylised effects applied to the product."""


_FORMAT_DEFAULTS = """\
FORMAT. Choose `format` from the brief:
- product_film: studio or set-piece hero cinematography of the product. No invented cast, no
  dialogue, no storyline. Development comes from rising intensity — a detail, then the form, then
  the whole product landing as the hero.
- lifestyle / narrative: a person and a moment. Cast one specific person and keep them identical
  (write the lock in `cast`). The product is used, not just displayed, and the film moves from a
  want to a visibly better state — spread across segments, one moment per segment.
- ugc: creator-style, handheld, natural light, talking to camera; dialogue carries it.
- demo: the product doing its job, clearly visible, one step per segment.
- atmospheric: mood, light and material; no dialogue.
Dialogue only when the format genuinely calls for it; otherwise audio.dialogue_mode = "none" and
let ambience and restrained sound design carry the film.

THE BRIEF OUTRANKS EVERY DEFAULT ABOVE. If it asks for a specific treatment, follow it exactly
and drop whichever defaults conflict with it — within what the renderer can do."""


_TEMPLATE_TRANSLATION = """\
TRANSLATE WHAT THE RENDERER CANNOT DO LITERALLY:
- "fast cuts", "montage", "three reasons", "several moments", "day in the life" → visually distinct
  segments, one moment each.
- "split-screen", "before and after", "what I ordered vs what I got" → the two states in
  consecutive segments.
- "on-screen captions", "text on screen", "a comment shown on screen", "bold captions" → no
  generated text; convey it through the action or a short spoken line.
- A stated length ("15-second video") → ignore it; the duration is fixed below."""


def _continuity_rules(num_segments: int) -> str:
    if num_segments == 1:
        return """\
CONTINUITY AND ENDING. A single segment: the action develops and then resolves. end_state is a
settled, well-composed hero frame a viewer could pause on — the product clear and legible, the
camera coming to rest."""
    return f"""\
CONTINUITY AND ENDING. {num_segments} segments form ONE commercial, not {num_segments} clips.
- segments[k].start_state must describe exactly where segments[k-1].end_state left the frame.
- Every segment except the last ends IN MOTION on a frame that wants the next moment — never
  settled, faded or resolved.
- The last segment resolves: end_state is a settled hero frame, product clear and legible.
- Anything that must not change between segments (person, wardrobe, location, time of day, light,
  grade) belongs in `cast`, `setting` and `look`, written so two artists would draw the same thing."""


_OUTPUT_SCHEMA = """\
OUTPUT: ONLY a JSON object with this shape. Omit any optional field that would not help the shot.
{
  "format": "product_film|lifestyle|ugc|demo|narrative|atmospheric",
  "concept": "one sentence: the idea of the film",
  "product": {"description": "visible facts only", "identity_cues": ["short cue", "..."],
              "detail_lock": ["one literal fine detail", "..."], "static_artwork": false} | null,
  "cast": "exact recurring person description" | null,
  "setting": "location, time of day" | null,
  "look": {"color_treatment": "...", "lighting_style": "..."},
  "audio": {"ambience": "...", "music": "..." , "dialogue_mode": "none|on_camera|voiceover"},
  "segments": [
    {
      "purpose": "hook|build|hero|payoff|close",
      "shot_type": "e.g. macro product beauty shot",
      "subject": "...", "product_state": "...",
      "primary_action": "the ONE visual action of this take",
      "environment": "...", "composition": "...",
      "shot_size": "...", "camera_angle": "...",
      "camera_movement": "...", "movement_speed": "...",
      "lens": "...", "depth_of_field": "...", "focus": "...",
      "lighting": "...", "materials": "...", "atmosphere": "...",
      "color_treatment": "...", "pacing": "...",
      "sound": "sound design for this take",
      "dialogue": [{"speaker": "...", "line": "..."}],
      "start_state": "...", "end_state": "...",
      "continuity": "anything specific to carry over"
    }
  ]
}
Write every value as tight production shorthand, not sentences of prose."""


def build_director_system(duration_seconds: int, num_segments: int) -> str:
    """The director's system prompt for this runtime."""
    words, lines = _speech_budget(num_segments)
    dialogue_budget = (
        f"DIALOGUE BUDGET. When the film speaks: about {words} words across the whole film "
        f"(roughly {lines} short lines), spread across segments rather than saved for the end. "
        f"Make the closing line the shortest — {FINAL_LINE_MAX_WORDS} words or fewer — and "
        f"early enough in its segment that a wordless beat follows it. Lines must sound like a "
        f"real person speaking, not advertising copy. Lines that break the budget are removed "
        f"before rendering, so keep them inside it."
    )
    return "\n\n".join([
        _DIRECTOR_ROLE,
        f"This film runs exactly {duration_seconds} seconds: EXACTLY {num_segments} segment(s) "
        f"of {VIDEO_SEGMENT_SECONDS} seconds each.",
        _RENDERER_LIMITS,
        _CINEMATOGRAPHY,
        _PRODUCT_DIRECTION,
        _FORMAT_DEFAULTS,
        _TEMPLATE_TRANSLATION,
        _continuity_rules(num_segments),
        _SPEECH_TIMING_RULES,
        dialogue_budget,
        _OUTPUT_SCHEMA,
    ])


def _brand_context(brand_kit: BrandKit | None, platform: str) -> str:
    if not brand_kit:
        return ""
    parts = []
    # "My Company" is BrandKit's placeholder default, not a name to speak in a film.
    if brand_kit.company_name and brand_kit.company_name != "My Company":
        parts.append(f"Brand: {brand_kit.company_name}.")
    tone = get_platform_tone(brand_kit, platform)
    if tone:
        parts.append(f"Tone on {platform}: {tone}.")
    if brand_kit.brand_voice:
        parts.append(f"Brand voice: {brand_kit.brand_voice}.")
    if brand_kit.target_audience:
        parts.append(f"Target audience: {brand_kit.target_audience}.")
    colors = [f"{k}: {v}" for k, v in (brand_kit.brand_colors or {}).items() if v]
    if colors:
        parts.append(
            f"Brand colours (reflect in the grade where it suits the category): {', '.join(colors)}."
        )
    return " ".join(parts)


def _build_user_prompt(
    *,
    brief: str,
    duration_seconds: int,
    num_segments: int,
    aspect_ratio: str,
    platform: str,
    brand_kit: BrandKit | None,
    num_product_images: int,
    storyboard_beats: list[str] | None,
    num_storyboard_images: int,
) -> str:
    sections = [f"BRIEF: {brief.strip()}"]
    brand = _brand_context(brand_kit, platform)
    if brand:
        sections.append(brand)
    sections.append(
        f"Duration: {duration_seconds}s = {num_segments} segment(s). Aspect ratio: {aspect_ratio}"
        + (" (vertical: keep the subject in the middle band, clear of the top and bottom edges)"
           if aspect_ratio == "9:16" else "")
        + f". Platform: {platform}."
    )
    if num_product_images:
        sections.append(
            f"The first {num_product_images} attached image(s) are photos of the REAL product, "
            "possibly rough snapshots from different angles. Study all of them at full detail "
            "before planning, fill product.detail_lock from what you see, and follow the "
            "product-safe cinematography rules."
        )
    else:
        sections.append(
            "No product photos are provided. Describe any product only as the brief states it. "
            "Do not invent its packaging, colours, shape, label design or printed text; leave "
            "product.identity_cues and product.detail_lock empty, and frame the product so no "
            "label text needs to be read."
        )
    if storyboard_beats:
        beats = "\n".join(f"- {b}" for b in storyboard_beats)
        sections.append(
            "The user approved this storyboard. Keep its story, setting, cast and order, but "
            "condense it into the segments above — several beats per segment, one primary "
            f"action per segment:\n{beats}"
        )
    if num_storyboard_images:
        sections.append(
            f"The last {num_storyboard_images} attached image(s) are the storyboard sheets — "
            "reference for staging and mood only. The product must match the product photos, "
            "not the drawings."
        )
    return "\n\n".join(sections)


async def _ask_director(
    llm: LLMClient,
    system: str,
    user: str,
    images: list[tuple[bytes, str]],
    num_segments: int,
) -> object:
    if images:
        raw = await llm.complete_with_vision_multi(
            files=images, prompt=f"{system}\n\n{user}", json_mode=True
        )
        return safe_json_loads(raw)
    return await llm.complete_json(
        *GEMINI_FLASH,
        system=system,
        messages=[{"role": "user", "content": user}],
        temperature=0.6,
        max_tokens=1500 * num_segments,
    )


async def plan_video(
    llm: LLMClient,
    *,
    brief: str,
    duration_seconds: int,
    aspect_ratio: str,
    platform: str,
    brand_kit: BrandKit | None = None,
    product_images: list[tuple[bytes, str]] | None = None,
    storyboard_beats: list[str] | None = None,
    storyboard_images: list[tuple[bytes, str]] | None = None,
) -> VideoPlan:
    """Plan a video. One director call; one corrective retry only if the output is unusable;
    a plain deterministic plan if both fail. Never raises for a bad plan."""
    num_segments = segments_for(duration_seconds)
    product_images = product_images or []
    storyboard_images = storyboard_images or []
    system = build_director_system(duration_seconds, num_segments)
    user = _build_user_prompt(
        brief=brief,
        duration_seconds=duration_seconds,
        num_segments=num_segments,
        aspect_ratio=aspect_ratio,
        platform=platform,
        brand_kit=brand_kit,
        num_product_images=len(product_images),
        storyboard_beats=storyboard_beats,
        num_storyboard_images=len(storyboard_images),
    )
    images = product_images + storyboard_images

    error: str | None = None
    for attempt in range(2):
        prompt = user if error is None else (
            f"{user}\n\nYOUR PREVIOUS PLAN WAS REJECTED: {error}. Return a corrected JSON plan "
            f"with exactly {num_segments} segment(s), each with a primary_action."
        )
        try:
            raw = await _ask_director(llm, system, prompt, images, num_segments)
            return validate_plan(raw, num_segments, strict=attempt == 0)
        except PlanInvalid as err:
            error = str(err)
        except Exception as err:  # provider, parse
            error = f"{type(err).__name__}: {err}"
        logger.warning("video director attempt %d failed | %s", attempt + 1, error)

    logger.error(
        "video_pipeline_degraded=director | using fallback plan | segments=%d reason=%s",
        num_segments, error,
    )
    return fallback_plan(brief, num_segments, has_product=bool(product_images))


def parse_client_plan(plan_json: str | None, num_segments: int) -> VideoPlan | None:
    """A plan previewed by the user and handed back on the render request, or None if it is
    missing or no longer valid for this duration (the caller then re-plans)."""
    if not plan_json:
        return None
    try:
        return validate_plan(safe_json_loads(plan_json), num_segments)
    except Exception as err:
        logger.warning("client video plan rejected; re-planning | %s", err)
        return None


def plan_display_segments(plan: VideoPlan) -> list[str]:
    """One readable line per segment, for the preview shown while the video renders."""
    out = []
    for seg in plan.segments:
        framing = " · ".join(p for p in (seg.shot_size, seg.camera_movement) if p)
        line = seg.primary_action
        if framing:
            line = f"{framing[0].upper()}{framing[1:]} — {line}"
        if seg.dialogue:
            spoken = " ".join(f"“{d.line}”" for d in seg.dialogue)
            line = f"{line} {spoken}"
        out.append(line)
    return out

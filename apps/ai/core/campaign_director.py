"""The campaign director: turns product photos and a brief into a structured photo-campaign plan.

This replaces a pipeline where every planning step was blind to the product. A text-only story
planner wrote each photo's shot, a text-only "creative concept" call and a text-only
"5-component" call then rewrote it per photo, and only a style-lock call ever looked at the
product — and it returned nothing but lighting and grade values. Nobody knew a campaign was
for, say, a devotional painting, so nobody could build the world around it (the altar, the
brass diya, the rudraksha), and every campaign was pushed through a problem → product →
relief arc that suits a pain-relief balm and nothing else.

Here ONE vision call sees the product at full detail and decides everything: what the product
is, the campaign idea, one shared visual world, and each photo's scene, props, camera, light
and headline. `validate_plan` enforces the shape in code, and a deterministic plan covers the
case where the director fails twice.

Nothing here renders anything. `core/campaign_prompt_compiler.py` turns a plan into the
prompts the image model reads.
"""

from __future__ import annotations

import io
import logging

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from core.brand_kit import BrandKit, get_platform_tone
from core.config import settings
from core.llm import LLMClient
from core.utils import safe_json_loads

logger = logging.getLogger("campaign_director")

# Field caps keep every compiled prompt a dense scene rather than a rulebook — prompt density,
# not length alone, is what makes the image model return IMAGE_OTHER.
_TINY = 80
_SHORT = 140
_MEDIUM = 280
_LONG = 600
_MAX_LIST = 8
_MAX_DETAILS = 10
_HEADLINE_WORDS = 5
_SUBTEXT_WORDS = 7

# The director reads the product at this size: enough to see faces, linework and label text,
# small enough to keep a 5-photo request well inside the inline payload limit.
_DIRECTOR_IMAGE_SIDE = 1536

_EMPTY_VALUES = {"n/a", "na", "none", "null", "-", "nil", "not applicable"}


def _clip(value: object, limit: int) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    if text.rstrip(".").lower() in _EMPTY_VALUES:
        return None
    if len(text) <= limit:
        return text or None
    cut = text[:limit]
    return (cut.rsplit(" ", 1)[0] if " " in cut else cut).rstrip(",;:—- ")


def _clip_list(value: object, limit: int, max_items: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out = [c for c in (_clip(v, limit) for v in value) if c]
    return out[:max_items]


def _cap_words(text: str | None, max_words: int) -> str:
    return " ".join((text or "").split()[:max_words])


# ── Plan models ──────────────────────────────────────────────────────────────


class _PlanModel(BaseModel):
    # The director is an LLM: unknown keys are ignored rather than failing the whole plan.
    model_config = ConfigDict(extra="ignore")


class ProductProfile(_PlanModel):
    category: str = "product"
    description: str = ""
    # A painting, print, poster, illustration or photograph whose image IS the product. Its
    # picture must never be redrawn — only the physical object moves through the scenes.
    is_flat_artwork: bool = False
    detail_lock: list[str] = Field(default_factory=list)
    context: str | None = None

    @field_validator("category", mode="before")
    @classmethod
    def _category(cls, v):
        return _clip(v, _SHORT) or "product"

    @field_validator("description", mode="before")
    @classmethod
    def _description(cls, v):
        return _clip(v, _MEDIUM) or ""

    @field_validator("context", mode="before")
    @classmethod
    def _context(cls, v):
        return _clip(v, _MEDIUM)

    @field_validator("detail_lock", mode="before")
    @classmethod
    def _details(cls, v):
        return _clip_list(v, _SHORT, _MAX_DETAILS)

    @field_validator("is_flat_artwork", mode="before")
    @classmethod
    def _flat(cls, v):
        return v is True or str(v).strip().lower() == "true"


class CampaignWorld(_PlanModel):
    """What every photo shares, so four photos read as one campaign rather than four posts."""

    concept: str = ""
    # The medium every image is made in — "cinematic editorial photography", "warm storybook
    # illustration", "3D clay render". Chosen from the brief; photography when it says nothing.
    visual_style: str | None = None
    # One type direction for the campaign, chosen for this product's world: typeface character,
    # weight, colour, finish. Replaces the old fixed "clean, bold, highly legible typeface".
    typography: str | None = None
    setting: str | None = None
    prop_kit: list[str] = Field(default_factory=list)
    lighting: str | None = None
    palette: str | None = None
    grade: str | None = None

    @field_validator("concept", mode="before")
    @classmethod
    def _concept(cls, v):
        return _clip(v, _MEDIUM) or ""

    @field_validator("visual_style", "typography", mode="before")
    @classmethod
    def _direction(cls, v):
        return _clip(v, _TINY)

    @field_validator("setting", "lighting", "palette", "grade", mode="before")
    @classmethod
    def _medium(cls, v):
        return _clip(v, _MEDIUM)

    @field_validator("prop_kit", mode="before")
    @classmethod
    def _props(cls, v):
        return _clip_list(v, _SHORT, _MAX_LIST)


class ShotPlan(_PlanModel):
    index: int = 0
    purpose: str = ""
    # The one creative idea this frame carries — a moment, a symbol, a story beat. Two shots
    # never share an idea; that is what stops a campaign reading as four placements.
    idea: str | None = None
    # Set in the product's everyday place (home for décor, a bathroom shelf for skincare, a desk
    # for a laptop). Checked on the first attempt: a campaign that keeps most frames there reads
    # as a catalogue of placements, not a campaign.
    ordinary_setting: bool = False
    scene: str
    environment_label: str = ""
    props: list[str] = Field(default_factory=list)
    product_placement: str | None = None
    subject: str | None = None
    shot_size: str | None = None
    camera_angle: str | None = None
    lens: str | None = None
    depth_of_field: str | None = None
    composition: str | None = None
    lighting: str | None = None
    mood: str | None = None
    headline: str = ""
    subtext: str = ""
    # Where and how this frame's words live: placement, size, and whether they sit over the
    # image or inside the scene (embossed on the mat, lettered on a paper tag, set in the sky).
    text_treatment: str | None = None

    @field_validator("scene", mode="before")
    @classmethod
    def _scene(cls, v):
        return _clip(v, _LONG) or ""

    @field_validator("purpose", "environment_label", mode="before")
    @classmethod
    def _label(cls, v):
        return _clip(v, _SHORT) or ""

    @field_validator("idea", "text_treatment", mode="before")
    @classmethod
    def _short(cls, v):
        return _clip(v, _SHORT)

    @field_validator("product_placement", "subject", "composition", "lighting", mode="before")
    @classmethod
    def _medium(cls, v):
        return _clip(v, _MEDIUM)

    @field_validator("shot_size", "camera_angle", "lens", "depth_of_field", "mood", mode="before")
    @classmethod
    def _tiny(cls, v):
        return _clip(v, _TINY)

    @field_validator("props", mode="before")
    @classmethod
    def _props(cls, v):
        return _clip_list(v, _SHORT, _MAX_LIST)

    @field_validator("ordinary_setting", mode="before")
    @classmethod
    def _ordinary(cls, v):
        return v is True or str(v).strip().lower() == "true"

    @field_validator("headline", mode="before")
    @classmethod
    def _headline(cls, v):
        return _cap_words(_clip(v, _SHORT), _HEADLINE_WORDS)

    @field_validator("subtext", mode="before")
    @classmethod
    def _subtext(cls, v):
        return _cap_words(_clip(v, _SHORT), _SUBTEXT_WORDS)


class CampaignPlan(_PlanModel):
    product: ProductProfile = Field(default_factory=ProductProfile)
    world: CampaignWorld = Field(default_factory=CampaignWorld)
    shots: list[ShotPlan]


class PlanInvalid(ValueError):
    """The director's output cannot be used as a plan."""


def _norm_label(shot: ShotPlan) -> str:
    return " ".join((shot.environment_label or shot.scene[:80]).lower().split())


def validate_plan(raw: object, photo_count: int, *, strict: bool = False) -> CampaignPlan:
    """Turn director output into a plan the compiler can trust, or raise PlanInvalid.

    Too FEW shots is invalid — padding by repeating one renders the same photo twice. Too many
    are trimmed. `strict` (first attempt only) also rejects two shots in the same setting, so
    the corrective retry can fix it; a second plan that still repeats is accepted.
    """
    data = raw.model_dump() if isinstance(raw, CampaignPlan) else raw
    if not isinstance(data, dict):
        raise PlanInvalid("plan is not a JSON object")
    try:
        plan = CampaignPlan.model_validate(data)
    except ValidationError as err:
        raise PlanInvalid(f"plan failed schema validation: {err.errors()[:3]}") from err

    shots = [s for s in plan.shots if s.scene]
    if len(shots) < photo_count:
        raise PlanInvalid(f"plan has {len(shots)} usable shot(s); {photo_count} are required")
    if len(shots) > photo_count:
        logger.info("campaign plan | trimmed %d extra shot(s)", len(shots) - photo_count)
    plan.shots = shots[:photo_count]

    if strict and photo_count > 1:
        labels = [_norm_label(s) for s in plan.shots]
        repeated = sorted({i + 1 for i, lab in enumerate(labels) if labels.count(lab) > 1})
        if repeated:
            raise PlanInvalid(
                f"shots {repeated} share the same environment_label; every photo needs a "
                "visibly different setting within the campaign world"
            )
        ordinary = sum(s.ordinary_setting for s in plan.shots)
        if photo_count >= 3 and ordinary > photo_count // 2:
            raise PlanInvalid(
                f"{ordinary} of {photo_count} shots are in the product's ordinary setting; set at "
                "least half in the world it evokes (unless the brief itself requires otherwise)"
            )

    for i, shot in enumerate(plan.shots):
        shot.index = i + 1
        if not shot.environment_label:
            shot.environment_label = shot.scene[:80]
    return plan


def fallback_plan(brief: str, photo_count: int) -> CampaignPlan:
    """A deliberately plain plan, used only when the director fails twice.

    It assumes nothing about the product category — no invented people, no problem/relief
    story — because it is written without having seen the product.
    """
    beats = [
        ("hero", "medium close-up", "eye-level, straight on", "50mm", "moderate depth of field",
         "The product as the clear hero on a textured natural surface that suits it, a few "
         "complementary props softly out of focus behind it, directional window light.",
         "hero surface with soft background props"),
        ("in context", "medium-wide", "eye-level", "35mm", "moderate depth of field",
         "The product placed where it naturally belongs in a real, lived-in space that fits the "
         "brief, styled with restraint, soft daylight.",
         "real lived-in space where it belongs"),
        ("detail", "close-up", "three-quarter", "85mm", "shallow depth of field",
         "A close view of the product's most characterful detail — material, texture or finish "
         "— with raking side light revealing surface quality.",
         "close detail with raking side light"),
        ("styled vignette", "medium", "slightly high angle", "50mm", "shallow depth of field",
         "The product in a composed still-life vignette with objects that echo its colours and "
         "story, warm late-afternoon light and long soft shadows.",
         "warm still-life vignette"),
        ("mood", "wide", "low angle", "35mm", "deep focus",
         "The product in a dramatic, atmospheric setting with strong single-source light and "
         "deep shadows, generous negative space around it.",
         "dramatic atmospheric setting"),
        ("close", "medium close-up", "eye-level", "50mm", "shallow depth of field",
         "The product in a calm, minimal composition on a plain tonal backdrop, one soft key "
         "light, a quiet closing frame.",
         "minimal tonal backdrop"),
    ]
    shots = []
    for i in range(photo_count):
        purpose, size, angle, lens, dof, scene, label = beats[i % len(beats)]
        shots.append(ShotPlan(
            index=i + 1, purpose=purpose, scene=scene, environment_label=label,
            shot_size=size, camera_angle=angle, lens=lens, depth_of_field=dof,
        ))
    return CampaignPlan(world=CampaignWorld(concept=_clip(brief, _MEDIUM) or ""), shots=shots)


# ── Director prompt ──────────────────────────────────────────────────────────


_DIRECTOR_ROLE = """\
You are the creative team of a top advertising agency — creative director, art director,
copywriter and photographer in one — making a paid social campaign for a real product. You turn
real product photos and a brief into a shot plan an AI image model can render. Work like the
agency the client would hire: every frame has an idea, the set feels crafted and surprising,
and nothing looks like a stock catalogue or a template. You make decisions, not descriptions:
every field is a choice you would commit to on set."""


_READ_THE_PRODUCT = """\
READ THE PRODUCT FIRST. Before planning, study the attached product photos and decide:
- What it is (category) and who it is for.
- Its cultural, emotional or usage world — the specific symbols, stories, rituals, materials
  and places that belong to THIS product. If it depicts a deity, person or story, name who it
  is and use their own iconography: Sree Krishna brings a bansuri flute, peacock feathers,
  makhan in a clay matki, Vrindavan and the Yamuna at dusk, kadamba trees, cows, tulsi and
  gopis; Shiva brings a brass diya, rudraksha, a trishul, a Shivling, bilva leaves and Kailash
  snow. Use only this subject's own symbols — never another deity's (rudraksha and a trishul
  belong to Shiva, not Krishna). A skincare serum belongs on a sunlit marble vanity with water
  droplets and linen;
  hiking boots belong on wet rock at dawn. Build the campaign inside that world. Generic rooms,
  empty walls and plain studio sweeps are the failure you are here to avoid.
- is_flat_artwork: true when the product is a painting, print, poster, canvas, illustration or
  photograph — its image IS the product.
- detail_lock: every fine detail a viewer would notice changing, each one short, literal and
  checkable. Faces and figures (eyes open or closed, gaze direction, expression, profile or
  frontal, pose, how much of the face is shown), how many of each element and where, which way
  things face, colours of specific regions, marks and patterns, borders and edges, printed text
  verbatim. For flat artwork, always state the picture's crop and background (e.g. "eyes-only
  horizontal band, forehead to nose tip, between two black stripes") and anything a viewer
  might expect that is absent (e.g. "no trishul or damaru in the picture"). For a product with
  a label, the brand name and label layout. Describe only what is visible."""


_STYLE = """\
VISUAL STYLE AND TYPE — decide these once, for the whole campaign.
- visual_style: the medium every image is made in. Follow the brief: realistic, cinematic,
  illustrated, cartoon or storybook, anime, 3D or clay render, watercolour, paper-cut, retro
  poster — whatever it asks for, committed to fully. When the brief doesn't say, choose premium
  editorial photography with cinematic, motivated light. Use what AI imagery can do that a
  normal shoot can't — impossible locations, magical light, scale play, dreamlike touches — when
  it serves the idea and suits the brand.
- typography: one type direction that belongs to this product's world, never a default. Name
  the typeface character, weight, colour and finish: e.g. "elegant high-contrast serif in warm
  gold leaf", "hand-painted brush lettering in vermilion", "delicate calligraphic script with a
  small serif subline", "condensed editorial serif in ivory". A plain bold geometric sans is only
  right for a tech, sports or minimalist brand."""


_CAMPAIGN_CRAFT = """\
BUILD ONE CAMPAIGN, NOT N VARIATIONS OF ONE PHOTO.
- world: one concept sentence and a shared look (palette, grade, light character) so the set
  reads as one campaign. The prop kit is a POOL to draw from, not a set every photo repeats.
- Every shot carries its own idea: a distinct moment, symbol or story beat — not just a new
  place to put the product. An idea is a specific visual situation a camera could capture,
  not an adjective: "the bansuri laid on the frame's ledge, a diya's glow in its holes", not
  "the divine gaze drawing the viewer in". Range across: the arresting cover; a story or ritual moment (a
  hand lighting the diya, a child looking up at it); a symbol that tells the story (the flute
  laid where the gaze falls, a peacock feather lit by lamp light); a grand environmental frame
  (a haveli corridor, a temple courtyard at dusk, the product in the world it evokes); a
  person's life with it; craft and material up close.
- Go beyond the ordinary setting. Every product has an everyday place it is used or kept —
  home for décor, a bathroom shelf for skincare, a desk for a laptop, a kitchen counter for a
  kettle. With 3 or more shots, at least half leave it for the world the product evokes: a
  serum in a misty rainforest spring, boots on a glacier ridge at dawn, a devotional painting
  on an easel in a Vrindavan grove. The product is still real, whole and the hero there. Mark
  each shot's ordinary_setting true or false.
- One shot gives the subject's most recognisable symbol a starring role (for Krishna, the
  bansuri; for Ganesha, modak; for a watch, its movement).
- Variety is required. No two shots share a setting type, shot size, camera angle, time of day,
  dominant prop or text placement. Each prop appears in at most two shots. At most one shot may
  be a plain "hung on a wall above a shelf or console" placement.
- Scenes are rich and specific: named surfaces and materials, 3-6 props placed with intent,
  light direction and quality, atmosphere (smoke, dust in light, steam, petals, reflections).
  A scene a prop stylist could build from your words.
- People only where they serve the product and the brief (apparel on a model, a hand lighting a
  diya beside the painting). Never force a "problem, then relief" story onto a product that does
  not solve a problem.
- Photo 1 is the cover: the single strongest, most arresting image of the set.
- The product is the unmistakable hero of every photo — in sharp focus, at a readable scale,
  never covered by props or hands, never tiny or cropped out.
- For flat artwork, keep the artwork facing the camera — straight on or at a gentle angle — so
  its image stays fully legible; never place it where the picture itself would be distorted or
  hidden. A detail shot shows the real artwork's paper, stroke or frame edge — never a part of
  the picture that is not in the reference.
- THE BRIEF OUTRANKS EVERY DEFAULT ABOVE. If it names a setting, person, prop, mood, style or
  theme, that is required, not optional."""


_IMAGE_MODEL_LIMITS = """\
WHAT THE IMAGE MODEL CAN AND CANNOT DO.
- One image per frame: one camera, one moment. No collages, split screens or panels unless
  the brief explicitly asks for them.
- It redraws the product from the photos and drifts on what it cannot see, so show the product
  from angles the photos support and keep detail_lock details visible and unobstructed.
- Text renders unreliably. The only generated text is the headline (and optional subtext) you
  write. No other signs, captions, labels or invented lettering in the scene."""


_TEXT_RULES = """\
ON-IMAGE WORDS — write them like the campaign's copywriter.
- headline: 2-5 words with a point of view — a feeling, a line of poetry, a promise, a question,
  a playful turn — rooted in THIS product's story and audience. It should make someone stop.
  Where the brand and audience are Indian, a short phrase in their language written in Latin
  script is welcome ("Bansi ki dhun", "Radhe Radhe"), if it is simple to spell.
- Write a real line, not a label: it has a verb, a twist or a voice. "Skin that stops
  arguing", "Nothing added. Nothing missing.", "Thanda matlab…", "Made for monsoon afternoons".
  Those show the kind of line — write your own for this product; never reuse an example.
  A two-word noun phrase is a failure — "Divine Gaze", "Gentle Embrace", "Nature's Calm",
  "Serene Presence". Never generic filler: elevate, sacred space, timeless, serene, stunning,
  divine beauty, pure bliss.
- Vary the shape across the set: no two headlines with the same structure.
- subtext: 3-6 words only when it adds something concrete (hand-drawn in charcoal, ships
  framed); otherwise "". Not an "X, Y" pair of adjectives.
- The cover always has a headline. One other shot may carry no words at all, letting the image
  speak.
- text_treatment: where and how the words live in THIS frame, different in every shot —
  placement, size and whether they sit over the image or inside the scene (embossed on the
  mount below the art, lettered on a paper tag, set into the dusk sky, small and elegant in a
  corner beside a thin rule). They never cover the product.
- Short and plainly spelled — every extra word is a chance for a rendering mistake. Match the
  language the brief is written in."""


_OUTPUT_SCHEMA = """\
OUTPUT: ONLY a JSON object with this shape.
{
  "product": {"category": "...", "description": "visible facts only", "is_flat_artwork": false,
              "detail_lock": ["one literal fine detail", "..."], "context": "the world it belongs to"},
  "world": {"concept": "one sentence", "visual_style": "under 10 words",
            "typography": "under 10 words",
            "setting": "setting family", "prop_kit": ["...", "..."],
            "lighting": "...", "palette": "...", "grade": "..."},
  "shots": [
    {
      "purpose": "cover|story|symbol|ritual|lifestyle|environment|detail|...",
      "idea": "the one creative idea of this frame",
      "ordinary_setting": false,
      "scene": "the full physical scene: surfaces, background, props placed, atmosphere",
      "environment_label": "5-10 words naming just this setting",
      "props": ["...", "..."],
      "product_placement": "where the product sits and how it faces the camera",
      "subject": "a person and what they do, only if one is in the shot",
      "shot_size": "...", "camera_angle": "...", "lens": "...", "depth_of_field": "...",
      "composition": "...", "lighting": "this shot's light within the world",
      "mood": "...", "headline": "...", "subtext": "", "text_treatment": "..."
    }
  ]
}
Write values as tight production shorthand, not prose paragraphs."""


def build_director_system(photo_count: int) -> str:
    return "\n\n".join([
        _DIRECTOR_ROLE,
        f"This campaign has EXACTLY {photo_count} photo(s).",
        _READ_THE_PRODUCT,
        _STYLE,
        _CAMPAIGN_CRAFT,
        _IMAGE_MODEL_LIMITS,
        _TEXT_RULES,
        _OUTPUT_SCHEMA,
    ])


def _brand_context(brand_kit: BrandKit | None, platform: str, use_brand_colors: bool) -> str:
    if not brand_kit:
        return ""
    parts = []
    # "My Company" is BrandKit's placeholder default, not a real brand.
    if brand_kit.company_name and brand_kit.company_name != "My Company":
        parts.append(f"Brand: {brand_kit.company_name}.")
    if brand_kit.company_description:
        parts.append(f"What they do: {brand_kit.company_description[:200]}.")
    tone = get_platform_tone(brand_kit, platform)
    if tone:
        parts.append(f"Tone on {platform}: {tone}.")
    if brand_kit.brand_voice and brand_kit.brand_voice != tone:
        parts.append(f"Brand voice: {brand_kit.brand_voice}.")
    if brand_kit.target_audience:
        parts.append(f"Target audience: {brand_kit.target_audience}.")
    if use_brand_colors:
        colors = [f"{k}: {v}" for k, v in (brand_kit.brand_colors or {}).items() if v]
        if colors:
            parts.append(
                "Brand colours (weave into props, backgrounds and grade where they suit the "
                f"product's world — never recolour the product): {', '.join(colors)}."
            )
    return " ".join(parts)


def _build_user_prompt(
    *, brief: str, photo_count: int, platform: str, aspect_ratio: str,
    brand_kit: BrandKit | None, use_brand_colors: bool, num_product_images: int,
) -> str:
    sections = [f"BRIEF: {brief.strip()}"]
    brand = _brand_context(brand_kit, platform, use_brand_colors)
    if brand:
        sections.append(brand)
    sections.append(f"Photos: {photo_count}. Platform: {platform}. Aspect ratio: {aspect_ratio}.")
    sections.append(
        f"The {num_product_images} attached image(s) are photos of the REAL product, possibly "
        "rough snapshots. Study them at full detail — ignore their own poor lighting, angle and "
        "background — and plan the campaign around what you see."
    )
    return "\n\n".join(sections)


def _prepare_for_director(image: tuple[bytes, str]) -> tuple[bytes, str]:
    """Downscale an oversized upload for the director; small images pass through untouched."""
    data, mime = image
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        if max(img.size) <= _DIRECTOR_IMAGE_SIDE:
            return data, mime
        img = img.convert("RGB")
        img.thumbnail((_DIRECTOR_IMAGE_SIDE, _DIRECTOR_IMAGE_SIDE), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return buf.getvalue(), "image/jpeg"
    except Exception as err:
        logger.warning("director image prep failed, sending original | %s", err)
        return data, mime


async def plan_campaign(
    llm: LLMClient,
    *,
    brief: str,
    photo_count: int,
    platform: str,
    aspect_ratio: str,
    product_images: list[tuple[bytes, str]],
    brand_kit: BrandKit | None = None,
    use_brand_colors: bool = True,
) -> CampaignPlan:
    """Plan a photo campaign. One vision call; one corrective retry only if the output is
    unusable; a plain deterministic plan if both fail. Never raises for a bad plan."""
    if settings.MOCK_MODE or not product_images:
        if not settings.MOCK_MODE:
            logger.error("image_pipeline_degraded=campaign_director | no product images fetched")
        return fallback_plan(brief, photo_count)

    system = build_director_system(photo_count)
    user = _build_user_prompt(
        brief=brief, photo_count=photo_count, platform=platform, aspect_ratio=aspect_ratio,
        brand_kit=brand_kit, use_brand_colors=use_brand_colors,
        num_product_images=len(product_images),
    )
    images = [_prepare_for_director(img) for img in product_images]

    error: str | None = None
    for attempt in range(2):
        prompt = f"{system}\n\n{user}" if error is None else (
            f"{system}\n\n{user}\n\nYOUR PREVIOUS PLAN WAS REJECTED: {error}. Return a corrected "
            f"JSON plan with exactly {photo_count} shot(s), each with a scene and headline."
        )
        try:
            raw = await llm.complete_with_vision_multi(files=images, prompt=prompt, json_mode=True)
            plan = validate_plan(safe_json_loads(raw), photo_count, strict=attempt == 0)
            logger.info(
                "campaign plan ready | category=%s flat_artwork=%s details=%d shots=%d",
                plan.product.category, plan.product.is_flat_artwork,
                len(plan.product.detail_lock), len(plan.shots),
            )
            return plan
        except PlanInvalid as err:
            error = str(err)
        except Exception as err:  # provider, parse
            error = f"{type(err).__name__}: {err}"
        logger.warning("campaign director attempt %d failed | %s", attempt + 1, error)

    logger.error(
        "image_pipeline_degraded=campaign_director | using fallback plan | photos=%d reason=%s",
        photo_count, error,
    )
    return fallback_plan(brief, photo_count)

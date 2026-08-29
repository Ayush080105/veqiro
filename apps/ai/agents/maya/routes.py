import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("agents")

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from core.brand_kit import load_brand_kit, get_platform_tone
from core.image_gen import generate_social_image, _fetch_asset
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse, ImageResult, VideoResult
from core.video_gen import (
    build_video_prompt,
    build_logo_animation_prompt,
    generate_maya_video,
    generate_video_storyboard,
    plan_video_scenes,
    plan_video_scenes_with_images,
    plan_video_scenes_from_storyboard,
    add_logo_instruction,
    add_product_fidelity_guardrail,
    build_segment_prompts,
    segments_for,
    BEATS_PER_SEGMENT,
    LOGO_ANIMATION_STYLES,
)
from core.llm import (
    MAX_VIDEO_SECONDS,
    VIDEO_SEGMENT_SECONDS,
    VIDEO_SEGMENT_ATTEMPTS,
    VIDEO_SEGMENT_TIMEOUT,
)
from core.config import settings
from agents.maya.agent import MayaAgent, PLATFORM_RULES

router = APIRouter(prefix="/ai/maya", tags=["Maya"])

# Shared instances
from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = MayaAgent(_llm, _rag)
register_agent(_agent)


# ── Request / Response Models ────────────────────────────────────────────────

class PastIdea(BaseModel):
    title: str
    hook: str
    contentType: str


class IdeationRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    platform: str = Field("linkedin", pattern="^(linkedin|twitter|instagram)$")
    topic_hint: str = Field("", max_length=500)
    count: int = Field(3, ge=1, le=10)
    include_image: bool = False
    use_logo: bool = False
    use_mascot: bool = False
    use_brandkit: bool = False
    past_ideas: list[PastIdea] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "platform": "linkedin",
                "topic_hint": "AI productivity for founders",
                "count": 3,
                "include_image": True,
                "use_logo": False,
                "use_mascot": False,
            }
        }
    )


class ContentIdea(BaseModel):
    title: str
    content_type: str
    platform: str
    hook: str
    predicted_engagement: str
    reasoning: str
    suggested_hashtags: list[str]
    visual_description: str = ""


class IdeationResponse(BaseModel):
    ideas: list[ContentIdea]
    generated_at: str
    image: ImageResult | None = None
    tokens_used: int = 0
    model_used: str = ""


class BrandImageRef(BaseModel):
    url: str
    prompt: str | None = None


class DraftRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    topic: str = Field(..., min_length=1, max_length=500)
    platform: str = Field("linkedin", pattern="^(linkedin|twitter|instagram)$")
    tone_override: str | None = Field(None, max_length=100)
    word_count_target: int = Field(200, ge=20, le=2000)
    include_image: bool = False
    use_logo: bool = False
    use_mascot: bool = False
    use_brand_colors: bool = True
    additional_context: str | None = Field(None, max_length=1000)
    from_rex: bool = False
    image_aspect_ratio: str = Field("1:1", pattern="^(1:1|16:9|9:16|4:3)$")
    use_reference: bool = False
    reference_images: list[str] = Field(default_factory=list, max_length=5)
    brand_images: list[BrandImageRef] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "topic": "How AI is saving founders 10 hours per week",
                "platform": "linkedin",
                "tone_override": None,
                "word_count_target": 250,
                "include_image": True,
                "use_logo": True,
                "use_mascot": False,
                "additional_context": "Focus on time-saving benefits",
                "use_reference": False,
                "reference_images": [],
            }
        }
    )


class DraftContent(BaseModel):
    title: str
    body: str
    hashtags: list[str]
    cta: str
    meta_description: str
    word_count: int
    platform: str
    tone_used: str


class DraftResponse(BaseModel):
    draft: DraftContent
    image: ImageResult | None = None
    tokens_used: int = 0
    model_used: str = ""


def _strip_duplicate_cta_hashtags(draft: DraftContent) -> DraftContent:
    """Remove CTA and hashtag lines that the LLM leaked into the body field.

    LLMs frequently write the complete post inside `body` (including CTA + hashtags)
    even when instructed to keep them separate. This strips the trailing duplication
    so the UI doesn't render those sections twice.
    """
    body = draft.body.rstrip()

    # 1. Strip trailing hashtag lines — lines where every non-empty token starts with #
    lines = body.split("\n")
    while lines:
        stripped_line = lines[-1].strip()
        if not stripped_line:
            lines.pop()
            continue
        tokens = stripped_line.split()
        if tokens and all(t.startswith("#") for t in tokens):
            lines.pop()
        else:
            break
    body = "\n".join(lines).rstrip()

    # 2. Strip the CTA from the end of body (exact match after stripping whitespace)
    cta = (draft.cta or "").strip()
    if cta and body.endswith(cta):
        body = body[: -len(cta)].rstrip()

    # 3. Normalise hashtags — strip leading # if the LLM included it despite instructions
    hashtags = [h.lstrip("#") for h in draft.hashtags if h.strip()]

    return DraftContent(
        title=draft.title,
        body=body,
        hashtags=hashtags,
        cta=draft.cta,
        meta_description=draft.meta_description,
        word_count=len(body.split()),
        platform=draft.platform,
        tone_used=draft.tone_used,
    )


class VariantRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    original_content: str = Field(..., min_length=1, max_length=5000)
    original_platform: str = Field("linkedin", pattern="^(linkedin|twitter|instagram)$")
    target_platforms: list[str] = Field(["twitter", "instagram"], min_length=1, max_length=3)
    include_images: bool = False
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "original_content": "We just launched our AI productivity suite for founders...",
                "original_platform": "linkedin",
                "target_platforms": ["twitter", "instagram"],
                "include_images": False,
            }
        }
    )


class ContentVariant(BaseModel):
    platform: str
    title: str
    body: str
    hashtags: list[str]
    char_count: int
    image: ImageResult | None = None


class VariantResponse(BaseModel):
    variants: list[ContentVariant]
    tokens_used: int = 0
    model_used: str = ""


class ReviseRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    original_content: str = Field(..., min_length=1, max_length=5000)
    platform: str = Field("linkedin", pattern="^(linkedin|twitter|instagram)$")
    feedback: str = Field(..., min_length=1, max_length=1000)
    specific_instructions: str | None = Field(None, max_length=500)
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "original_content": "We launched our AI tool today. It saves time.",
                "platform": "linkedin",
                "feedback": "Too vague, needs more specific benefits and a stronger hook",
                "specific_instructions": "Add a statistic in the first line",
            }
        }
    )


class RevisedContent(BaseModel):
    title: str
    body: str
    hashtags: list[str]
    cta: str


class ReviseResponse(BaseModel):
    revised: RevisedContent
    changes_made: list[str]
    platform: str = "linkedin"
    tokens_used: int = 0
    model_used: str = ""


# ── Carousel Models ──────────────────────────────────────────────────────────

class CarouselDraftRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    topic: str = Field(..., min_length=1, max_length=500)
    platform: str = Field("linkedin", pattern="^(linkedin|twitter|instagram)$")
    carousel_count: int = Field(3, ge=2, le=8)
    tone_override: str | None = Field(None, max_length=100)
    include_images: bool = True
    use_logo: bool = False
    use_mascot: bool = False
    use_brand_colors: bool = True
    additional_context: str | None = Field(None, max_length=1000)
    image_aspect_ratio: str = Field("1:1", pattern="^(1:1|16:9|9:16|4:3)$")
    brand_images: list[BrandImageRef] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class CarouselSlide(BaseModel):
    slide_number: int
    image: ImageResult | None = None


class CarouselDraftResponse(BaseModel):
    draft: DraftContent        # single caption for the whole post
    slides: list[CarouselSlide]  # one image per swipeable slide
    platform: str
    tokens_used: int = 0
    model_used: str = ""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _mock_ideas(count: int, _topic_hint: str) -> list[ContentIdea]:
    return [
        ContentIdea(
            title="How We Used AI to Save 10 Hours/Week Running Our Startup",
            content_type="linkedin_post",
            platform="linkedin",
            hook="10 hours. Every week. Back in our founders' calendars.",
            predicted_engagement="High – personal story + specific number",
            reasoning="Founder pain point + concrete benefit drives high LinkedIn engagement",
            suggested_hashtags=["#Founders", "#AIProductivity", "#StartupLife", "#TimeManagement"],
            visual_description=(
                "Split-panel graphic: left side shows a cluttered, stressed workspace (dark tones); "
                "right side shows the same desk clean and calm with a glowing laptop screen. "
                "Bold text overlay: '10 Hours Saved Every Week'. "
                "Use brand primary color for the dividing line. Professional, aspirational mood. "
                "No people's faces — focus on the workspace transformation."
            ),
        ),
        ContentIdea(
            title="5 Signs Your Startup Is Ready to Go Full AI-First",
            content_type="instagram_post",
            platform="instagram",
            hook="Most founders wait too long. Here are the 5 green lights.",
            predicted_engagement="Very High – checklist format drives saves",
            reasoning="Checklist posts on Instagram get saved 3x more than text posts — high share potential",
            suggested_hashtags=["#StartupLife", "#AIFirst", "#FounderTips", "#ProductivityHacks", "#TechStartup"],
            visual_description=(
                "Clean numbered checklist layout on a dark background with brand accent colors. "
                "5 short bold statements, each with a checkmark icon. "
                "Brand logo small in the bottom corner. "
                "Modern sans-serif typography, high contrast. "
                "Minimalist design — no clutter, just the list items on a gradient background."
            ),
        ),
        ContentIdea(
            title="The Hidden Cost of Not Using AI as a Founder",
            content_type="linkedin_post",
            platform="linkedin",
            hook="Every week you delay costs you roughly 12 hours of compounded work.",
            predicted_engagement="High – loss aversion framing performs strongly",
            reasoning="Loss aversion messaging consistently outperforms gain framing by 2x on LinkedIn",
            suggested_hashtags=["#FounderMindset", "#AITools", "#Productivity", "#StartupGrowth"],
            visual_description=(
                "Dramatic comparison graphic: two timelines side by side. "
                "Left: 'Without AI' — red downward arrow with mounting task icons. "
                "Right: 'With AI' — green upward arrow with clean workflow icons. "
                "Dark professional background. Title text bold and centered at top. "
                "Brand colors used for the arrows. No stock photos — pure graphic design."
            ),
        ),
        ContentIdea(
            title="One Tool That Changed How We Write Content Forever",
            content_type="instagram_post",
            platform="instagram",
            hook="We used to spend 3 hours on one post. Now it's 20 minutes.",
            predicted_engagement="Medium-High – relatable founder journey",
            reasoning="Before/after transformations with time savings resonate strongly with creator and founder audiences",
            suggested_hashtags=["#ContentCreation", "#AIWriting", "#FounderLife", "#SmallBusiness", "#WorkSmarter"],
            visual_description=(
                "Before/after phone mockup: left phone shows a blank document with a blinking cursor (stressed emoji overlay); "
                "right phone shows a finished polished post with engagement metrics. "
                "Bright, energetic color scheme matching brand palette. "
                "Text overlay: 'From 3 hours → 20 minutes'. "
                "Clean product-screenshot style with subtle drop shadows."
            ),
        ),
        ContentIdea(
            title="Why Every Founder Needs a Weekly AI Review Session",
            content_type="linkedin_post",
            platform="linkedin",
            hook="30 minutes every Friday. The best calendar block you're not using.",
            predicted_engagement="Medium – actionable routine advice performs consistently",
            reasoning="Actionable habit-based content gets bookmarked and shared by productivity-focused founders",
            suggested_hashtags=["#WeeklyReview", "#FounderHabits", "#AIWorkflow", "#TimeManagement"],
            visual_description=(
                "Calendar/planner visual with one Friday slot highlighted in brand primary color, "
                "labeled 'AI Review — 30 min'. "
                "Surrounding slots show typical busy calendar items in muted grey. "
                "Clean flat design style. "
                "Subtext: 'The meeting that pays for itself 10x'. "
                "Minimal, professional feel — no illustrations, just clean layout."
            ),
        ),
    ][:count]


def _mock_draft(topic: str, platform: str, tone: str) -> DraftContent:
    body = (
        f"I just discovered something that changed how I think about {topic}.\n\n"
        "Last quarter, our team was spending 3+ hours daily on tasks that should take 20 minutes.\n\n"
        "Here's what we changed:\n\n"
        "✅ Automated content ideation (saved 5 hrs/week)\n"
        "✅ AI-assisted data analysis (saved 4 hrs/week)\n"
        "✅ Intelligent email triage (saved 3 hrs/week)\n\n"
        "Result? 12 recovered hours per week. That's 48 hours/month — basically a full extra work week.\n\n"
        "The founders who win in 2025 won't be the ones working hardest.\n"
        "They'll be the ones working smartest.\n\n"
        "What's one repetitive task you wish you could automate? Drop it below 👇"
    )
    return DraftContent(
        title=f"How We Recovered 12 Hours/Week Using AI – A Founder's Honest Breakdown",
        body=body,
        hashtags=["#FounderLife", "#AIProductivity", "#StartupTips", "#TimeManagement", "#SaaS"],
        cta="Share what task you'd automate first in the comments below 👇",
        meta_description=f"Discover how one founder team used AI to recover 12 hours per week – practical breakdown of tools and workflows.",
        word_count=len(body.split()),
        platform=platform,
        tone_used=tone or "professional, authentic",
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Maya chat")
async def maya_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Maya's response as a standard JSON response."""
    try:
        return await _agent.chat_sync(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-ideas", response_model=IdeationResponse, summary="Generate content ideas")
async def generate_ideas(request: IdeationRequest) -> IdeationResponse:
    """Generate content ideas for a given topic and content type."""
    brand_kit = await load_brand_kit(request.organization_id) if request.use_brandkit else None

    if settings.MOCK_MODE:
        image = None
        if request.include_image:
            try:
                image = await generate_social_image(
                    request.topic_hint or "content ideas", request.platform,
                    use_logo=request.use_logo, use_mascot=request.use_mascot,
                    user_id=request.user_id, organization_id=request.organization_id,
                )
            except Exception as _img_err:
                logger.error("image_gen failed | user=%s error=%s", request.user_id, _img_err)
        topic = (brand_kit.company_name if brand_kit else None) or request.topic_hint
        return IdeationResponse(
            ideas=_mock_ideas(request.count, topic),
            generated_at=datetime.now(timezone.utc).isoformat(),
            image=image,
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    rules = PLATFORM_RULES.get(request.platform, PLATFORM_RULES["linkedin"])

    if brand_kit:
        context = (
            f"Company: {brand_kit.company_name}\n"
            f"Description: {brand_kit.company_description}\n"
            f"Industry: {brand_kit.industry}\n"
            f"Target audience: {brand_kit.target_audience or 'startup founders'}\n"
        )
        topic_line = f"Generate {request.count} high-performing {request.platform} content ideas tailored to this company:\n{context}"
    else:
        topic_line = f"Generate {request.count} high-performing content ideas for {request.platform} about: {request.topic_hint}"

    dedupe_block = ""
    if request.past_ideas:
        lines = "\n".join(
            f"{i + 1}. {idea.title} | {idea.contentType} | Hook: {idea.hook}"
            for i, idea in enumerate(request.past_ideas)
        )
        dedupe_block = (
            f"\nPREVIOUSLY GENERATED IDEAS – Do NOT repeat or closely paraphrase "
            f"these topics, angles, or hooks:\n{lines}\n"
            f"Produce ideas that explore entirely DIFFERENT angles, formats, and narratives "
            f"from the list above.\n"
        )

    from agents.maya.agent import build_ideas_prompt
    prompt = (
        build_ideas_prompt(request.platform, request.count, rules, topic_line, dedupe_block)
        + '\nReturn ONLY a JSON object of the shape {"ideas": [ ... ]} with the fields above per idea.'
    )
    try:
        data = await _llm.complete_json(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        ideas_data = data.get("ideas", data) if isinstance(data, dict) else data
        ideas = [ContentIdea(**i) for i in ideas_data]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Idea generation returned unparseable data — retry. ({exc})")
    tokens_used = sum(_llm.count_tokens(i.model_dump_json()) for i in ideas)

    image = None
    if request.include_image:
        try:
            top = ideas[0] if ideas else None
            image = await generate_social_image(
                request.topic_hint or (top.title if top else "content"), request.platform,
                use_logo=request.use_logo, use_mascot=request.use_mascot,
                user_id=request.user_id, organization_id=request.organization_id,
                # visual_description is authored as the image prompt for this idea —
                # use it to drive the concept/elaboration steps instead of ignoring it.
                concept_hint=(top.visual_description if top else "") or "",
                context_hints=(f"hook: {top.hook}" if top and top.hook else ""),
            )
        except Exception:
            pass

    return IdeationResponse(
        ideas=ideas,
        generated_at=datetime.now(timezone.utc).isoformat(),
        image=image,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


@router.post("/draft-content", response_model=DraftResponse, summary="Draft content piece")
async def draft_content(request: DraftRequest) -> DraftResponse:
    """Draft a full content piece for a given platform and topic."""
    brand_kit = await load_brand_kit(request.organization_id)
    tone = request.tone_override or get_platform_tone(brand_kit, request.platform)

    if settings.MOCK_MODE:
        draft = _mock_draft(request.topic, request.platform, tone)
        image = None
        if request.include_image:
            try:
                image = await generate_social_image(
                    request.topic, request.platform,
                    aspect_ratio=request.image_aspect_ratio,
                    use_logo=request.use_logo, use_mascot=request.use_mascot,
                    user_id=request.user_id, organization_id=request.organization_id,
                    brand_kit=brand_kit,
                    context_hints=request.additional_context or "",
                    reference_urls=request.reference_images if request.use_reference else [],
                    brand_images=request.brand_images or [],
                    use_brand_colors=request.use_brand_colors,
                )
            except Exception as _img_err:
                logger.error("image_gen failed | user=%s error=%s", request.user_id, _img_err)
        return DraftResponse(draft=draft, image=image)

    rules = PLATFORM_RULES.get(request.platform, PLATFORM_RULES["linkedin"])
    website_line = f"Include this website link in the CTA where natural: {brand_kit.website_url}" if brand_kit.website_url else ""
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"

    # When context comes from Rex (internal analytics), distill it into a clean marketing brief
    # so internal metrics like churn risk counts don't leak into the public post.
    effective_context = request.additional_context
    if request.from_rex and request.additional_context:
        distill_prompt = (
            "You are a marketing strategist converting internal data findings into a campaign brief.\n\n"
            f"Internal analysis:\n{request.additional_context}\n\n"
            "Write a 2-3 sentence brief for a promotional social media post. Describe:\n"
            "- What product, plan, or service to promote\n"
            "- Its key customer-facing benefits (what the customer gets — features, value, reliability, savings, etc.)\n"
            "- Any compelling value points that would make someone want to choose it\n\n"
            "Write from the CUSTOMER'S perspective — what makes this worth buying or switching to.\n"
            "Do NOT include: internal business metrics, churn risk labels, at-risk counts, retention strategy language, "
            "or anything framed as an internal business goal.\n"
            "Return only the brief."
        )
        effective_context = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system="You are a precise marketing brief writer. Return only the brief, no preamble.",
            messages=[{"role": "user", "content": distill_prompt}],
        )

    from agents.maya.agent import build_draft_rules
    prompt = (
        f"Write a ready-to-publish {request.platform} post about this topic: {request.topic}\n"
        f"Tone: {tone}\n"
        f"Additional context: {effective_context or 'None'}\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags\n"
        f"{website_line}\n\n"
        f"{build_draft_rules(request.platform)}\n"
        "Return JSON with these exact fields: title, body, hashtags (list of strings WITHOUT the # symbol), cta, meta_description, word_count, platform, tone_used.\n"
        "CRITICAL FIELD RULES:\n"
        "- `body`: the post text ONLY — do NOT append the CTA or hashtags here. Body ends before the CTA.\n"
        "- `cta`: the call-to-action sentence/line only — do NOT repeat it in body.\n"
        "- `hashtags`: list of tag strings only, e.g. [\"Veqiro\", \"AI\"] — do NOT include them in body.\n"
        "Return ONLY the JSON object, no markdown fences."
    )
    try:
        data = await _llm.complete_json(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        draft = DraftContent(**data)
        draft = _strip_duplicate_cta_hashtags(draft)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Draft generation failed — retry. ({exc})")
    tokens_used = _llm.count_tokens(draft.model_dump_json())

    image = None
    logger.info("draft_content | include_image=%s user=%s", request.include_image, request.user_id)
    if request.include_image:
        try:
            # Feed the generated caption into context_hints so the creative concept
            # aligns to what the post actually says, not just the raw topic keyword.
            _caption_context = "\n".join(filter(None, [
                draft.title,
                draft.body[:600],
                request.additional_context or "",
            ]))
            image = await generate_social_image(
                request.topic, request.platform,
                aspect_ratio=request.image_aspect_ratio,
                use_logo=request.use_logo, use_mascot=request.use_mascot,
                user_id=request.user_id, organization_id=request.organization_id,
                brand_kit=brand_kit,
                context_hints=_caption_context,
                # User-authored additional_context carries the most specific, non-negotiable
                # instructions (explicit subjects, props, themes). Put it first so it survives
                # the concept/elaboration truncation window even when the caption is long.
                concept_hint="\n".join(filter(None, [
                    request.additional_context or "",
                    draft.title,
                    draft.body[:300],
                ])),
                reference_urls=request.reference_images if request.use_reference else [],
                brand_images=request.brand_images or [],
                use_brand_colors=request.use_brand_colors,
            )
        except Exception as _img_err:
            logger.error("image_gen failed | user=%s error=%s", request.user_id, _img_err)
    return DraftResponse(draft=draft, image=image, tokens_used=tokens_used, model_used=_agent.default_model)


@router.post("/generate-variants", response_model=VariantResponse, summary="Generate platform variants")
async def generate_variants(request: VariantRequest) -> VariantResponse:
    """Adapt content for multiple platforms."""
    if settings.MOCK_MODE:
        variants = [
            ContentVariant(
                platform="twitter",
                title="Twitter Thread",
                body=(
                    "🧵 We just changed how we build content at Veqiro AI.\n\n"
                    "Here's the system that's saving us 8+ hours/week:\n\n"
                    "1/ Stop writing from scratch. Use AI to generate 10 angles, pick the best 3.\n\n"
                    "2/ Repurpose every long-form piece into 5 platform-native formats.\n\n"
                    "3/ Let data tell you what to double down on. Not gut feelings.\n\n"
                    "The result? More content, less burnout.\n\nRT if this helps 🙌"
                ),
                hashtags=["#ContentStrategy", "#AITools", "#Founders"],
                char_count=387,
                image=None,
            ),
            ContentVariant(
                platform="instagram",
                title="Instagram Caption",
                body=(
                    "Building in public means showing the messy middle, not just the wins. 🎯\n\n"
                    "This week we shipped our AI content engine and it's already saving our team 8 hours/week.\n\n"
                    "The best part? It learns your brand voice and gets better every week.\n\n"
                    "Save this post if you want to build a content system that actually scales 👆"
                ),
                hashtags=["#BuildingInPublic", "#AIProductivity", "#StartupLife", "#ContentCreator", "#FounderMode"],
                char_count=312,
                image=None,
            ),
        ]
        return VariantResponse(variants=variants)

    import asyncio
    brand_kit = await load_brand_kit(request.organization_id)
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    website_line = f"Include this link where natural: {brand_kit.website_url}" if brand_kit.website_url else ""

    async def _adapt(platform: str) -> tuple[ContentVariant, int]:
        rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
        prompt = (
            f"Re-imagine this {request.original_platform} content as a NATIVE {platform} post:\n\n"
            f"{request.original_content}\n\n"
            f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, "
            f"tone: {rules['tone']}, format: {rules['format']}\n"
            f"{website_line}\n\n"
            "RE-IMAGINE, DON'T SHORTEN: keep the core insight and any exact numbers, but rebuild the post "
            "the way a native creator on that platform would write it — never just compress or truncate the "
            "original. Twitter: distill to the single sharpest line or claim, punchy and quotable. "
            "Instagram: lead with the feeling or moment, conversational, hashtags in a block at the end. "
            "LinkedIn: lead with the professional stake or lesson. "
            "The hook must be rebuilt natively for the platform — never reuse the original's opening line verbatim.\n\n"
            "Return JSON with: platform, title, body, hashtags (list), char_count. "
            "Return ONLY the JSON object, no markdown fences."
        )
        try:
            data = await _llm.complete_json(
                provider=_agent.default_provider, model=_agent.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            _tokens = _llm.count_tokens(str(data))
            return ContentVariant(**data), _tokens
        except Exception:
            _tokens = 0
            return ContentVariant(
                platform=platform,
                title=f"{platform.capitalize()} variant",
                body=f"[Failed to adapt for {platform} — please retry]",
                hashtags=[],
                char_count=0,
            ), _tokens

    pairs = await asyncio.gather(*[_adapt(p) for p in request.target_platforms])
    variants = [v for v, _ in pairs]
    total_tokens = sum(t for _, t in pairs)
    return VariantResponse(variants=variants, tokens_used=total_tokens, model_used=_agent.default_model)


@router.post("/revise", response_model=ReviseResponse, summary="Revise content with feedback")
async def revise_content(request: ReviseRequest) -> ReviseResponse:
    """Revise existing content based on feedback."""
    if settings.MOCK_MODE:
        return ReviseResponse(
            platform=request.platform,
            revised=RevisedContent(
                title="10 Hours Saved Weekly: Inside Our AI-Powered Founder Workflow",
                body=(
                    "Most founders are drowning in busywork. Here's the system we built to claw back 10 hours every week. 🧵\n\n"
                    "We analyzed 6 months of time logs and found that 67% of our 'work' was repeatable – meaning AI could handle it.\n\n"
                    "Here's what we automated:\n"
                    "→ Content creation: 5 hrs/week saved\n"
                    "→ Data reporting: 3 hrs/week saved\n"
                    "→ Email triage: 2 hrs/week saved\n\n"
                    "The compound effect over a year? An extra 520 hours. That's 13 full work weeks.\n\n"
                    "What would you build with 13 extra weeks?\n\n"
                    "Drop your answer below and I'll share the exact stack we use. 👇"
                ),
                hashtags=["#FounderLife", "#AIProductivity", "#StartupTips", "#TimeManagement"],
                cta="Comment below with your biggest time drain – I'll share our solution 👇",
            ),
            changes_made=[
                "Added specific statistic (67% of work is repeatable) to first paragraph",
                "Changed hook from generic to data-driven",
                "Restructured benefits as scannable bullet points with arrows",
                "Added compound annual calculation for emotional impact",
                "Strengthened CTA with personal engagement hook",
            ],
        )

    rules = PLATFORM_RULES.get(request.platform, PLATFORM_RULES["linkedin"])
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    prompt = (
        f"Revise this {request.platform} content based on feedback:\n\nOriginal:\n{request.original_content}\n\n"
        f"Feedback: {request.feedback}\n"
        f"Specific instructions: {request.specific_instructions or 'None'}\n\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags\n\n"
        "SURGICAL REVISION: change ONLY what the feedback requires — preserve every phrase, hook, and "
        "structural choice that already works. A revision that rewrites the whole post when the feedback "
        "asked for one change is a failure.\n"
        "Each entry in changes_made must quote the actual edit as a before → after fragment "
        "(e.g. 'hook: \"We launched today\" → \"10 hours back, every week\"') — never a vague description "
        "like 'improved the hook'.\n\n"
        "Return JSON with: revised (object with title (string), body (string), "
        "hashtags (array of strings, e.g. [\"#AI\", \"#Productivity\"]), cta (string)), "
        "changes_made (array of strings). "
        "Return ONLY the JSON object, no markdown fences."
    )
    try:
        data = await _llm.complete_json(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
        )
        tokens_used = _llm.count_tokens(str(data))
        return ReviseResponse(**data, platform=request.platform, tokens_used=tokens_used, model_used=_agent.default_model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Content revision failed — retry. ({exc})")


# ── Regeneration Endpoints ──────────────────────────────────────────────────

class ImageRegenRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    image_url: HttpUrl = Field(..., description="URL of the existing image to modify")
    prompt: str = Field(..., min_length=1, max_length=1000)
    use_logo: bool = False
    use_mascot: bool = False
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "image_url": "https://r2.example.com/images/abc.png",
                "prompt": "Make the background more vibrant and professional",
                "use_logo": False,
                "use_mascot": False,
                "platform": "instagram",
            }
        }
    )


class ImageRegenResponse(BaseModel):
    image: ImageResult
    tokens_used: int = 0
    model_used: str = ""


class ContentRegenRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    caption: str = Field(..., min_length=1, max_length=5000)
    prompt: str = Field(..., min_length=1, max_length=1000)
    platform: str = Field("linkedin", pattern="^(linkedin|twitter|instagram)$")
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "caption": "We just launched our new AI tool...",
                "prompt": "Make it more engaging and add a question at the end",
                "platform": "linkedin",
            }
        }
    )


class ContentRegenResponse(BaseModel):
    caption: str
    hashtags: list[str]
    cta: str
    platform: str = "linkedin"
    tokens_used: int = 0
    model_used: str = ""


@router.post("/regenerate-image", response_model=ImageRegenResponse, summary="Regenerate image")
async def regenerate_image(request: ImageRegenRequest) -> ImageRegenResponse:
    """Fetch existing image, modify it with the given prompt, return new base64 image."""
    if settings.MOCK_MODE:
        from core.llm import LLMClient as _LLM
        b64 = await _LLM().generate_image(request.prompt)
        image = ImageResult(image_base64=b64, content_type="image/png", prompt_used=request.prompt)
        return ImageRegenResponse(image=image)

    source_bytes = await _fetch_asset(str(request.image_url))
    last_err: Exception | None = None
    b64: str = ""
    for attempt in range(3):
        try:
            if source_bytes:
                edit_prompt = (
                    f"Based on reference image 1, produce an updated version that applies this specific change: {request.prompt}\n\n"
                    "Preserve the original composition, visual style, colour palette, typography, and all existing elements. "
                    "The output should look identical to the reference image except for the requested change. "
                    "If the change involves text, reproduce every word exactly as specified. "
                    "TEXT FIDELITY: any text in the reference image that is not itself being changed must be "
                    "reproduced letter-for-letter — never re-typeset, respell, paraphrase, or drop it."
                )
                b64 = await _llm.generate_image_with_image_bytes(edit_prompt, [source_bytes])
            else:
                b64 = await _llm.generate_image(request.prompt)
            last_err = None
            break
        except Exception as err:
            last_err = err
            logger.warning("regenerate-image attempt %d/3 failed | error=%s", attempt + 1, err)

    if last_err is not None:
        logger.warning("regenerate-image: all retries failed, falling back to fresh generation | error=%s", last_err)
        try:
            brand_kit = await load_brand_kit(request.organization_id)
            from core.image_gen import generate_social_image
            # The user's text is an EDIT instruction ("make the background more vibrant"),
            # not a topic — passing it as the topic makes the fallback image literally
            # about that instruction. Use a neutral topic and pass the instruction as
            # style/composition guidance instead.
            fallback = await generate_social_image(
                f"a fresh {request.platform} brand image",
                request.platform,
                use_logo=request.use_logo,
                use_mascot=request.use_mascot,
                user_id=request.user_id,
                organization_id=request.organization_id,
                brand_kit=brand_kit,
                context_hints=f"apply this style direction: {request.prompt}",
            )
            image = fallback
        except Exception as fallback_err:
            logger.error("regenerate-image: fallback also failed | error=%s", fallback_err)
            raise last_err
    else:
        image = ImageResult(image_base64=b64, content_type="image/png", prompt_used=request.prompt)
    return ImageRegenResponse(image=image, model_used=settings.GEMINI_IMAGE_MODEL)


@router.post("/regenerate-content", response_model=ContentRegenResponse, summary="Regenerate content")
async def regenerate_content(request: ContentRegenRequest) -> ContentRegenResponse:
    """Revise a caption with a new prompt, returning updated caption with hashtags and CTA."""
    if settings.MOCK_MODE:
        return ContentRegenResponse(
            caption=f"{request.caption}\n\n[Revised: {request.prompt}]",
            hashtags=["#Updated", "#Content"],
            cta="Check it out 👇",
            platform=request.platform,
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    rules = PLATFORM_RULES.get(request.platform, PLATFORM_RULES["linkedin"])
    prompt = (
        f"Revise this {request.platform} caption based on the instruction:\n\n"
        f"Current caption:\n{request.caption}\n\n"
        f"Instruction: {request.prompt}\n\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, "
        f"tone: {rules['tone']}\n\n"
        "SURGICAL REVISION: change ONLY what the instruction requires — preserve every phrase and "
        "structural choice that already works. Do not rewrite the whole caption for a one-line instruction.\n\n"
        "Return JSON with exactly these fields: "
        '"caption" (updated text, ready to publish), "hashtags" (array), "cta" (string). '
        "Return ONLY the JSON object, no markdown fences."
    )
    try:
        data = await _llm.complete_json(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
        )
        tokens_used = _llm.count_tokens(str(data))
        return ContentRegenResponse(**data, platform=request.platform, tokens_used=tokens_used, model_used=_agent.default_model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Content regeneration failed — retry. ({exc})")


# ── Carousel Endpoint ─────────────────────────────────────────────────────────

@router.post("/draft-carousel", response_model=CarouselDraftResponse, summary="Draft carousel post")
async def draft_carousel(request: CarouselDraftRequest) -> CarouselDraftResponse:
    """One caption + N swipeable images. Images generated in parallel for minimal latency."""
    import asyncio
    from core.carousel import build_carousel_content, CarouselImagePrompt

    brand_kit = await load_brand_kit(request.organization_id)
    tone = request.tone_override or get_platform_tone(brand_kit, request.platform)

    if settings.MOCK_MODE:
        from core.image_gen import _PLACEHOLDER_B64
        mock_draft = _mock_draft(request.topic, request.platform, tone)
        mock_slides = [
            CarouselSlide(
                slide_number=i + 1,
                image=ImageResult(
                    image_base64=_PLACEHOLDER_B64,
                    content_type="image/png",
                    prompt_used=f"Mock slide {i+1}",
                ) if request.include_images else None,
            )
            for i in range(request.carousel_count)
        ]
        return CarouselDraftResponse(
            draft=mock_draft,
            slides=mock_slides,
            platform=request.platform,
            tokens_used=0,
            model_used="mock",
        )

    # Step 1: One LLM call → single caption + N image prompts
    try:
        content = await build_carousel_content(
            topic=request.topic,
            platform=request.platform,
            count=request.carousel_count,
            brand_kit=brand_kit,
            llm=_llm,
            additional_context=request.additional_context or "",
            tone=tone,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    draft = DraftContent(
        title=content.caption_title,
        body=content.caption_body,
        hashtags=content.hashtags,
        cta=content.cta,
        meta_description=content.meta_description,
        word_count=content.word_count,
        platform=request.platform,
        tone_used=content.tone_used,
    )

    async def _gen(prompt_data: CarouselImagePrompt, idx: int, anchor_b64: str | None = None) -> ImageResult | None:
        if not request.include_images:
            return None
        text_spec: dict | None = None
        if prompt_data.headline:
            text_spec = {
                "headline": prompt_data.headline,
                "stat": prompt_data.stat,
                "subtext": prompt_data.subtext,
            }
        _hint_parts = [p.strip().strip(".") for p in [
            request.topic,
            content.caption_body[:300],
            prompt_data.context_note,
            request.additional_context or "",
        ] if p and p.strip()]
        _context_hints = ". ".join(_hint_parts)
        # additional_context first: it carries the user's explicit, non-negotiable asks
        # (specific subjects, props, themes) — protect it from the concept-step truncation
        # window instead of leaving it last behind topic/caption/context_note.
        _concept_hint_parts = [p.strip().strip(".") for p in [
            request.additional_context or "",
            prompt_data.context_note,
            request.topic,
        ] if p and p.strip()]
        _concept_hint = ". ".join(_concept_hint_parts)
        last_err: BaseException | None = None
        current_anchor = anchor_b64
        for attempt in range(3):
            if attempt and last_err:
                last_err_str = str(last_err)
                if "429" in last_err_str or "RESOURCE_EXHAUSTED" in last_err_str.upper():
                    await asyncio.sleep(30 + attempt * 30)
                elif "IMAGE_OTHER" in last_err_str and current_anchor:
                    logger.warning("carousel IMAGE_OTHER on anchor | slide=%d dropping anchor for retry", idx + 1)
                    current_anchor = None
                else:
                    await asyncio.sleep(2 * attempt)
            try:
                return await generate_social_image(
                    prompt_data.image_prompt,
                    request.platform,
                    aspect_ratio=request.image_aspect_ratio,
                    use_logo=request.use_logo,
                    use_mascot=request.use_mascot,
                    user_id=request.user_id,
                    organization_id=request.organization_id,
                    brand_kit=brand_kit,
                    context_hints=_context_hints,
                    concept_hint=_concept_hint,
                    text_spec=text_spec,
                    carousel_anchor_b64=current_anchor,
                    brand_images=request.brand_images or [],
                    use_brand_colors=request.use_brand_colors,
                )
            except Exception as img_err:
                last_err = img_err
                logger.warning("carousel image_gen attempt %d/3 failed | slide=%d error=%s", attempt + 1, idx + 1, img_err)
                if attempt == 2:
                    logger.error("carousel image_gen failed after 3 attempts | slide=%d error=%s", idx + 1, img_err)
        return None

    # Slide 1 generated first — defines the character, style, and atmosphere for the carousel.
    # Slides 2+ receive slide 1 as a JPEG style/character reference (JPEG strips AI metadata
    # that triggers Gemini's IMAGE_OTHER policy on PNG anchors).
    slide_1_image = await _gen(content.image_prompts[0], 0, anchor_b64=None)
    anchor_b64 = slide_1_image.image_base64 if slide_1_image else None

    if len(content.image_prompts) > 1:
        rest = await asyncio.gather(
            *[_gen(p, i + 1, anchor_b64=anchor_b64) for i, p in enumerate(content.image_prompts[1:])],
            return_exceptions=True,
        )
    else:
        rest = []

    images = [slide_1_image] + list(rest)

    result_slides = [
        CarouselSlide(
            slide_number=p.slide_number,
            image=images[i] if not isinstance(images[i], Exception) else None,
        )
        for i, p in enumerate(content.image_prompts)
    ]

    logger.info("carousel done | user=%s platform=%s slides=%d", request.user_id, request.platform, len(result_slides))
    return CarouselDraftResponse(
        draft=draft,
        slides=result_slides,
        platform=request.platform,
        tokens_used=0,
        model_used=_agent.default_model,
    )


# ── Expand Brief ─────────────────────────────────────────────────────────────

class ExpandBriefRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    brief: str = Field(..., min_length=1, max_length=500)
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
    product_image_base64: str | None = None
    product_image_url: str | None = None
    metadata: dict = Field(default_factory=dict)


class ExpandBriefResponse(BaseModel):
    expanded: str


_EXPAND_SYSTEM = (
    "You are a world-class creative director and brand photographer with 20 years of "
    "experience shooting product campaigns for global brands. "
    "You receive a rough campaign idea and expand it into a comprehensive, professional "
    "creative brief that will be used directly to prompt an AI image generation model. "
    "The brief must be extremely specific about every visual detail. "
    "Never invent product details not in the original idea. Only build on what was given."
)

_EXPAND_USER_TMPL = (
    'Platform: {platform}\n'
    'Original idea: "{brief}"\n\n'
    "Write a comprehensive campaign photography brief covering ALL of the following — "
    "be specific, visual, and professional:\n\n"
    "1. CAMPAIGN THEME & EMOTIONAL STORY: What feeling should every image evoke? "
    "What narrative arc runs through the campaign?\n"
    "2. TARGET AUDIENCE & MINDSET: Who is this for? What are they feeling/wanting?\n"
    "3. VISUAL AESTHETIC & MOOD: Overall look — editorial, cinematic, raw, luxury, "
    "playful, moody, etc. Reference specific visual styles if relevant.\n"
    "4. LIGHTING: Type of light (golden hour, studio strobe, neon, natural diffused, "
    "dramatic chiaroscuro, etc.), direction, intensity, color temperature.\n"
    "5. COLOR PALETTE & GRADING: Dominant colors, shadows, highlights, overall grade "
    "(warm, cool, desaturated, punchy, filmic, etc.).\n"
    "6. CAMERA & LENS STYLE: Depth of field, focal length feel (wide/standard/telephoto), "
    "shutter (crisp/motion blur), film grain or clean digital.\n"
    "7. COMPOSITION & SHOT TYPES: What compositions work for this campaign "
    "(hero shot, flat lay, lifestyle, macro, overhead, dynamic action, etc.).\n"
    "8. SETTING & ENVIRONMENT: Where are we? Indoor/outdoor, specific location "
    "details, time of day, props and styling elements.\n"
    "9. PRODUCT TREATMENT: How does the product appear — hero-centered, integrated "
    "naturally, held/used, pristine studio, in-motion, etc.\n\n"
    "10. MANDATORY LITERAL INSTRUCTIONS: If the original idea explicitly requests specific elements — "
    "human models/people, a specific action, specific props, or a named theme/wordplay the product is built "
    "around — state them plainly and concretely (e.g. 'a model wears the shoe mid-stride') somewhere in the "
    "brief. Do not let an explicit request dissolve into only atmospheric or color language — name the literal "
    "thing that was asked for.\n\n"
    "Write this as one flowing creative brief paragraph (200-250 words). "
    "No numbered lists, no headers — dense, vivid, professional prose that a "
    "photographer or AI model can execute immediately."
)

_EXPAND_VISION_PROMPT_TMPL = (
    "You are a world-class creative director and brand photographer with 20 years of "
    "experience shooting product campaigns for global brands. "
    "You receive a product image and a rough campaign idea. "
    "Study the product image carefully — its exact shape, color, texture, finish, materials, "
    "size, and any distinctive visual features. Use these observed details to write a "
    "comprehensive, professional creative brief that will be used directly to prompt an "
    "AI image generation model. Never invent visual details — only describe what you see.\n\n"
    'Platform: {platform}\n'
    'Original campaign idea: "{brief}"\n\n'
    "Based on the product image above and the campaign idea, write a comprehensive "
    "campaign photography brief covering ALL of the following — be specific, visual, "
    "and professional:\n\n"
    "1. CAMPAIGN THEME & EMOTIONAL STORY: What feeling should every image evoke? "
    "What narrative arc runs through the campaign?\n"
    "2. TARGET AUDIENCE & MINDSET: Who is this for? What are they feeling/wanting?\n"
    "3. VISUAL AESTHETIC & MOOD: Overall look — editorial, cinematic, raw, luxury, "
    "playful, moody, etc. Reference the product's visual character.\n"
    "4. LIGHTING: Type of light (golden hour, studio strobe, neon, natural diffused, "
    "dramatic chiaroscuro, etc.), direction, intensity, color temperature.\n"
    "5. COLOR PALETTE & GRADING: Pull dominant colors from the product itself. "
    "Describe shadows, highlights, overall grade (warm, cool, desaturated, punchy, filmic).\n"
    "6. CAMERA & LENS STYLE: Depth of field, focal length feel (wide/standard/telephoto), "
    "shutter (crisp/motion blur), film grain or clean digital.\n"
    "7. COMPOSITION & SHOT TYPES: What compositions showcase this specific product best "
    "(hero shot, flat lay, lifestyle, macro, overhead, dynamic action, etc.).\n"
    "8. SETTING & ENVIRONMENT: Where are we? Indoor/outdoor, specific location "
    "details, time of day, props and styling elements that complement the product.\n"
    "9. PRODUCT TREATMENT: Describe how the product should appear using its actual visual "
    "traits (e.g., 'the matte black cylindrical bottle with a brushed-gold cap, label-side "
    "facing camera') — hero-centered, integrated naturally, held/used, pristine studio, etc.\n\n"
    "10. MANDATORY LITERAL INSTRUCTIONS: If the original campaign idea explicitly requests specific elements — "
    "human models/people, a specific action, specific props, or a named theme/wordplay the product is built "
    "around — state them plainly and concretely (e.g. 'a model wears the shoe mid-stride') somewhere in the "
    "brief. Do not let an explicit request dissolve into only atmospheric or color language — name the literal "
    "thing that was asked for.\n\n"
    "Write this as one flowing creative brief paragraph (200-250 words). "
    "No numbered lists, no headers — dense, vivid, professional prose that a "
    "photographer or AI model can execute immediately."
)


@router.post("/expand-brief", response_model=ExpandBriefResponse)
async def expand_brief(request: ExpandBriefRequest):
    import base64 as _b64

    if settings.MOCK_MODE:
        return ExpandBriefResponse(
            expanded=f"[MOCK] Expanded brief for: {request.brief}"
        )

    _BRIEF_CHAR_LIMIT = 4800

    image_bytes: bytes | None = None
    if request.product_image_base64:
        image_bytes = _b64.b64decode(request.product_image_base64)
    elif request.product_image_url:
        # Fetched server-side to avoid the browser CORS failures that block
        # client-side fetches of R2-hosted product images.
        image_bytes = await _fetch_asset(request.product_image_url)
        if image_bytes is None:
            logger.warning("expand-brief: product_image_url fetch failed | url=%s", request.product_image_url)

    if image_bytes:
        vision_prompt = _EXPAND_VISION_PROMPT_TMPL.format(
            platform=request.platform,
            brief=request.brief,
        )
        expanded = await _llm.complete_with_vision(
            file_bytes=image_bytes,
            prompt=vision_prompt,
            mime_type="image/jpeg",
        )
    else:
        prompt = _EXPAND_USER_TMPL.format(
            platform=request.platform,
            brief=request.brief,
        )
        expanded = await _llm.complete(
            *("gemini", "gemini-2.5-flash"),
            system=_EXPAND_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.85,
            max_tokens=2048,
        )

    result = expanded.strip()
    # Hard cap to stay under schema limits — trim at last sentence boundary if possible
    if len(result) > _BRIEF_CHAR_LIMIT:
        cutoff = result.rfind(".", 0, _BRIEF_CHAR_LIMIT)
        result = result[: cutoff + 1] if cutoff > 0 else result[:_BRIEF_CHAR_LIMIT]
    return ExpandBriefResponse(expanded=result)


# ── Campaign Generator ────────────────────────────────────────────────────────

_STYLE_LOCK_PROMPT = """\
You are a senior commercial art director and cinematographer.
You will receive a product image and a campaign brief.
Output ONLY a tightly formatted style specification block — no prose, no preamble, no markdown fences.

Campaign brief: {brief}
Platform: {platform}
Brand voice: {brand_voice}
Brand color palette: {brand_colors}
Target audience: {target_audience}

Analyse the product in the image carefully — its category, materials, colours, finish, price-point signals, and intended use. The image itself may be an ordinary hand-taken snapshot with mediocre lighting, a rough angle, or a cluttered background — look past all of that to study the product on its own merits; do not let a poor-quality reference photo drag down the style you design. Then write a campaign visual style that is bespoke to THIS specific product AND brand personality, at full professional/editorial production quality regardless of how the reference itself was captured. The brand voice and color palette must be reflected in the grading, lighting character, and mood — not ignored.

The style must be executable consistently across BOTH clean studio shots AND real-world lifestyle environments (homes, desks, kitchens, outdoors) — never lock a look that only works on a seamless studio backdrop, because most of the campaign's photos happen in lived-in settings.

Output exactly this block (replace the bracketed descriptions with your values):

Visual theme: [2-4 word label that captures the aesthetic, e.g. "DARK SPA LUXURY" or "BOLD STREET ENERGY"]
LIGHTING: [specific recipe — key light placement, quality hard/soft, fill ratio, practicals if any]
COLOR TEMPERATURE: [Kelvin range for key light, and any accent colour temperature]
GRADING: [colour grade recipe — hue shifts, saturation, contrast, lift/gamma/gain, film grain % if any, a real-world photographic reference]
MOOD: [3-5 adjectives that must be palpable in every frame]
ENVIRONMENT CUES: [2-3 appropriate environments or surface textures that complement this product and brand]
PHOTOGRAPHIC REFERENCE: [1-2 real campaign styles or photographer names whose visual language fits this brand]
"""

_CAMPAIGN_SYSTEM_PROMPT = """You are a world-class commercial photographer and art director — think Nick Knight, Txema Yeste, or Tim Walker for product work. You are creating a multi-image editorial product campaign where every photo is a distinct, magazine-quality shot.

You receive a reference image of the product. Your job: produce the shot defined by the MANDATORY SHOT DIRECTIVE with the precision and intentionality of a commissioned editorial photographer.

════════════════════════════════════════
WHAT IS FIXED vs WHAT MUST CHANGE
════════════════════════════════════════

FIXED — the product's identity never changes:
- Exact colors, materials, and finish of the product
- Element count (if the product has 6 parts, every photo shows exactly 6)
- Overall design language and silhouette

MUST CHANGE — every photo is a completely different shot:
- Camera angle and position: follow the MANDATORY SHOT DIRECTIVE exactly
- Framing and crop: how much of the product is visible
- Environment and background: entirely different scene per photo
- Lighting character: shifts within the locked style (hard vs soft, warm vs cool rim)
- Styling details: different surface, different props arrangement

════════════════════════════════════════
MAGAZINE PHOTOGRAPHY STANDARDS
════════════════════════════════════════

Every photo must pass this editorial quality bar:
- LIGHTING: One clear, intentional light source direction — no flat, omnidirectional lighting
- NEGATIVE SPACE: Deliberately composed — empty areas are a design decision, not an accident
- SURFACE TEXTURE: The surface the product rests on must have real texture and material character
- DEPTH: Three-dimensional sense of space — foreground / subject / background planes are distinct
- SHARPNESS: Product is tack-sharp; background transitions to controlled bokeh or intentional blur
- NO CLUTTER: Every prop and element in frame is there by decision — nothing accidental

════════════════════════════════════════
EXECUTION
════════════════════════════════════════

STEP 1: Memorize the product's exact colors, materials, element count, and visual identity from the reference.
STEP 2: Execute the MANDATORY SHOT DIRECTIVE — camera position, framing, and environment are non-negotiable.
STEP 3: Apply the Campaign Style Lock for consistent color grading and lighting mood across photos.

Sameness across photos is a failure. Each shot must be unmistakably a different photograph."""

_PROBLEM_BEAT = (
    "THE PROBLEM — Camera close and intimate, eye-level or slightly above, natural candid feel — not stiff or "
    "posed. Show a real, relatable person genuinely experiencing the specific problem or discomfort this product "
    "solves — infer the exact problem from the BRIEF TEXT below and depict it honestly through facial expression "
    "and body language, a believable everyday moment of struggle. This is the story's opening hook. THE PRODUCT "
    "MUST STILL BE CLEARLY, PROMINENTLY VISIBLE AND IN SHARP FOCUS SOMEWHERE IN THIS FRAME — held in the "
    "person's hand, resting on a nearby table/nightstand/counter within clear view — it is never blurred, tiny, "
    "cropped out, or absent. The emotional focus is the person's struggle, but the product is always identifiable "
    "as part of the same frame, foreshadowing the solution. ENVIRONMENT: an authentic everyday real-world setting "
    "where this problem would actually occur (home, desk, kitchen, bedroom, commute — infer the best fit from the "
    "brief), natural available light, nothing staged or studio-like."
)
_PRODUCT_BEAT = (
    "THE PRODUCT — Camera at exact eye-level, straight-on front face. Product fills 65-70% of frame, centered "
    "with equal negative space left and right. Single hard key light from 45° above-left casting a clean "
    "directional shadow on the surface beneath the product. This is the story's turning point — the reveal of "
    "the product as the definitive solution to the problem shown earlier. ENVIRONMENT: Clean studio — pure "
    "white or polished light grey surface, seamless white background. Magazine-cover quality — razor-sharp "
    "product, zero clutter."
)
_MOMENT_OF_USE_BEAT = (
    "THE MOMENT OF USE — Camera at a 35-45° angle, slightly elevated, natural candid framing. Show a real person "
    "actually using, holding, or taking the product in a believable everyday moment — genuine, mid-action. The "
    "product must be clearly visible and identifiable in the person's hand or immediate context — this beat "
    "proves the product in real use. ENVIRONMENT: warm, natural lifestyle setting (kitchen counter, bedside "
    "table, desk) with soft natural side-light."
)
_RESOLUTION_BEAT = (
    "THE RESOLUTION — Camera at eye-level or slightly low, warm intimate framing. Show the aftermath: a real "
    "person now relieved, calm, or at ease — genuine relaxed body language and expression, having used the "
    "product. This is the story's emotional payoff. THE PRODUCT MUST BE CLEARLY, PROMINENTLY VISIBLE AND IN "
    "SHARP FOCUS in the frame — in hand or clearly placed on the nightstand/counter beside the person, not a "
    "small or blurred afterthought. The person's relief is the emotional beat, but the product stays a "
    "recognisable, unmistakable presence in the same shot, closing the story as the reason for the relief. "
    "ENVIRONMENT: comfortable, warm, lived-in setting — soft natural light, aspirational but real."
)
_DAILY_STRUGGLE_BEAT = (
    "THE DAILY STRUGGLE — Camera at a slightly wider, observational angle, natural candid feel. Show the SAME "
    "problem from the opening photo recurring or impacting daily life more broadly — a different moment and "
    "setting that raises the story's emotional stakes. THE PRODUCT MUST STILL BE CLEARLY, PROMINENTLY VISIBLE "
    "AND IN SHARP FOCUS somewhere in this frame (in hand, on a desk/bag/counter within clear view) — never "
    "blurred, tiny, cropped out, or absent. ENVIRONMENT: a different everyday real-world setting than the "
    "opening problem shot (e.g. work, commute, or a social moment), reinforcing how often this problem gets in "
    "the way."
)
_DETAIL_BEAT = (
    "THE DETAIL — Camera extremely close: 15-20cm from the product surface. One specific detail fills the "
    "entire frame — texture, label, imprint, material, or mechanism — proving the product's quality and "
    "craftsmanship. This beat builds confidence in the product right after its reveal. ENVIRONMENT: single-color "
    "or near-black background; single side-rim light that reveals micro-texture."
)

# Fixed FALLBACK narrative arc — problem, then product, then proof/use, then resolution — used
# only if the dynamic per-campaign story-arc planner below fails. The planner decides the real
# structure per campaign (it does NOT have to open with "the problem"); this is just a safety net.
_CAMPAIGN_ROLES: dict[int, list[str]] = {
    1: [
        "EDITORIAL HERO — Camera at exact eye-level, straight-on front face. Product fills 65-70% of frame, centered with equal negative space left and right. Single hard key light from 45° above-left casting a clean directional shadow on the surface beneath the product. ENVIRONMENT: Clean studio — pure white or polished light grey surface, seamless white background. This is a magazine cover shot — razor-sharp product, zero clutter.",
    ],
    2: [
        _PROBLEM_BEAT,
        _PRODUCT_BEAT,
    ],
    3: [
        _PROBLEM_BEAT,
        _PRODUCT_BEAT,
        _RESOLUTION_BEAT,
    ],
    4: [
        _PROBLEM_BEAT,
        _PRODUCT_BEAT,
        _MOMENT_OF_USE_BEAT,
        _RESOLUTION_BEAT,
    ],
    6: [
        _PROBLEM_BEAT,
        _DAILY_STRUGGLE_BEAT,
        _PRODUCT_BEAT,
        _DETAIL_BEAT,
        _MOMENT_OF_USE_BEAT,
        _RESOLUTION_BEAT,
    ],
}

# Maps each role label (first word) to its assigned environment type.
# Used by _make_hints to pre-assign environments and list forbidden ones for sibling photos.
_ROLE_ENVIRONMENT_LABEL: dict[str, str] = {
    "EDITORIAL HERO": "clean studio (white/neutral seamless surface)",
    "THE PROBLEM": "authentic everyday setting where the problem occurs (home/desk/kitchen — natural light, unstaged)",
    "THE PRODUCT": "clean studio (white/neutral seamless surface)",
    "THE MOMENT OF USE": "warm lifestyle setting where the product is actually used (kitchen counter, bedside, desk)",
    "THE RESOLUTION": "comfortable, warm, lived-in setting — relief/payoff mood",
    "THE DAILY STRUGGLE": "a different everyday real-world setting than the opening problem shot (e.g. work, commute, social moment)",
    "THE DETAIL": "near-black or single-color macro close-up (side-rim light)",
}

_STORY_ARC_SYSTEM = """You are a world-class creative director planning a {photo_count}-photo product campaign as ONE continuous, coherent story — not {photo_count} independent shots.

You decide the narrative structure yourself, based on whatever best serves THIS specific product and brief. There is NO fixed template — the sequence does NOT have to open with "the problem". It could open with the product itself, a lifestyle moment, a demonstration, a transformation, a problem, or any other structure you judge is the strongest story for this brief. Use your judgment as a director, not a formula.

Non-negotiable rules:
0. PHOTO 1 IS THE COVER — it must work as a standalone scroll-stopper even before the story is understood.
   A viewer who sees only photo 1 in a feed must stop. Never open on a quiet establishing beat or slow build-up;
   the strongest single image opens the sequence, and the story is structured around that.
1. All {photo_count} photos form ONE throughline where each beat builds on the one before it — never independent, unrelated shots grouped together after the fact.
2. THE PRODUCT MUST BE CLEARLY, PROMINENTLY VISIBLE AND IN SHARP FOCUS IN EVERY SINGLE PHOTO, with zero exceptions. Regardless of a beat's emotional or narrative content, the product itself is never blurred, tiny, cropped out, or absent. If a person appears in a shot, the product must still be an unmistakable, deliberate part of the same frame (in hand, on a nearby surface, being used, etc.) — never sidelined for atmosphere alone.
3. Camera angle, framing, and environment must be genuinely different photo to photo for visual variety — draw on a range like: eye-level studio hero shot, overhead flatlay, low dramatic upward angle, extreme macro detail, wide lifestyle establishing shot, 35-45° lifestyle angle, side profile. Pick whichever fit each beat best; you don't need to use all of them.
4. Each photo's environment/background must be visually distinct from every other photo in the sequence — never repeat a setting.

CRITICAL — "role_text" IS AN INTERNAL PHOTOGRAPHY BRIEF, NEVER ON-IMAGE TEXT: it is read only by the
photographer/AI generator to know what to shoot. It is NOT a caption, headline, or ad copy, and none of its
wording will ever appear printed, captioned, or overlaid in the finished photo. Write it like a working
photographer's shot list — short, technical, imperative sentences (e.g. "Camera at eye-level, 45mm equivalent.
Product held in right hand, label facing camera. ENVIRONMENT: sunlit kitchen counter, warm morning light from
the left.") — NOT flowing marketing prose or narration a reader would enjoy reading as copy. If it reads like
something you'd put in an ad, rewrite it as terse camera/lighting/staging instructions instead.

You also write the exact on-image text for each photo, up front, for all {photo_count} photos together — this
matters because you can see the whole set at once and must keep every photo's text genuinely distinct, unlike
generating each one blind to the others (which causes repeated words like "calm", "relief", "gentle" across
every photo). Rules for this text:
- "headline": 2-4 words, punchy, matching this photo's specific beat — never reuse a word (not even a
  synonym-adjacent one) that another photo's headline in this set already used. Every headline expresses a
  BENEFIT or a TENSION — never a literal label of what the photo shows ("The Product", "In Use", "The
  Result" are failures).
- "subtext" (optional): 3-6 words, only if it adds something the headline doesn't; omit it (empty string) for
  photos where the headline alone is stronger — not every photo needs a subtext line.
- Keep it SHORT and SIMPLE. Longer or more complex text is harder for the image generator to render correctly
  and causes visible spelling/rendering mistakes — every extra word is a chance for the AI to get it wrong.
- Every word must be spelled correctly, in plain English, appearing once — no invented words, no filler
  adjectives ("amazing", "powerful", "revolutionary"), no repeated syllables.
- This is the exact, final text — it will be handed to the image generator to render verbatim, not re-derived
  or reinterpreted at that stage. Get it right here.

For each of the {photo_count} photos, in order, output:
- "role_text": one dense paragraph of technical photography direction (per the CRITICAL rule above) combining (a) this photo's specific narrative purpose within the overall story, stated as a shot goal not a story blurb, (b) the exact camera angle/framing/lighting, (c) the environment/setting, and (d) an explicit line reminding that the product must be clearly, prominently visible and in sharp focus in this shot.
- "environment_label": a short 5-10 word description of just this photo's setting/background (used only to detect accidental repeats).
- "headline": this photo's exact on-image headline text, per the rules above.
- "subtext": this photo's exact on-image subtext text, per the rules above, or "" if this photo doesn't need one.

Return ONLY a JSON object with this exact shape, no markdown fences, no commentary:
{{"photos": [{{"role_text": "...", "environment_label": "...", "headline": "...", "subtext": "..."}}, ...]}} with exactly {photo_count} entries."""


async def _generate_campaign_story_arc(
    campaign_brief: str,
    photo_count: int,
    brand_kit,
    platform: str,
) -> list[dict] | None:
    """Plans a bespoke narrative arc for the campaign's N photos via LLM, rather than forcing
    every campaign through the same fixed problem->product->use->resolution template. Falls back
    to None (caller uses _CAMPAIGN_ROLES) on any failure so campaign generation never breaks."""
    if photo_count <= 1 or settings.MOCK_MODE:
        return None
    try:
        brand_parts: list[str] = []
        if brand_kit:
            if brand_kit.company_name:
                brand_parts.append(f"brand: {brand_kit.company_name}")
            if getattr(brand_kit, "company_description", None):
                brand_parts.append(f"what they do: {brand_kit.company_description[:200]}")
            if brand_kit.brand_voice:
                brand_parts.append(f"brand voice: {brand_kit.brand_voice}")
            if brand_kit.target_audience:
                brand_parts.append(f"target audience: {brand_kit.target_audience}")
        brand_context = "; ".join(brand_parts)

        prompt = (
            f"Campaign brief: {campaign_brief}\n"
            f"Platform: {platform}\n"
            + (f"Brand context: {brand_context}\n" if brand_context else "")
        )
        data = await _llm.complete_json(
            provider=_agent.default_provider, model=_agent.default_model,
            system=_STORY_ARC_SYSTEM.format(photo_count=photo_count),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        photos = data.get("photos", [])
        if len(photos) != photo_count:
            logger.error("image_pipeline_degraded=story_arc | returned %d photos, expected %d — using fixed template", len(photos), photo_count)
            return None
        for p in photos:
            if not p.get("role_text") or not p.get("environment_label") or not p.get("headline"):
                logger.error("image_pipeline_degraded=story_arc | entry missing role_text/environment_label/headline — using fixed template")
                return None
        logger.info("story arc generated | photo_count=%d", photo_count)
        return photos
    except Exception as exc:
        logger.error("image_pipeline_degraded=story_arc | generation failed, using fixed template | error=%s", exc)
        return None


class CampaignRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    product_image_urls: list[str] = Field(..., min_length=1, max_length=5)
    campaign_brief: str = Field(..., min_length=1, max_length=5000)
    photo_count: int = Field(4)
    use_logo: bool = True
    use_mascot: bool = True
    use_brand_colors: bool = True
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
    image_aspect_ratio: str = Field("1:1", pattern="^(1:1|16:9|9:16|4:3)$")
    brand_images: list[BrandImageRef] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

class CampaignPhoto(BaseModel):
    image: ImageResult
    composition_role: str


class CampaignResponse(BaseModel):
    photos: list[CampaignPhoto]
    tokens_used: int
    model_used: str


async def _build_campaign_style_lock(
    campaign_brief: str,
    brand_kit,
    platform: str,
    product_image_url: str | None = None,
) -> str:
    """Build a shared visual language spec — injected into every photo so all N shots
    share the same aesthetic, lighting, and theme while only composition differs.
    Uses a vision LLM call against the product image to generate a bespoke spec."""
    parts: list[str] = [
        "=== CAMPAIGN STYLE LOCK — every photo MUST share ALL of the following ==="
    ]

    theme_block: str | None = None

    # Build brand context strings to inject into the style lock prompt
    _brand_voice = (brand_kit.brand_voice if brand_kit and brand_kit.brand_voice else "not specified")
    _target_audience = (brand_kit.target_audience if brand_kit and brand_kit.target_audience else "not specified")
    if brand_kit and brand_kit.brand_colors:
        _c = brand_kit.brand_colors
        _color_parts = [f"{k}: {v}" for k, v in _c.items() if v]
        _brand_colors = ", ".join(_color_parts) if _color_parts else "not specified"
    else:
        _brand_colors = "not specified"

    if product_image_url and not settings.MOCK_MODE:
        try:
            import httpx as _httpx
            async with _httpx.AsyncClient(timeout=10.0) as _client:
                _resp = await _client.get(product_image_url)
                _resp.raise_for_status()
                _img_bytes = _resp.content
                _mime = _resp.headers.get("content-type", "image/jpeg").split(";")[0]
            theme_block = await _llm.complete_with_vision(
                file_bytes=_img_bytes,
                prompt=_STYLE_LOCK_PROMPT.format(
                    brief=campaign_brief[:1200],
                    platform=platform,
                    brand_voice=_brand_voice,
                    brand_colors=_brand_colors,
                    target_audience=_target_audience,
                ),
                mime_type=_mime,
            )
            theme_block = theme_block.strip()
        except Exception as _e:
            logger.warning("style_lock vision call failed, falling back | error=%s", _e)
            theme_block = None

    if theme_block:
        parts.append(theme_block)
    else:
        # Fallback: derive a style spec from brand context rather than a hardcoded editorial style
        _mood_from_voice = _brand_voice if _brand_voice != "not specified" else "authentic, aspirational, confident"
        parts.append(
            "Visual theme: EDITORIAL PROFESSIONAL\n"
            "LIGHTING: Clean directional lighting; key 45° above-left, fill card opposite, subtle rim separation.\n"
            "COLOR TEMPERATURE: Neutral daylight 5000-5500K.\n"
            f"GRADING: Colour grading aligned to brand palette ({_brand_colors}); gentle S-curve contrast; product colours read accurately.\n"
            f"MOOD: {_mood_from_voice}\n"
            f"BRIEF CONTEXT: '{campaign_brief[:400]}'"
        )

    if brand_kit:
        if brand_kit.brand_colors:
            c = brand_kit.brand_colors
            color_parts = [f"primary {c.get('primary', '')}", f"secondary {c.get('secondary', '')}", f"accent {c.get('accent', '')}"]
            parts.append(f"Brand colour palette — must dominate every photo's colour grading: {', '.join(p for p in color_parts if p.split()[-1])}.")
        if brand_kit.brand_voice:
            parts.append(f"Brand mood & energy: {brand_kit.brand_voice} — translate this into the visual atmosphere of every photo.")
        if brand_kit.target_audience:
            parts.append(f"Target audience: {brand_kit.target_audience} — every photo should feel aspirational and relevant to them.")

    parts.append(
        "Lighting consistency: ALL photos must use the same lighting style (e.g. all warm golden-hour, "
        "all cool studio strobe, all moody rim-light) — never mix lighting styles across the series."
    )
    parts.append(
        "Realism level: ALL photos must be the same level of realism — all photorealistic OR all illustrated. "
        "Never mix styles within a campaign."
    )
    parts.append("=== END STYLE LOCK ===")
    return "\n".join(parts)


@router.post("/campaign", response_model=CampaignResponse)
async def create_campaign(request: CampaignRequest):
    valid_counts = {1, 2, 3, 4, 6}
    if request.photo_count not in valid_counts:
        raise HTTPException(status_code=422, detail=f"photo_count must be one of {sorted(valid_counts)}")

    brand_kit = None
    if (request.use_logo or request.use_mascot) and request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("campaign brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    # Let the model plan a bespoke narrative arc for this specific brief rather than forcing
    # every campaign through the same fixed "problem first" template — falls back to the
    # fixed template only if the planner call fails.
    story_arc = await _generate_campaign_story_arc(
        request.campaign_brief, request.photo_count, brand_kit, request.platform,
    )
    if story_arc:
        roles = [p["role_text"] for p in story_arc]
        role_environments = [p["environment_label"] for p in story_arc]
        # Pre-written by the planner (which sees all photos at once, so it naturally avoids
        # repeating the same words across headlines) — handed to image generation as exact text
        # to render, not something for it to invent itself per photo.
        text_specs: list[dict | None] = [
            {"headline": p["headline"], "subtext": p.get("subtext") or ""} for p in story_arc
        ]
    else:
        roles = _CAMPAIGN_ROLES.get(request.photo_count, _CAMPAIGN_ROLES[4])
        role_environments = None  # computed below via _env_label fallback
        text_specs = [None] * len(roles)

    # Build a shared style description from brand kit data — gives all photos the same
    # colour/mood/energy without the carousel anchor that locks composition too tightly.
    style_lock = await _build_campaign_style_lock(
        request.campaign_brief, brand_kit, request.platform,
        product_image_url=request.product_image_urls[0],
    )

    total_photos = len(roles)

    # Pre-assign a distinct environment label to each role so concurrent photos never
    # independently choose the same background (e.g., marble/marble/marble). Skipped when the
    # story-arc planner already supplied real per-photo environment_label values above.
    def _env_label(role: str) -> str:
        role_key = role.split(" — ")[0].strip() if " — " in role else role.split("\n")[0].strip()
        return _ROLE_ENVIRONMENT_LABEL.get(role_key, "distinct background unique to this shot")

    if role_environments is None:
        role_environments = [_env_label(r) for r in roles]

    def _make_hints(role: str, photo_index: int) -> str:
        this_env = role_environments[photo_index]
        forbidden_envs = [
            f"Photo {i + 1}: {env}"
            for i, env in enumerate(role_environments)
            if i != photo_index
        ]
        forbidden_block = (
            f"FORBIDDEN ENVIRONMENTS — already used by sibling photos, MUST NOT be reused:\n"
            + "\n".join(f"  ✗ {e}" for e in forbidden_envs)
            + "\n"
        ) if forbidden_envs else ""

        story_arc_note = (
            f"THIS CAMPAIGN TELLS ONE CONTINUOUS STORY across all {total_photos} photos, in this exact order — "
            f"it is NOT {total_photos} independent, unrelated product shots. This photo's beat builds on the "
            f"photo(s) before it and sets up the one(s) after. Depict ONLY this photo's specific beat below — do "
            f"not pull forward a later beat's content or repeat an earlier beat's content.\n\n"
            if total_photos > 1 else ""
        )
        return (
            f"{_CAMPAIGN_SYSTEM_PROMPT}\n\n"
            f"{style_lock}\n\n"
            f"THIS IS PHOTO {photo_index + 1} OF {total_photos} IN THE CAMPAIGN.\n\n"
            f"{story_arc_note}"
            f"COMPOSITION ROLE — this defines the camera angle AND how the product is oriented/framed for this specific photo:\n"
            f"{role}\n\n"
            f"ASSIGNED ENVIRONMENT FOR THIS PHOTO: {this_env}\n"
            f"You MUST use this environment category. Do NOT substitute a different surface, background, or setting.\n\n"
            f"{forbidden_block}"
            f"PRODUCT IDENTITY LOCK:\n"
            f"• Keep the product's colors, design style, and element count exactly the same as the reference.\n"
            f"• Do NOT add or remove any characters, objects, or elements from the product.\n"
            f"• The camera angle, orientation, and framing of the product MUST follow the composition role above — this is what makes each photo different.\n\n"
            f"CAMPAIGN BRIEF — apply the following from this brief:\n"
            f"  • LIGHTING FEEL: What quality of light does the brief suggest? Align with the Style Lock above.\n"
            f"  • COLOR STORY: What dominant hues does this brief imply? Use them in background and props, not the product.\n"
            f"  • EMOTIONAL REGISTER: What emotion should the viewer feel? Encode it through the environment mood.\n"
            f"  • MANDATORY SUBJECT/PROP/THEME: If the brief explicitly requests a specific subject (e.g. a human "
            f"model wearing/using the product), a specific prop, or a named theme/motif the product is built "
            f"around, that element is REQUIRED in this photo — do not drop it just because it isn't lighting, "
            f"color, or mood. Stage it within the composition role above; never omit it.\n"
            f"  BRIEF TEXT: {request.campaign_brief}"
        )

    async def _gen_photo(role: str, photo_index: int) -> CampaignPhoto | None:
        hints = _make_hints(role, photo_index)
        # Every photo goes through the same product-reference path (product URLs + logo/mascot).
        # An earlier version fed photo 1's own AI-generated output back in as a "style anchor"
        # for photos 2+, but that reliably triggers Gemini's IMAGE_OTHER safety policy (it flags
        # its own generation watermark) — in production every anchor-mode photo hit IMAGE_OTHER
        # on attempt 1 and only succeeded after the anchor was dropped, so the anchor was pure
        # overhead with zero benefit. Consistency across photos instead comes from the shared
        # style_lock (vision-derived from the real product photo) injected into every hint.
        product_urls = request.product_image_urls
        last_err: BaseException | None = None
        for attempt in range(3):
            if attempt and last_err:
                last_err_str = str(last_err)
                # Rate-limit errors need much longer backoff than transient failures
                if "429" in last_err_str or "RESOURCE_EXHAUSTED" in last_err_str.upper():
                    await asyncio.sleep(30 + attempt * 30)
                else:
                    await asyncio.sleep(2 * attempt)
            try:
                image = await generate_social_image(
                    prompt=request.campaign_brief,
                    platform=request.platform,
                    aspect_ratio=request.image_aspect_ratio,
                    use_logo=request.use_logo,
                    use_mascot=request.use_mascot,
                    user_id=request.user_id,
                    organization_id=request.organization_id,
                    brand_kit=brand_kit,
                    context_hints=hints,
                    concept_hint=request.campaign_brief,
                    reference_urls=product_urls,
                    campaign_mode=True,
                    campaign_shot_type=role,
                    text_spec=text_specs[photo_index],
                    brand_images=request.brand_images or [],
                    use_brand_colors=request.use_brand_colors,
                )
                if attempt:
                    logger.info("campaign image_gen recovered on attempt %d | role=%s", attempt + 1, role)
                return CampaignPhoto(image=image, composition_role=role)
            except Exception as err:
                last_err = err
                logger.warning("campaign image_gen attempt %d/3 failed | role=%s error=%s", attempt + 1, role, err)
                if attempt == 2:
                    logger.error("campaign image_gen failed after 3 attempts | role=%s error=%s", role, err)
        return None

    async def _gen_photo_with_timeout(role: str, photo_index: int) -> CampaignPhoto | None:
        try:
            return await asyncio.wait_for(_gen_photo(role, photo_index), timeout=120)
        except asyncio.TimeoutError:
            logger.error("campaign image_gen timed out (120s) | role=%s photo=%d", role, photo_index + 1)
            return None

    # All photos generate in parallel now — no sequential anchor step needed.
    all_results = await asyncio.gather(
        *[_gen_photo_with_timeout(role, i) for i, role in enumerate(roles)],
        return_exceptions=True,
    )
    photos = [p for p in all_results if p is not None and not isinstance(p, Exception)]

    logger.info(
        "campaign done | user=%s platform=%s photos=%d",
        request.user_id, request.platform, len(photos),
    )
    return CampaignResponse(
        photos=photos,
        tokens_used=0,
        model_used=_agent.default_model,
    )


# ── Video Generation ──────────────────────────────────────────────────────────

_VIDEO_ASPECT_RATIOS = "^(16:9|9:16)$"


class GenerateVideoRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    prompt: str = Field(..., min_length=1, max_length=2000)
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
    aspect_ratio: str = Field("9:16", pattern=_VIDEO_ASPECT_RATIOS)
    duration_seconds: int = Field(
        VIDEO_SEGMENT_SECONDS, ge=VIDEO_SEGMENT_SECONDS, le=MAX_VIDEO_SECONDS,
        multiple_of=VIDEO_SEGMENT_SECONDS,
    )
    use_logo: bool = False


class GenerateVideoResponse(BaseModel):
    video: VideoResult
    tokens_used: int
    model_used: str


class CampaignVideoRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    product_image_urls: list[str] = Field(..., min_length=1, max_length=5)
    campaign_brief: str = Field(..., min_length=1, max_length=5000)
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
    aspect_ratio: str = Field("9:16", pattern=_VIDEO_ASPECT_RATIOS)
    duration_seconds: int = Field(
        VIDEO_SEGMENT_SECONDS, ge=VIDEO_SEGMENT_SECONDS, le=MAX_VIDEO_SECONDS,
        multiple_of=VIDEO_SEGMENT_SECONDS,
    )
    use_logo: bool = False
    # 9 beats and one 3x3 sheet per 10-second segment, so up to 4 sheets / 36 beats at 40s.
    storyboard_beats: list[str] | None = Field(
        None, max_length=BEATS_PER_SEGMENT * (MAX_VIDEO_SECONDS // VIDEO_SEGMENT_SECONDS)
    )
    storyboard_image_urls: list[str] | None = Field(
        None, max_length=MAX_VIDEO_SECONDS // VIDEO_SEGMENT_SECONDS
    )
    # A plan already returned by /campaign-video/plan and shown to the user. When present the
    # planning step is skipped so the rendered video matches the text they approved.
    segment_narratives: list[str] | None = Field(
        None, max_length=MAX_VIDEO_SECONDS // VIDEO_SEGMENT_SECONDS
    )


class CampaignVideoResponse(BaseModel):
    video: VideoResult
    tokens_used: int
    model_used: str


class StoryboardRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    product_image_urls: list[str] = Field(..., min_length=1, max_length=5)
    campaign_brief: str = Field(..., min_length=1, max_length=5000)
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
    aspect_ratio: str = Field("9:16", pattern=_VIDEO_ASPECT_RATIOS)
    duration_seconds: int = Field(
        VIDEO_SEGMENT_SECONDS, ge=VIDEO_SEGMENT_SECONDS, le=MAX_VIDEO_SECONDS,
        multiple_of=VIDEO_SEGMENT_SECONDS,
    )
    use_logo: bool = False


class StoryboardResponse(BaseModel):
    """One 3x3 sheet per 10-second segment, in story order, plus the 9xN beats behind them."""
    storyboard_images_base64: list[str]
    beats: list[str]
    model_used: str


async def _fetch_image_with_mime(url: str) -> tuple[bytes, str] | None:
    """Fetch a URL as (bytes, mime_type), used for any reference image the video/storyboard
    pipeline needs alongside its content type (product photos, storyboard, logo)."""
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=10.0) as _client:
            _resp = await _client.get(url)
            _resp.raise_for_status()
            return _resp.content, _resp.headers.get("content-type", "image/jpeg").split(";")[0]
    except Exception as fetch_err:
        logger.warning("image fetch failed | url=%s error=%s", url, fetch_err)
        return None


async def _fetch_logo_image(brand_kit) -> tuple[bytes, str] | None:
    """Fetch the org's brand logo as (bytes, mime_type), or None if unavailable."""
    if not brand_kit or not brand_kit.logo_url:
        return None
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=10.0) as _client:
            _resp = await _client.get(brand_kit.logo_url)
            _resp.raise_for_status()
            return _resp.content, _resp.headers.get("content-type", "image/png").split(";")[0]
    except Exception as fetch_err:
        logger.warning("logo image fetch failed | error=%s", fetch_err)
        return None


# Ceiling on how long a single video request may hold a worker. A clean 40s render is ~400s;
# this leaves room for retries without letting a pathological case tie up a worker for over
# an hour (which no browser or proxy would wait for anyway).
_MAX_VIDEO_REQUEST_SECONDS = 1800


async def _generate_video_guarded(
    segment_prompts: list[str],
    images: list[tuple[bytes, str]] | None,
    aspect_ratio: str,
) -> VideoResult:
    """Outer timeout guard for a video render. Deliberately makes ONE attempt.

    Retries live inside LLMClient.generate_video, per 10-second segment, because each
    segment is a separate billed render: retrying out here would re-render (and re-pay for)
    every segment that had already succeeded — on a 40s video that is 4x the waste.

    The budget scales with the chain but is capped: each segment already enforces its own
    timeout, so this only has to stop something OUTSIDE the loop (e.g. the final download)
    hanging a worker forever. A render still going after the cap has failed in the user's
    eyes regardless, and holding the request open longer helps nobody.
    """
    timeout = min(
        120 + VIDEO_SEGMENT_ATTEMPTS * (VIDEO_SEGMENT_TIMEOUT + 90) * len(segment_prompts),
        _MAX_VIDEO_REQUEST_SECONDS,
    )
    try:
        return await asyncio.wait_for(
            generate_maya_video(
                _llm,
                segment_prompts=segment_prompts,
                images=images,
                aspect_ratio=aspect_ratio,
            ),
            timeout=timeout,
        )
    except Exception as err:
        logger.error(
            "generate_video failed | segments=%d error=%s", len(segment_prompts), err
        )
        raise HTTPException(status_code=502, detail=f"Video generation failed: {err}")


@router.post("/generate-video", response_model=GenerateVideoResponse)
async def generate_video_endpoint(request: GenerateVideoRequest):
    brand_kit = None
    if request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("generate-video brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    concept = build_video_prompt(request.prompt, request.platform, brand_kit)
    narratives = await plan_video_scenes(
        _llm, concept, request.duration_seconds, request.aspect_ratio, request.platform,
    )
    segment_prompts = build_segment_prompts(concept, narratives)

    images: list[tuple[bytes, str]] = []
    if request.use_logo:
        logo = await _fetch_logo_image(brand_kit)
        if logo:
            images.append(logo)
            segment_prompts = add_logo_instruction(segment_prompts)

    video = await _generate_video_guarded(
        segment_prompts=segment_prompts,
        images=images or None,
        aspect_ratio=request.aspect_ratio,
    )

    logger.info(
        "generate-video done | user=%s platform=%s duration=%ss",
        request.user_id, request.platform, request.duration_seconds,
    )
    return GenerateVideoResponse(video=video, tokens_used=0, model_used=_agent.default_model)


def _build_campaign_video_concept(
    campaign_brief: str,
    brand_kit,
    num_images: int,
) -> str:
    """Build the video concept for a campaign video. Unlike _build_campaign_style_lock
    (a photography lighting/consistency spec built for N still photos sharing one look),
    this keeps the campaign brief front and center so the narrative-planning LLM grounds
    its visual metaphor and reveal in what the brief actually asks for, and is told to use
    every reference image — not a rigid lighting/grading template that biases the result
    toward a generic "product floating in a clean studio" shot."""
    parts = [
        f"Turn these {num_images} reference product image(s) into a short cinematic "
        f"product campaign video. Ground every part of the narrative — the visual "
        f"metaphor and the product reveal — in specific, real details drawn from ALL of "
        f"the reference images provided, not just one of them.",
        f"CAMPAIGN BRIEF (the narrative and visual metaphor must be built around exactly "
        f"what this asks for): {campaign_brief}",
    ]
    if brand_kit and brand_kit.brand_voice:
        parts.append(f"Brand voice: {brand_kit.brand_voice}.")
    if brand_kit and brand_kit.brand_colors:
        color_parts = [f"{k}: {v}" for k, v in brand_kit.brand_colors.items() if v]
        if color_parts:
            parts.append(f"Brand colour palette (reflect in grading where it fits the category): {', '.join(color_parts)}.")
    if brand_kit and brand_kit.target_audience:
        parts.append(f"Target audience: {brand_kit.target_audience}.")
    return "\n\n".join(parts)


@router.post("/campaign-video", response_model=CampaignVideoResponse)
async def campaign_video_endpoint(request: CampaignVideoRequest):
    brand_kit = None
    if request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("campaign-video brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    concept = _build_campaign_video_concept(
        request.campaign_brief, brand_kit, len(request.product_image_urls),
    )

    product_images: list[tuple[bytes, str]] = []
    storyboard_images: list[tuple[bytes, str]] = []
    if not settings.MOCK_MODE:
        fetched = await asyncio.gather(
            *[_fetch_image_with_mime(u) for u in request.product_image_urls]
        )
        product_images = [f for f in fetched if f is not None]
        if request.storyboard_image_urls:
            fetched_sheets = await asyncio.gather(
                *[_fetch_image_with_mime(u) for u in request.storyboard_image_urls]
            )
            storyboard_images = [f for f in fetched_sheets if f is not None]

    has_storyboard = bool(storyboard_images and request.storyboard_beats)
    if request.segment_narratives:
        # Already planned and shown to the user by /campaign-video/plan — rendering the same
        # text they were shown, rather than re-planning into something slightly different.
        narratives = request.segment_narratives
    elif has_storyboard:
        narratives = await plan_video_scenes_from_storyboard(
            _llm, concept, request.storyboard_beats, storyboard_images, product_images,
            request.duration_seconds, request.aspect_ratio, request.platform,
        )
    elif product_images:
        narratives = await plan_video_scenes_with_images(
            _llm, concept, product_images,
            request.duration_seconds, request.aspect_ratio, request.platform,
        )
    else:
        narratives = await plan_video_scenes(
            _llm, concept, request.duration_seconds, request.aspect_ratio, request.platform,
        )

    segment_prompts = build_segment_prompts(concept, narratives)
    if product_images:
        segment_prompts = add_product_fidelity_guardrail(segment_prompts)

    # Only the opening segment is sent images; the storyboard sheets go with it so the very
    # first frames lock the look, and the extensions inherit it from the footage itself.
    images = list(product_images) + storyboard_images
    if request.use_logo:
        logo = await _fetch_logo_image(brand_kit)
        if logo:
            images.append(logo)
            segment_prompts = add_logo_instruction(segment_prompts)

    video = await _generate_video_guarded(
        segment_prompts=segment_prompts,
        images=images or None,
        aspect_ratio=request.aspect_ratio,
    )

    logger.info(
        "campaign-video done | user=%s platform=%s duration=%ss segments=%d",
        request.user_id, request.platform, request.duration_seconds,
        segments_for(request.duration_seconds),
    )
    return CampaignVideoResponse(video=video, tokens_used=0, model_used=_agent.default_model)


class CampaignVideoPlanRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    product_image_urls: list[str] = Field(..., min_length=1, max_length=5)
    campaign_brief: str = Field(..., min_length=1, max_length=5000)
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
    aspect_ratio: str = Field("9:16", pattern=_VIDEO_ASPECT_RATIOS)
    duration_seconds: int = Field(
        VIDEO_SEGMENT_SECONDS, ge=VIDEO_SEGMENT_SECONDS, le=MAX_VIDEO_SECONDS,
        multiple_of=VIDEO_SEGMENT_SECONDS,
    )


class CampaignVideoPlanResponse(BaseModel):
    """One narrative per 10-second segment, in order — cheap enough to show the user before
    committing to the render, and handed straight back on /campaign-video so what they read
    is what gets shot."""
    segments: list[str]
    model_used: str


@router.post("/campaign-video/plan", response_model=CampaignVideoPlanResponse)
async def campaign_video_plan_endpoint(request: CampaignVideoPlanRequest):
    brand_kit = None
    if request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("campaign-video-plan brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    concept = _build_campaign_video_concept(
        request.campaign_brief, brand_kit, len(request.product_image_urls),
    )

    product_images: list[tuple[bytes, str]] = []
    if not settings.MOCK_MODE:
        fetched = await asyncio.gather(
            *[_fetch_image_with_mime(u) for u in request.product_image_urls]
        )
        product_images = [f for f in fetched if f is not None]

    try:
        if product_images:
            narratives = await asyncio.wait_for(
                plan_video_scenes_with_images(
                    _llm, concept, product_images,
                    request.duration_seconds, request.aspect_ratio, request.platform,
                ),
                timeout=90,
            )
        else:
            narratives = await asyncio.wait_for(
                plan_video_scenes(
                    _llm, concept, request.duration_seconds, request.aspect_ratio, request.platform,
                ),
                timeout=90,
            )
    except Exception as err:
        logger.warning("campaign-video-plan failed | user=%s error=%s", request.user_id, err)
        raise HTTPException(status_code=502, detail=f"Video planning failed: {err}")

    logger.info(
        "campaign-video-plan done | user=%s platform=%s segments=%d",
        request.user_id, request.platform, len(narratives),
    )
    return CampaignVideoPlanResponse(segments=narratives, model_used=_agent.default_model)


@router.post("/campaign-video/storyboard", response_model=StoryboardResponse)
async def campaign_video_storyboard_endpoint(request: StoryboardRequest):
    brand_kit = None
    if request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("campaign-video-storyboard brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    concept = _build_campaign_video_concept(
        request.campaign_brief, brand_kit, len(request.product_image_urls),
    )

    product_images: list[tuple[bytes, str]] = []
    if not settings.MOCK_MODE:
        fetched = await asyncio.gather(
            *[_fetch_image_with_mime(u) for u in request.product_image_urls]
        )
        product_images = [f for f in fetched if f is not None]

    logo_image: tuple[bytes, str] | None = None
    if request.use_logo:
        logo_image = await _fetch_logo_image(brand_kit)

    try:
        # The opening sheet is drawn first and the rest follow in parallel off it, so the
        # budget grows by about one extra sheet's worth of time rather than N sheets'.
        storyboard_b64s, beats = await asyncio.wait_for(
            generate_video_storyboard(
                _llm, concept, product_images,
                request.duration_seconds, request.aspect_ratio, request.platform,
                logo_image=logo_image,
            ),
            timeout=90 if segments_for(request.duration_seconds) == 1 else 180,
        )
    except Exception as err:
        logger.warning("campaign-video-storyboard generation failed | user=%s error=%s", request.user_id, err)
        raise HTTPException(status_code=502, detail=f"Storyboard generation failed: {err}")

    logger.info(
        "campaign-video-storyboard done | user=%s platform=%s sheets=%d beats=%d",
        request.user_id, request.platform, len(storyboard_b64s), len(beats),
    )
    return StoryboardResponse(
        storyboard_images_base64=storyboard_b64s, beats=beats, model_used=_agent.default_model,
    )


# ── Logo Animation ───────────────────────────────────────────────────────────

class LogoAnimationStyle(BaseModel):
    id: int
    name: str
    category: str


class LogoAnimationStylesResponse(BaseModel):
    styles: list[LogoAnimationStyle]


@router.get("/logo-animation/styles", response_model=LogoAnimationStylesResponse)
async def logo_animation_styles_endpoint():
    """Style catalog for the logo-animation dropdown. Python is the single source of
    truth (see core/logo_animation_styles.py) so the frontend never has to keep its own
    copy of 100+ style names/prompts in sync."""
    return LogoAnimationStylesResponse(styles=[LogoAnimationStyle(**s) for s in LOGO_ANIMATION_STYLES])


class LogoAnimationRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    style_id: int = Field(..., ge=1, le=len(LOGO_ANIMATION_STYLES))
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
    aspect_ratio: str = Field("9:16", pattern=_VIDEO_ASPECT_RATIOS)
    logo_image_url: str | None = None
    use_brand_logo: bool = False


class LogoAnimationResponse(BaseModel):
    video: VideoResult
    style_name: str
    tokens_used: int = 0
    model_used: str = ""


@router.post("/logo-animation", response_model=LogoAnimationResponse)
async def logo_animation_endpoint(request: LogoAnimationRequest):
    brand_kit = None
    if request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("logo-animation brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    logo_image: tuple[bytes, str] | None = None
    if request.logo_image_url:
        logo_image = await _fetch_image_with_mime(request.logo_image_url)
    elif request.use_brand_logo:
        logo_image = await _fetch_logo_image(brand_kit)

    if not logo_image:
        raise HTTPException(
            status_code=400,
            detail="No logo image available — upload a logo or enable use_brand_logo with a brand kit logo configured.",
        )

    try:
        prompt, style_name = build_logo_animation_prompt(request.style_id, request.aspect_ratio)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Logo animations are always a single 10s shot — no extension ladder.
    video = await _generate_video_guarded(
        segment_prompts=[prompt],
        images=[logo_image],
        aspect_ratio=request.aspect_ratio,
    )

    logger.info("logo-animation done | user=%s style_id=%s", request.user_id, request.style_id)
    return LogoAnimationResponse(video=video, style_name=style_name, model_used=_agent.default_model)

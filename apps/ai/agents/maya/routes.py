import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("agents")

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from core.brand_kit import load_brand_kit, get_platform_tone
from core.campaign_director import plan_campaign
from core.campaign_prompt_compiler import compile_shot_prompt
from core.image_gen import generate_social_image, _fetch_asset, _PLACEHOLDER_B64 as _MOCK_IMAGE_B64
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse, ImageResult, VideoResult
from core.streaming import sse_format, stream_chat_sync_response
from core.video_director import (
    parse_client_plan,
    plan_display_segments,
    plan_video,
    segments_for,
)
from core.video_gen import (
    build_logo_animation_prompt,
    generate_maya_video,
    generate_video_storyboard,
    BEATS_PER_SEGMENT,
    LOGO_ANIMATION_STYLES,
)
from core.video_prompt_compiler import compile_segment_prompts
from core.llm import (
    extension_images_enabled,
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
    content_type: str = ""
    platform: str = ""
    hook: str = ""
    predicted_engagement: str = ""
    reasoning: str = ""
    suggested_hashtags: list[str] = Field(default_factory=list)
    visual_description: str = ""

    @model_validator(mode="before")
    @classmethod
    def _nulls_to_defaults(cls, data):
        # The model sometimes returns null for a field it has nothing for (seen for
        # visual_description when no image was asked for). One null used to fail validation
        # and turn the whole request into a 500, so drop nulls and let the defaults apply.
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if v is not None}
        return data


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


@router.post("/chat/stream", summary="Maya chat (streamed)")
async def maya_chat_stream(request: ChatRequest) -> StreamingResponse:
    """Same as /chat, but progressively — live tool_call/tool_result events
    followed by chunked token events, then a done event carrying the same
    fields the non-streaming response returns."""
    events = stream_chat_sync_response(_agent.chat_sync_stream(request), _agent.slug)
    return StreamingResponse(sse_format(events), media_type="text/event-stream")


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
#
# Same three steps as video: the director studies the product photos and plans the whole
# campaign (one vision call), the compiler turns each shot into one prompt, and the image model
# renders the photos in parallel. The director and compiler live in core/campaign_director.py
# and core/campaign_prompt_compiler.py.


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


async def _none() -> None:
    return None


@router.post("/campaign", response_model=CampaignResponse)
async def create_campaign(request: CampaignRequest):
    valid_counts = {1, 2, 3, 4, 6}
    if request.photo_count not in valid_counts:
        raise HTTPException(status_code=422, detail=f"photo_count must be one of {sorted(valid_counts)}")

    brand_kit = None
    if (request.use_logo or request.use_mascot or request.use_brand_colors) and request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("campaign brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    # Every reference is fetched once for the whole campaign, not once per photo per attempt.
    logo_url = brand_kit.logo_url if request.use_logo and brand_kit else None
    mascot_url = brand_kit.mascot_url if request.use_mascot and brand_kit else None
    product_images, logo, mascot, brand_assets = await asyncio.gather(
        _fetch_images(request.product_image_urls),
        _fetch_image_with_mime(logo_url) if logo_url and not settings.MOCK_MODE else _none(),
        _fetch_image_with_mime(mascot_url) if mascot_url and not settings.MOCK_MODE else _none(),
        asyncio.gather(*[
            _fetch_image_with_mime(bi.url) for bi in request.brand_images
        ]) if request.brand_images and not settings.MOCK_MODE else _none(),
    )

    plan = await plan_campaign(
        _llm,
        brief=request.campaign_brief,
        photo_count=request.photo_count,
        platform=request.platform,
        aspect_ratio=request.image_aspect_ratio,
        product_images=product_images,
        brand_kit=brand_kit,
        use_brand_colors=request.use_brand_colors,
    )

    # Attachment order fixes the reference numbers the compiled prompt names:
    # product photos, then logo, then mascot, then any extra brand images.
    attachments: list[bytes] = [data for data, _ in product_images]
    logo_ref = mascot_ref = None
    if logo:
        attachments.append(logo[0])
        logo_ref = len(attachments)
    if mascot:
        attachments.append(mascot[0])
        mascot_ref = len(attachments)
    brand_image_refs: list[tuple[int, str | None]] = []
    for bi, fetched in zip(request.brand_images, brand_assets or []):
        if fetched:
            attachments.append(fetched[0])
            brand_image_refs.append((len(attachments), bi.prompt))

    def _prompt(shot, compact: int = 0) -> str:
        return compile_shot_prompt(
            plan, shot,
            photo_count=len(plan.shots),
            platform=request.platform,
            aspect_ratio=request.image_aspect_ratio,
            num_product_refs=max(1, len(product_images)),
            logo_ref=logo_ref,
            mascot_ref=mascot_ref,
            brand_image_refs=brand_image_refs,
            compact=compact,
            logo_text=getattr(brand_kit, "company_name", None) if logo_ref else None,
        )

    async def _gen_photo(shot) -> CampaignPhoto | None:
        role = shot.purpose or f"photo {shot.index}"
        prompt = _prompt(shot)
        if settings.MOCK_MODE:
            image = ImageResult(image_base64=_MOCK_IMAGE_B64, content_type="image/png", prompt_used=prompt)
            return CampaignPhoto(image=image, composition_role=role)
        last_err: BaseException | None = None
        for attempt in range(3):
            if attempt and last_err:
                last_err_str = str(last_err)
                # Rate-limit errors need much longer backoff than transient failures
                if "429" in last_err_str or "RESOURCE_EXHAUSTED" in last_err_str.upper():
                    await asyncio.sleep(30 + attempt * 30)
                else:
                    await asyncio.sleep(2 * attempt)
                # IMAGE_OTHER means the model returned an empty candidate. Re-sending the same
                # prompt reproduces it exactly, so shed context before retrying.
                if "IMAGE_OTHER" in last_err_str:
                    prompt = _prompt(shot, compact=attempt)
                    logger.info("campaign image_gen retrying with compact=%d | photo=%d", attempt, shot.index)
            try:
                b64 = await _llm.generate_image_with_image_bytes(
                    prompt, attachments, aspect_ratio=request.image_aspect_ratio,
                )
                if attempt:
                    logger.info("campaign image_gen recovered on attempt %d | photo=%d", attempt + 1, shot.index)
                image = ImageResult(image_base64=b64, content_type="image/png", prompt_used=prompt)
                return CampaignPhoto(image=image, composition_role=role)
            except Exception as err:
                last_err = err
                logger.warning("campaign image_gen attempt %d/3 failed | photo=%d error=%s", attempt + 1, shot.index, err)
        logger.error("campaign image_gen failed after 3 attempts | photo=%d error=%s", shot.index, last_err)
        return None

    async def _gen_photo_with_timeout(shot) -> CampaignPhoto | None:
        try:
            return await asyncio.wait_for(_gen_photo(shot), timeout=120)
        except asyncio.TimeoutError:
            logger.error("campaign image_gen timed out (120s) | photo=%d", shot.index)
            return None

    all_results = await asyncio.gather(
        *[_gen_photo_with_timeout(shot) for shot in plan.shots],
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
#
# Every video flow is the same three steps: the director plans (one text call), the compiler
# turns the plan into one prompt per 10-second segment, and Omni renders the chain. The
# director and compiler live in core/video_director.py and core/video_prompt_compiler.py.

_VIDEO_ASPECT_RATIOS = "^(16:9|9:16)$"

# A serialized VideoPlan. Kept as a JSON string on the wire on purpose: Node camelizes nested
# request objects, and the plan's snake_case fields must survive the round trip untouched.
_VIDEO_PLAN_MAX_CHARS = 60_000


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
    # The plan returned by /campaign-video/plan and shown to the user. When it is valid for
    # this duration the director is skipped, so the render matches what they read.
    video_plan: str | None = Field(None, max_length=_VIDEO_PLAN_MAX_CHARS)


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


async def _fetch_images(urls: list[str] | None) -> list[tuple[bytes, str]]:
    if not urls or settings.MOCK_MODE:
        return []
    fetched = await asyncio.gather(*[_fetch_image_with_mime(u) for u in urls])
    return [f for f in fetched if f is not None]


async def _load_brand_kit_safe(organization_id: str, route: str):
    if not organization_id:
        return None
    try:
        return await load_brand_kit(organization_id)
    except Exception as bk_err:
        logger.warning("%s brand_kit load failed | org=%s error=%s", route, organization_id, bk_err)
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
    brand_kit = await _load_brand_kit_safe(request.organization_id, "generate-video")

    plan = await plan_video(
        _llm,
        brief=request.prompt,
        duration_seconds=request.duration_seconds,
        aspect_ratio=request.aspect_ratio,
        platform=request.platform,
        brand_kit=brand_kit,
    )

    logo = await _fetch_logo_image(brand_kit) if request.use_logo else None
    segment_prompts = compile_segment_prompts(
        plan,
        aspect_ratio=request.aspect_ratio,
        product_reference_count=0,
        logo_attached=logo is not None,
        references_on_extensions=extension_images_enabled(),
    )

    video = await _generate_video_guarded(
        segment_prompts=segment_prompts,
        images=[logo] if logo else None,
        aspect_ratio=request.aspect_ratio,
    )

    logger.info(
        "generate-video done | user=%s platform=%s duration=%ss format=%s",
        request.user_id, request.platform, request.duration_seconds, plan.format,
    )
    return GenerateVideoResponse(video=video, tokens_used=0, model_used=_agent.default_model)


def _build_campaign_video_concept(
    campaign_brief: str,
    brand_kit,
    num_images: int,
) -> str:
    """The concept handed to the storyboard beat planner. (Video planning folds the same brand
    context in itself — see core/video_director.py.) Keeps the brief front and centre and
    tells the planner to use every reference image, not just the first."""
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
    brand_kit = await _load_brand_kit_safe(request.organization_id, "campaign-video")
    num_segments = segments_for(request.duration_seconds)
    product_images = await _fetch_images(request.product_image_urls)

    # The plan the user already read, when it is still valid for this request. Otherwise plan
    # now — the storyboard, if there is one, informs the DIRECTOR only. Sheets are never sent
    # to Omni: a 3x3 collage is not a reference for a single frame of a 9:16 video, and the
    # product must match the product photos, not a drawing of it.
    plan = parse_client_plan(request.video_plan, num_segments)
    if plan is None:
        storyboard_images = (
            await _fetch_images(request.storyboard_image_urls)
            if request.storyboard_beats else []
        )
        plan = await plan_video(
            _llm,
            brief=request.campaign_brief,
            duration_seconds=request.duration_seconds,
            aspect_ratio=request.aspect_ratio,
            platform=request.platform,
            brand_kit=brand_kit,
            product_images=product_images,
            storyboard_beats=request.storyboard_beats,
            storyboard_images=storyboard_images,
        )

    # Every segment is sent these images (llm.generate_video), so each extension keeps the real
    # product as a reference instead of relying on the footage alone.
    images = list(product_images)
    logo = await _fetch_logo_image(brand_kit) if request.use_logo else None
    if logo:
        images.append(logo)  # must stay LAST — the logo instruction names it that way
    segment_prompts = compile_segment_prompts(
        plan,
        aspect_ratio=request.aspect_ratio,
        product_reference_count=len(product_images),
        logo_attached=logo is not None,
        references_on_extensions=extension_images_enabled(),
    )

    video = await _generate_video_guarded(
        segment_prompts=segment_prompts,
        images=images or None,
        aspect_ratio=request.aspect_ratio,
    )

    logger.info(
        "campaign-video done | user=%s platform=%s duration=%ss segments=%d format=%s",
        request.user_id, request.platform, request.duration_seconds, num_segments, plan.format,
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
    """The shot plan, cheap enough to show the user before committing to the render.
    `segments` is one readable line per 10-second segment for display; `video_plan` is the
    full structured plan, handed straight back on /campaign-video so what they read is what
    gets shot."""
    segments: list[str]
    video_plan: str
    model_used: str


@router.post("/campaign-video/plan", response_model=CampaignVideoPlanResponse)
async def campaign_video_plan_endpoint(request: CampaignVideoPlanRequest):
    brand_kit = await _load_brand_kit_safe(request.organization_id, "campaign-video-plan")
    product_images = await _fetch_images(request.product_image_urls)

    try:
        # plan_video never fails on a bad plan (it falls back); the timeout guards a hung call.
        plan = await asyncio.wait_for(
            plan_video(
                _llm,
                brief=request.campaign_brief,
                duration_seconds=request.duration_seconds,
                aspect_ratio=request.aspect_ratio,
                platform=request.platform,
                brand_kit=brand_kit,
                product_images=product_images,
            ),
            timeout=120,
        )
    except Exception as err:
        logger.warning("campaign-video-plan failed | user=%s error=%s", request.user_id, err)
        raise HTTPException(status_code=502, detail=f"Video planning failed: {err}")

    logger.info(
        "campaign-video-plan done | user=%s platform=%s segments=%d format=%s",
        request.user_id, request.platform, len(plan.segments), plan.format,
    )
    return CampaignVideoPlanResponse(
        segments=plan_display_segments(plan),
        video_plan=plan.model_dump_json(),
        model_used=_agent.default_model,
    )


@router.post("/campaign-video/storyboard", response_model=StoryboardResponse)
async def campaign_video_storyboard_endpoint(request: StoryboardRequest):
    brand_kit = await _load_brand_kit_safe(request.organization_id, "campaign-video-storyboard")

    concept = _build_campaign_video_concept(
        request.campaign_brief, brand_kit, len(request.product_image_urls),
    )
    product_images = await _fetch_images(request.product_image_urls)

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

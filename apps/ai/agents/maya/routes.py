import asyncio
import json
import logging
import uuid
from datetime import datetime

logger = logging.getLogger("agents")

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from core.brand_kit import load_brand_kit, get_platform_tone
from core.image_gen import generate_social_image, _fetch_asset
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse, ImageResult
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
    additional_context: str | None = Field(None, max_length=1000)
    image_aspect_ratio: str = Field("1:1", pattern="^(1:1|16:9|9:16|4:3)$")
    use_reference: bool = False
    reference_images: list[str] = Field(default_factory=list, max_length=5)

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


class VariantRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    original_content: str = Field(..., min_length=1, max_length=5000)
    original_platform: str = Field("linkedin", pattern="^(linkedin|twitter|instagram)$")
    target_platforms: list[str] = Field(["twitter", "instagram"], min_length=1, max_length=3)
    include_images: bool = False

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
    additional_context: str | None = Field(None, max_length=1000)
    image_aspect_ratio: str = Field("1:1", pattern="^(1:1|16:9|9:16|4:3)$")


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

def _mock_ideas(count: int, topic_hint: str) -> list[ContentIdea]:
    topic = topic_hint or "AI productivity for founders"
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
            generated_at=datetime.utcnow().isoformat(),
            image=image,
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
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

    prompt = (
        f"{topic_line}\n\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, tone: {rules['tone']}\n\n"
        "IMPORTANT: Only generate ideas for static image posts (linkedin_post, instagram_post, tweet). "
        "Do NOT suggest videos, reels, infographics, carousels, threads, or blog posts.\n\n"
        "Return a JSON array. Each idea must have:\n"
        "- title: post headline\n"
        "- platform: target platform\n"
        "- content_type: one of linkedin_post, instagram_post, tweet\n"
        "- hook: opening line\n"
        "- predicted_engagement: short engagement prediction\n"
        "- reasoning: why this idea works\n"
        "- suggested_hashtags: array of hashtag strings\n"
        "- visual_description: a detailed image generation prompt describing exactly what the "
        "post image should look like — layout, colors, text overlays, mood, style, what elements "
        "to include. This will be fed directly to an image generator, so be specific and vivid.\n\n"
        "Return ONLY the JSON array, no markdown fences."
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        from core.utils import safe_json_loads
        ideas_data = safe_json_loads(raw)
        ideas = [ContentIdea(**i) for i in ideas_data]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Idea generation returned unparseable data — retry. ({exc})")

    image = None
    if request.include_image:
        try:
            image = await generate_social_image(
                request.topic_hint or ideas[0].title if ideas else "content", request.platform,
                use_logo=request.use_logo, use_mascot=request.use_mascot,
                user_id=request.user_id, organization_id=request.organization_id,
            )
        except Exception:
            pass

    return IdeationResponse(
        ideas=ideas,
        generated_at=datetime.utcnow().isoformat(),
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
                )
            except Exception as _img_err:
                logger.error("image_gen failed | user=%s error=%s", request.user_id, _img_err)
        return DraftResponse(draft=draft, image=image)

    rules = PLATFORM_RULES.get(request.platform, PLATFORM_RULES["linkedin"])
    website_line = f"Include this website link in the CTA where natural: {brand_kit.website_url}" if brand_kit.website_url else ""
    platform_limits = {
        "linkedin": "Under 150 words. Short paragraphs only — no bullet points, no bold headers.",
        "twitter": "Under 280 characters total. One punchy sentence or short thread opener.",
        "instagram": "Under 150 words. Short paragraphs, line breaks, emojis welcome. Hashtags at the end.",
    }
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    prompt = (
        f"Write a ready-to-publish {request.platform} post about this topic: {request.topic}\n"
        f"Tone: {tone}\n"
        f"Additional context: {request.additional_context or 'None'}\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags\n"
        f"{website_line}\n\n"
        "STRICT RULES:\n"
        f"- {platform_limits.get(request.platform, 'Keep it concise and platform-native.')}\n"
        "- Start with a specific fact, number, or bold statement. NOT with 'As a founder' or any generic opener.\n"
        "- Write about the BUSINESS VALUE and REAL IMPACT. Never mention mascots, characters, visuals, or image descriptions.\n"
        "- Sound like the founder typed it themselves — direct, confident, no filler.\n"
        "- NO generic phrases: 'whirlwind', 'imagine', 'journey', 'elusive', 'navigating', 'transform the chaos'.\n"
        "- CTA: a direct question or action, not vague 'share your thoughts'.\n\n"
        "Return JSON with: title, body, hashtags (list), cta, meta_description, word_count, platform, tone_used. "
        "Return ONLY the JSON object, no markdown fences."
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        from core.utils import safe_json_loads
        data = safe_json_loads(raw)
        draft = DraftContent(**data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Draft generation failed — retry. ({exc})")

    image = None
    logger.info("draft_content | include_image=%s user=%s", request.include_image, request.user_id)
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
    website_line = f"Include this link where natural: {brand_kit.website_url}" if brand_kit.website_url else ""

    async def _adapt(platform: str) -> tuple[ContentVariant, int]:
        rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
        prompt = (
            f"Adapt this {request.original_platform} content for {platform}:\n\n"
            f"{request.original_content}\n\n"
            f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, "
            f"tone: {rules['tone']}, format: {rules['format']}\n"
            f"{website_line}\n\n"
            "Return JSON with: platform, title, body, hashtags (list), char_count. "
            "Return ONLY the JSON object, no markdown fences."
        )
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
        )
        _tokens = _llm.count_tokens(raw)
        try:
            from core.utils import safe_json_loads
            data = safe_json_loads(raw)
            return ContentVariant(**data), _tokens
        except Exception:
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
    prompt = (
        f"Revise this {request.platform} content based on feedback:\n\nOriginal:\n{request.original_content}\n\n"
        f"Feedback: {request.feedback}\n"
        f"Specific instructions: {request.specific_instructions or 'None'}\n\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags\n\n"
        "Return JSON with: revised (object with title (string), body (string), "
        "hashtags (array of strings, e.g. [\"#AI\", \"#Productivity\"]), cta (string)), "
        "changes_made (array of strings). "
        "Return ONLY the JSON object, no markdown fences."
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        from core.utils import safe_json_loads
        data = safe_json_loads(raw)
        return ReviseResponse(**data, platform=request.platform, tokens_used=tokens_used, model_used=_agent.default_model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Content revision failed — retry. ({exc})")


# ── Regeneration Endpoints ──────────────────────────────────────────────────

class ImageRegenRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    image_url: HttpUrl = Field(..., description="URL of the existing image to modify")
    prompt: str = Field(..., min_length=1, max_length=1000)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "image_url": "https://r2.example.com/images/abc.png",
                "prompt": "Make the background more vibrant and professional",
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
    if source_bytes:
        edit_prompt = (
            f"You are editing the reference image. Make ONLY this specific change: {request.prompt}\n\n"
            "CRITICAL: Keep the entire composition, all characters, colors, layout, and visual style "
            "EXACTLY the same as the reference. Do NOT regenerate or redesign the image. "
            "Only apply the described change and nothing else. "
            "If the change involves text, spell every word EXACTLY as specified — no typos, no letter swaps."
        )
        b64 = await _llm.generate_image_with_image_bytes(edit_prompt, [source_bytes])
    else:
        b64 = await _llm.generate_image(request.prompt)

    image = ImageResult(image_base64=b64, content_type="image/png", prompt_used=request.prompt)
    return ImageRegenResponse(image=image, model_used="gemini-2.5-flash-image")


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
    rules = PLATFORM_RULES.get(request.platform, PLATFORM_RULES["linkedin"])
    prompt = (
        f"Revise this {request.platform} caption based on the instruction:\n\n"
        f"Current caption:\n{request.caption}\n\n"
        f"Instruction: {request.prompt}\n\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, "
        f"tone: {rules['tone']}\n\n"
        "Return JSON with exactly these fields: "
        '"caption" (updated text, ready to publish), "hashtags" (array), "cta" (string). '
        "Return ONLY the JSON object, no markdown fences."
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        from core.utils import safe_json_loads
        data = safe_json_loads(raw)
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

    total = len(content.image_prompts)

    async def _gen(prompt_data: CarouselImagePrompt, idx: int, anchor_b64: str | None = None) -> ImageResult | None:
        if not request.include_images:
            return None
        # Pass only visual direction — never slide numbers or meta text
        context = prompt_data.context_note
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
                context_hints=context,
                carousel_anchor_b64=anchor_b64,
            )
        except Exception as img_err:
            logger.error("carousel image_gen failed | slide=%d error=%s", idx + 1, img_err)
            return None

    # Step 2a: Generate slide 1 first — it defines the visual DNA for the carousel
    slide_1_image = await _gen(content.image_prompts[0], 0, anchor_b64=None)
    anchor_b64 = slide_1_image.image_base64 if slide_1_image else None

    # Step 2b: Generate remaining slides in parallel, each anchored to slide 1
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
    "Write this as one flowing creative brief paragraph (200-250 words). "
    "No numbered lists, no headers — dense, vivid, professional prose that a "
    "photographer or AI model can execute immediately."
)


@router.post("/expand-brief", response_model=ExpandBriefResponse)
async def expand_brief(request: ExpandBriefRequest):
    if settings.MOCK_MODE:
        return ExpandBriefResponse(
            expanded=f"[MOCK] Expanded brief for: {request.brief}"
        )
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
    return ExpandBriefResponse(expanded=expanded.strip())


# ── Campaign Generator ────────────────────────────────────────────────────────

_CAMPAIGN_SYSTEM_PROMPT = """You are an expert visual brand strategist and creative director specializing in high-converting social media campaign photography. Your job is to generate stunning, trend-aware product campaign images that stop the scroll.

When generating campaign images, always apply these principles:
- Study the product image provided and make it the HERO of every shot
- Match the visual language to current social media trends (bold typography zones, cinematic lighting, lifestyle integration, editorial aesthetics)
- Each image in the campaign must feel part of a cohesive series but have a DISTINCT composition (flat lay, lifestyle, close-up macro, editorial, dynamic motion blur, etc.)
- Use color grading that is rich, intentional, and on-trend — avoid flat or generic renders
- Leave clean zones for logo/text overlays when brand kit is enabled
- The mood, setting, and style must directly reflect the campaign brief provided

Output: One campaign-ready product photograph per generation call."""

_CAMPAIGN_ROLES: dict[int, list[str]] = {
    1: ["hero product shot — perfect studio lighting, product centered, clean premium background"],
    2: [
        "hero product shot — perfect studio lighting, product centered, clean premium background",
        "lifestyle/editorial — product in a natural aspirational environment with human element or context",
    ],
    3: [
        "hero product shot — perfect studio lighting, product centered, clean premium background",
        "lifestyle integration — product in a real-world aspirational environment",
        "macro/detail close-up — extreme close-up highlighting the product's most compelling feature or texture",
    ],
    4: [
        "hero product shot — perfect studio lighting, product centered, clean premium background",
        "lifestyle integration — product in a real-world aspirational environment",
        "flat lay with brand props — overhead shot with complementary lifestyle objects arranged artfully",
        "editorial/action shot — dynamic angle or motion blur, product in use or mid-motion",
    ],
    6: [
        "hero product shot — perfect studio lighting, product centered, clean premium background",
        "lifestyle integration — product in a real-world aspirational environment",
        "macro/detail close-up — extreme close-up of the product's most compelling feature",
        "flat lay with brand props — overhead shot with complementary lifestyle objects",
        "editorial/motion shot — dynamic angle, motion blur, or dramatic lighting",
        "social proof/packaging overhead — product in packaging or grouped with accessories, top-down view",
    ],
}


class CampaignRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    organization_id: str = Field("", max_length=128)
    product_image_url: str = Field(..., min_length=1)
    campaign_brief: str = Field(..., min_length=1, max_length=2000)
    photo_count: int = Field(4)
    use_brand_kit: bool = True
    platform: str = Field("instagram", pattern="^(linkedin|twitter|instagram)$")
class CampaignPhoto(BaseModel):
    image: ImageResult
    composition_role: str


class CampaignResponse(BaseModel):
    photos: list[CampaignPhoto]
    tokens_used: int
    model_used: str


def _build_campaign_style_lock(campaign_brief: str, brand_kit, platform: str) -> str:
    """Build a shared visual language spec from brand kit — injected into every photo's context
    so all N photos share the same aesthetic without locking composition (unlike anchor_b64)."""
    parts: list[str] = [
        "CAMPAIGN VISUAL CONSISTENCY — all photos in this series must share this aesthetic:"
    ]
    if brand_kit:
        if brand_kit.brand_colors:
            c = brand_kit.brand_colors
            parts.append(
                f"Colour palette: primary {c.get('primary', '')}, "
                f"secondary {c.get('secondary', '')}, accent {c.get('accent', '')}. "
                f"These tones must dominate every photo's colour grading."
            )
        if brand_kit.brand_voice:
            parts.append(f"Visual mood & energy: {brand_kit.brand_voice}.")
        if brand_kit.target_audience:
            parts.append(f"Audience aesthetic: designed to resonate with {brand_kit.target_audience}.")
    parts.append(
        f"Campaign brief: {campaign_brief}. "
        f"All photos must feel like they came from ONE professional shoot — "
        f"same lighting style, same colour grading, same atmospheric energy. "
        f"ONLY the composition and scene changes per photo."
    )
    return " ".join(parts)


@router.post("/campaign", response_model=CampaignResponse)
async def create_campaign(request: CampaignRequest):
    valid_counts = {1, 2, 3, 4, 6}
    if request.photo_count not in valid_counts:
        raise HTTPException(status_code=422, detail=f"photo_count must be one of {sorted(valid_counts)}")

    brand_kit = None
    if request.use_brand_kit and request.organization_id:
        try:
            brand_kit = await load_brand_kit(request.organization_id)
        except Exception as bk_err:
            logger.warning("campaign brand_kit load failed | org=%s error=%s", request.organization_id, bk_err)

    roles = _CAMPAIGN_ROLES.get(request.photo_count, _CAMPAIGN_ROLES[4])

    # Build a shared style description from brand kit data — gives all photos the same
    # colour/mood/energy without the carousel anchor that locks composition too tightly.
    style_lock = _build_campaign_style_lock(request.campaign_brief, brand_kit, request.platform)

    async def _gen_photo(role: str) -> CampaignPhoto | None:
        hints = (
            f"{_CAMPAIGN_SYSTEM_PROMPT}\n\n"
            f"{style_lock}\n\n"
            f"COMPOSITION STYLE FOR THIS PHOTO: {role}\n\n"
            f"CAMPAIGN BRIEF: {request.campaign_brief}"
        )
        try:
            image = await generate_social_image(
                prompt=request.campaign_brief,
                platform=request.platform,
                use_logo=request.use_brand_kit,
                use_mascot=request.use_brand_kit,
                user_id=request.user_id,
                organization_id=request.organization_id,
                brand_kit=brand_kit,
                context_hints=hints,
                reference_urls=[request.product_image_url],
                campaign_mode=True,
            )
            return CampaignPhoto(image=image, composition_role=role)
        except Exception as err:
            logger.error("campaign image_gen failed | role=%s error=%s", role, err)
            return None

    results = await asyncio.gather(*[_gen_photo(role) for role in roles], return_exceptions=True)

    photos = [p for p in results if p is not None and not isinstance(p, Exception)]

    logger.info(
        "campaign done | user=%s platform=%s photos=%d",
        request.user_id, request.platform, len(photos),
    )
    return CampaignResponse(
        photos=photos,
        tokens_used=0,
        model_used=_agent.default_model,
    )

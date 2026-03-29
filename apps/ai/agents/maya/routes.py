import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse, ImageResult
from core.config import settings
from agents.maya.agent import MayaAgent

router = APIRouter(prefix="/ai/maya", tags=["Maya"])

# Shared instances
_llm = LLMClient()
_rag = RAGService()
_agent = MayaAgent(_llm, _rag)


# ── Request / Response Models ────────────────────────────────────────────────

class IdeationRequest(BaseModel):
    user_id: str
    content_type: str = "linkedin_post"
    topic_hint: str = ""
    count: int = 5

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "content_type": "linkedin_post",
                "topic_hint": "AI productivity for founders",
                "count": 3,
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


class IdeationResponse(BaseModel):
    ideas: list[ContentIdea]
    generated_at: str


class DraftRequest(BaseModel):
    user_id: str
    content_type: str = "linkedin_post"
    topic: str
    platform: str = "linkedin"
    tone_override: str | None = None
    word_count_target: int = 250
    include_image: bool = False
    additional_context: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "content_type": "linkedin_post",
                "topic": "How AI is saving founders 10 hours per week",
                "platform": "linkedin",
                "tone_override": None,
                "word_count_target": 250,
                "include_image": False,
                "additional_context": "Focus on time-saving benefits",
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


class VariantRequest(BaseModel):
    user_id: str
    original_content: str
    original_platform: str = "linkedin"
    target_platforms: list[str] = ["twitter", "instagram"]
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


class ReviseRequest(BaseModel):
    user_id: str
    content_id: str | None = None
    original_content: str
    feedback: str
    specific_instructions: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "content_id": "post_abc123",
                "original_content": "We launched our AI tool today. It saves time.",
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


# ── Helpers ──────────────────────────────────────────────────────────────────

def _mock_ideas(count: int, topic_hint: str) -> list[ContentIdea]:
    topic = topic_hint or "AI productivity for founders"
    return [
        ContentIdea(
            title=f"How We Used AI to Save 10 Hours/Week Running Our Startup",
            content_type="linkedin_post",
            platform="linkedin",
            hook="10 hours. Every week. Back in our founders' calendars.",
            predicted_engagement="High – personal story + specific number",
            reasoning="Founder pain point + concrete benefit + first-person narrative drives high LinkedIn engagement",
            suggested_hashtags=["#Founders", "#AIProductivity", "#StartupLife", "#TimeManagement"],
        ),
        ContentIdea(
            title=f"Thread: 7 AI Workflows That Replaced Our Entire Marketing Intern",
            content_type="twitter_thread",
            platform="twitter",
            hook="We replaced a $3,000/month marketing hire with 7 AI workflows. Here's exactly what we built 🧵",
            predicted_engagement="Very High – controversial + practical + thread format",
            reasoning="Twitter threads with numbered lists and controversial angles drive massive retweets",
            suggested_hashtags=["#AITools", "#MarketingAutomation", "#IndieHackers"],
        ),
        ContentIdea(
            title=f"The Founder's Secret Weapon: AI That Actually Understands Your Brand",
            content_type="blog_post",
            platform="blog",
            hook="Most AI tools give you generic output. Here's what happens when it actually knows your brand.",
            predicted_engagement="Medium – educational + SEO potential",
            reasoning="Long-form content on 'brand-aware AI' is underserved – strong SEO + thought leadership potential",
            suggested_hashtags=["#ContentMarketing", "#AIWriting", "#FounderTools"],
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
    return await _agent.chat_sync(request)


@router.post("/generate-ideas", response_model=IdeationResponse, summary="Generate content ideas")
async def generate_ideas(request: IdeationRequest) -> IdeationResponse:
    """Generate content ideas for a given topic and content type."""
    if settings.MOCK_MODE:
        return IdeationResponse(
            ideas=_mock_ideas(request.count, request.topic_hint),
            generated_at=datetime.utcnow().isoformat(),
        )

    system = await _agent.build_system_prompt(request.user_id)
    prompt = (
        f"Generate {request.count} content ideas for {request.content_type} about: {request.topic_hint}\n\n"
        "Return JSON array of ideas with fields: title, content_type, platform, hook, predicted_engagement, reasoning, suggested_hashtags"
    )
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    try:
        ideas_data = json.loads(raw)
        ideas = [ContentIdea(**i) for i in ideas_data]
    except Exception:
        ideas = _mock_ideas(request.count, request.topic_hint)
    return IdeationResponse(ideas=ideas, generated_at=datetime.utcnow().isoformat())


@router.post("/draft-content", response_model=DraftResponse, summary="Draft content piece")
async def draft_content(request: DraftRequest) -> DraftResponse:
    """Draft a full content piece for a given platform and topic."""
    if settings.MOCK_MODE:
        draft = _mock_draft(request.topic, request.platform, request.tone_override or "")
        image = None
        if request.include_image:
            from core.image_gen import generate_social_image
            from core.brand_kit import load_brand_kit
            bk = await load_brand_kit(request.user_id)
            image = await generate_social_image(draft.title, bk, request.platform)
        return DraftResponse(draft=draft, image=image)

    from core.brand_kit import load_brand_kit, get_platform_tone
    brand_kit = await load_brand_kit(request.user_id)
    tone = request.tone_override or get_platform_tone(brand_kit, request.platform)
    system = await _agent.build_system_prompt(request.user_id)
    prompt = (
        f"Write a {request.content_type} for {request.platform} about: {request.topic}\n"
        f"Tone: {tone}\nTarget words: {request.word_count_target}\n"
        f"Additional context: {request.additional_context or 'None'}\n\n"
        "Return JSON with fields: title, body, hashtags (list), cta, meta_description, word_count, platform, tone_used"
    )
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    try:
        data = json.loads(raw)
        draft = DraftContent(**data)
    except Exception:
        draft = _mock_draft(request.topic, request.platform, tone)

    image = None
    if request.include_image:
        from core.image_gen import generate_social_image
        image = await generate_social_image(draft.title, brand_kit, request.platform)
    return DraftResponse(draft=draft, image=image)


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

    system = await _agent.build_system_prompt(request.user_id)
    import json
    variants = []
    for platform in request.target_platforms:
        prompt = (
            f"Adapt this {request.original_platform} content for {platform}:\n\n"
            f"{request.original_content}\n\n"
            "Return JSON with: platform, title, body, hashtags (list), char_count"
        )
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
        )
        try:
            data = json.loads(raw)
            variants.append(ContentVariant(**data))
        except Exception:
            pass
    return VariantResponse(variants=variants)


@router.post("/revise", response_model=ReviseResponse, summary="Revise content with feedback")
async def revise_content(request: ReviseRequest) -> ReviseResponse:
    """Revise existing content based on feedback."""
    if settings.MOCK_MODE:
        return ReviseResponse(
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

    system = await _agent.build_system_prompt(request.user_id)
    import json
    prompt = (
        f"Revise this content based on feedback:\n\nOriginal:\n{request.original_content}\n\n"
        f"Feedback: {request.feedback}\n"
        f"Specific instructions: {request.specific_instructions or 'None'}\n\n"
        "Return JSON with: revised (object with title, body, hashtags, cta), changes_made (list of strings)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    try:
        data = json.loads(raw)
        return ReviseResponse(**data)
    except Exception:
        return ReviseResponse(
            revised=RevisedContent(
                title="Revised Content",
                body=request.original_content + "\n\n[Revised based on feedback]",
                hashtags=[],
                cta="",
            ),
            changes_made=["Content revised based on provided feedback"],
        )

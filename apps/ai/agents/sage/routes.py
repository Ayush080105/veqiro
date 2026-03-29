import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from agents.sage.agent import SageAgent
from agents.sage.wordpress import format_for_wordpress, format_for_wix

router = APIRouter(prefix="/ai/sage", tags=["Sage"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = SageAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

class KeywordResearchRequest(BaseModel):
    user_id: str
    seed_topic: str
    niche: str = ""
    competitor_urls: list[str] = []
    count: int = 20

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "seed_topic": "AI productivity tools for founders",
                "niche": "SaaS",
                "competitor_urls": [],
                "count": 10,
            }
        }
    )


class KeywordItem(BaseModel):
    keyword: str
    search_intent: str  # "informational" | "navigational" | "transactional" | "commercial"
    estimated_difficulty: int  # 1-100
    relevance_score: float
    suggested_content_type: str
    related_keywords: list[str]


class KeywordCluster(BaseModel):
    cluster_name: str
    keywords: list[str]
    primary_intent: str


class KeywordResearchResponse(BaseModel):
    keywords: list[KeywordItem]
    clusters: list[KeywordCluster]


class GenerateBlogRequest(BaseModel):
    user_id: str
    topic: str
    target_keyword: str
    secondary_keywords: list[str] = []
    word_count: int = 2000
    output_format: str = "markdown"  # "markdown" | "html" | "wordpress" | "wix"
    include_meta: bool = True
    include_schema_markup: bool = False
    tone_override: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "topic": "How AI Productivity Tools Are Changing How Founders Work in 2025",
                "target_keyword": "AI productivity tools for founders",
                "secondary_keywords": ["founder tools", "AI automation startup", "startup productivity"],
                "word_count": 2000,
                "output_format": "markdown",
                "include_meta": True,
                "include_schema_markup": False,
                "tone_override": None,
            }
        }
    )


class BlogContent(BaseModel):
    title: str
    meta_title: str
    meta_description: str
    slug: str
    content: str
    word_count: int
    headings: list[str]
    target_keyword: str
    secondary_keywords: list[str]
    schema_markup: dict | None = None
    wordpress_format: dict | None = None
    wix_format: dict | None = None


class GenerateBlogResponse(BaseModel):
    blog: BlogContent
    seo_score: int
    seo_suggestions: list[str]


class AnalyzeContentRequest(BaseModel):
    user_id: str
    content: str
    target_keyword: str
    url: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "content": "AI tools are changing the way startups work...",
                "target_keyword": "AI tools for startups",
                "url": "https://myblog.com/ai-tools",
            }
        }
    )


class ContentAnalysisResponse(BaseModel):
    score: int
    issues: list[str]
    improvements: list[str]
    missing_keywords: list[str]
    readability_grade: str


class ContentBriefRequest(BaseModel):
    user_id: str
    topic: str
    target_keyword: str
    competitor_urls: list[str] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "topic": "AI productivity tools for founders",
                "target_keyword": "AI productivity tools for founders",
                "competitor_urls": [],
            }
        }
    )


class ContentBriefResponse(BaseModel):
    brief: dict


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Sage chat")
async def sage_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Sage's SEO response as a standard JSON response."""
    return await _agent.chat_sync(request)


@router.post("/keyword-research", response_model=KeywordResearchResponse, summary="Keyword research")
async def keyword_research(request: KeywordResearchRequest) -> KeywordResearchResponse:
    """Generate keyword research with intent mapping and clusters."""
    if settings.MOCK_MODE:
        topic = request.seed_topic
        keywords = [
            KeywordItem(keyword="AI productivity tools for founders", search_intent="commercial", estimated_difficulty=42,
                       relevance_score=0.98, suggested_content_type="comparison_page",
                       related_keywords=["best AI tools startups", "founder productivity apps"]),
            KeywordItem(keyword="AI tools for startup founders 2025", search_intent="informational", estimated_difficulty=35,
                       relevance_score=0.94, suggested_content_type="listicle",
                       related_keywords=["startup AI tools", "AI startup stack"]),
            KeywordItem(keyword="how to automate founder tasks with AI", search_intent="informational", estimated_difficulty=28,
                       relevance_score=0.89, suggested_content_type="how_to_guide",
                       related_keywords=["automate startup workflow", "AI task automation"]),
            KeywordItem(keyword="AI productivity software comparison", search_intent="commercial", estimated_difficulty=55,
                       relevance_score=0.85, suggested_content_type="comparison_table",
                       related_keywords=["Notion AI vs alternatives", "productivity tool reviews"]),
            KeywordItem(keyword="founder time management AI", search_intent="informational", estimated_difficulty=22,
                       relevance_score=0.82, suggested_content_type="blog_post",
                       related_keywords=["time blocking for founders", "AI calendar tools"]),
        ]
        clusters = [
            KeywordCluster(cluster_name="Top-of-funnel Awareness", keywords=["AI tools for startup founders 2025", "founder time management AI"], primary_intent="informational"),
            KeywordCluster(cluster_name="Bottom-of-funnel Conversion", keywords=["AI productivity tools for founders", "AI productivity software comparison"], primary_intent="commercial"),
        ]
        return KeywordResearchResponse(keywords=keywords[:request.count], clusters=clusters)

    system = await _agent.build_system_prompt(request.user_id)
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Generate {request.count} keywords for: {request.seed_topic} in {request.niche}. Return JSON array with fields: keyword, search_intent, estimated_difficulty, relevance_score, suggested_content_type, related_keywords"}],
    )
    try:
        items = json.loads(raw)
        keywords = [KeywordItem(**item) for item in items[:request.count]]
    except Exception:
        keywords = []
    return KeywordResearchResponse(keywords=keywords, clusters=[])


@router.post("/generate-blog", response_model=GenerateBlogResponse, summary="Generate SEO blog post")
async def generate_blog(request: GenerateBlogRequest) -> GenerateBlogResponse:
    """Generate a full SEO-optimized blog post."""
    if settings.MOCK_MODE:
        slug = request.target_keyword.lower().replace(" ", "-").replace("/", "-")
        body = f"""# {request.topic}

## Introduction

**{request.target_keyword}** are fundamentally changing how modern founders build companies. In 2025, the founders who move fastest aren't necessarily the smartest or most experienced – they're the ones who've figured out how to leverage AI as a force multiplier.

In this guide, we'll break down the exact tools, workflows, and strategies that are saving founders 10+ hours per week.

## Why Founders Need AI Productivity Tools

Running a startup means wearing 12 different hats before lunch. Marketing, product, sales, operations, finance – the list never ends. The cognitive load alone is enough to burn out even the most resilient founders.

Here's what the data shows:
- **73% of founders** report feeling overwhelmed by operational tasks (CB Insights, 2025)
- The average founder spends **3.2 hours/day** on tasks that could be automated
- Teams using AI productivity tools ship **2.4x faster** than those that don't

## The Top AI Productivity Tools for Founders in 2025

### 1. AI Content & Marketing Agents

Content creation is the biggest time sink for most founders. AI content agents can:
- Generate first drafts in minutes, not hours
- Adapt content for multiple platforms automatically
- Maintain brand voice consistency across all channels

### 2. AI Data Analysis & Forecasting

Understanding your metrics shouldn't require a data science degree. Modern AI analytics tools:
- Surface the metrics that actually matter
- Detect anomalies before they become crises
- Generate natural language summaries of complex data

### 3. AI Executive Assistant

From inbox zero to calendar management, AI assistants handle the coordination layer:
- Triage and prioritize emails automatically
- Draft contextually appropriate replies
- Identify scheduling conflicts before they happen

## How to Build Your AI Stack as a Founder

The best AI stack isn't the most expensive one – it's the one you actually use. Here's our recommended approach:

1. **Start with one workflow** – Pick your biggest time drain and solve that first
2. **Integrate, don't duplicate** – Choose tools that connect to your existing stack
3. **Measure the ROI** – Track hours saved and output quality before expanding
4. **Build feedback loops** – The best AI tools get better as they learn your preferences

## Conclusion

The future of founder productivity isn't about working harder – it's about working with AI that understands your business, your voice, and your goals.

**{request.target_keyword}** aren't a nice-to-have anymore. They're the difference between founders who scale and founders who burn out.

Ready to get started? [Try Veqiro AI free for 14 days →]
"""
        wp_format = None
        wix_format = None
        if request.output_format == "wordpress":
            wp_format = format_for_wordpress(request.topic, body, tags=request.secondary_keywords)
        elif request.output_format == "wix":
            wix_format = format_for_wix(request.topic, body, excerpt=f"Discover the best {request.target_keyword} and how to build an AI-powered workflow.", tags=request.secondary_keywords)

        blog = BlogContent(
            title=request.topic,
            meta_title=f"{request.target_keyword} | Complete Guide 2025",
            meta_description=f"Discover the best {request.target_keyword}. Our complete guide covers tools, workflows, and strategies for saving 10+ hours per week.",
            slug=slug,
            content=body,
            word_count=len(body.split()),
            headings=["Introduction", "Why Founders Need AI Productivity Tools", "The Top AI Productivity Tools for Founders in 2025", "How to Build Your AI Stack as a Founder", "Conclusion"],
            target_keyword=request.target_keyword,
            secondary_keywords=request.secondary_keywords,
            schema_markup={"@type": "Article", "headline": request.topic, "author": {"@type": "Organization", "name": "Veqiro AI"}} if request.include_schema_markup else None,
            wordpress_format=wp_format,
            wix_format=wix_format,
        )
        return GenerateBlogResponse(
            blog=blog,
            seo_score=84,
            seo_suggestions=[
                "Add 2-3 more internal links to related content",
                "Include an FAQ section with 5 common questions to target featured snippets",
                "Add alt text to all images when published",
                "Consider adding a comparison table for better scannability",
            ],
        )

    system = await _agent.build_system_prompt(request.user_id)
    import json
    tone = request.tone_override or "educational, authoritative"
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Write a {request.word_count}-word SEO blog post.\nTopic: {request.topic}\nTarget keyword: {request.target_keyword}\nSecondary keywords: {request.secondary_keywords}\nTone: {tone}\nFormat: {request.output_format}"}],
        max_tokens=4096,
    )
    slug = request.target_keyword.lower().replace(" ", "-")
    blog = BlogContent(
        title=request.topic,
        meta_title=f"{request.target_keyword} | Guide",
        meta_description=raw[:160],
        slug=slug,
        content=raw,
        word_count=len(raw.split()),
        headings=[],
        target_keyword=request.target_keyword,
        secondary_keywords=request.secondary_keywords,
    )
    return GenerateBlogResponse(blog=blog, seo_score=75, seo_suggestions=["Add more internal links"])


@router.post("/analyze-content", response_model=ContentAnalysisResponse, summary="Analyze content SEO")
async def analyze_content(request: AnalyzeContentRequest) -> ContentAnalysisResponse:
    """Analyze existing content for SEO quality and provide improvement suggestions."""
    if settings.MOCK_MODE:
        return ContentAnalysisResponse(
            score=67,
            issues=[
                "Target keyword not in meta description",
                "H1 missing – content starts directly with H2",
                "No internal links detected",
                "Content under 800 words (currently ~350)",
                "No structured data / schema markup",
            ],
            improvements=[
                f"Add '{request.target_keyword}' to the first paragraph and H1 tag",
                "Expand content to 1,500+ words to compete for this keyword",
                "Add 3-5 internal links to related content",
                "Include a meta description with target keyword (max 160 chars)",
                "Add FAQ schema markup to target featured snippets",
                "Break up long paragraphs – aim for max 3 sentences per paragraph",
            ],
            missing_keywords=["2025", "founders", "productivity", "AI automation", "workflow"],
            readability_grade="Grade 11 (Flesch-Kincaid) – consider simplifying for Grade 8-9",
        )

    system = await _agent.build_system_prompt(request.user_id)
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Analyze this content for SEO:\nTarget keyword: {request.target_keyword}\n\nContent:\n{request.content[:3000]}\n\nReturn JSON with: score (0-100), issues (list), improvements (list), missing_keywords (list), readability_grade (string)"}],
    )
    try:
        data = json.loads(raw)
        return ContentAnalysisResponse(**data)
    except Exception:
        return ContentAnalysisResponse(score=60, issues=["Analysis failed"], improvements=["Retry analysis"], missing_keywords=[], readability_grade="Unknown")


@router.post("/content-brief", response_model=ContentBriefResponse, summary="Generate content brief")
async def content_brief(request: ContentBriefRequest) -> ContentBriefResponse:
    """Generate a comprehensive SEO content brief for a given topic and keyword."""
    if settings.MOCK_MODE:
        return ContentBriefResponse(
            brief={
                "topic": request.topic,
                "target_keyword": request.target_keyword,
                "search_intent": "commercial_investigation",
                "recommended_word_count": 2200,
                "content_type": "Ultimate Guide / Comparison",
                "title_options": [
                    f"Best {request.target_keyword}: Complete Guide for 2025",
                    f"{request.target_keyword}: 10 Tools Ranked and Reviewed",
                    f"How to Choose the Right {request.target_keyword} (2025)",
                ],
                "h2_structure": [
                    "What Are AI Productivity Tools?",
                    f"Why Founders Need {request.target_keyword}",
                    "Top 10 AI Productivity Tools Compared",
                    "How to Build Your AI Productivity Stack",
                    "Real Founder Case Studies",
                    "Frequently Asked Questions",
                    "Conclusion",
                ],
                "must_include_topics": [
                    "Definition and overview",
                    "Key features to look for",
                    "Pricing comparison",
                    "Pros and cons of top tools",
                    "Getting started guide",
                ],
                "must_answer_questions": [
                    f"What are the best {request.target_keyword}?",
                    "How much do AI productivity tools cost?",
                    "Are AI productivity tools worth it for small teams?",
                    "Which AI tool is best for content creation?",
                    "How do I integrate AI tools with my existing stack?",
                ],
                "internal_linking_opportunities": [
                    "Link to: AI content marketing guide",
                    "Link to: Founder productivity checklist",
                    "Link to: SaaS metrics dashboard setup",
                ],
                "competitor_gaps": [
                    "Most competitors don't cover founder-specific workflows",
                    "Gap: No content on AI for pre-revenue founders",
                    "Opportunity: Include ROI calculator for AI tool investment",
                ],
                "cta_recommendation": "Free trial signup with specific time-saving promise",
                "estimated_traffic_potential": "800-2,500 monthly visits (12-month projection)",
            }
        )

    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Create a comprehensive SEO content brief for:\nTopic: {request.topic}\nTarget keyword: {request.target_keyword}\nReturn as detailed JSON object."}],
    )
    import json
    try:
        brief = json.loads(raw)
    except Exception:
        brief = {"topic": request.topic, "target_keyword": request.target_keyword, "content": raw}
    return ContentBriefResponse(brief=brief)

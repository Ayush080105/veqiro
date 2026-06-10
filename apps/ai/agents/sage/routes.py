import asyncio
import json
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from core.utils import safe_json_loads
from agents.sage.agent import SageAgent
from agents.sage.wordpress import format_for_wordpress, format_for_wix

router = APIRouter(prefix="/ai/sage", tags=["Sage"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = SageAgent(_llm, _rag)
register_agent(_agent)
_log = logging.getLogger(__name__)


# ── Helper functions ─────────────────────────────────────────────────────────

async def _safe_scrape(url: str) -> str | None:
    try:
        from agents.scout.scraper import scrape_url
        return (await scrape_url(url))[:2500]
    except Exception:
        return None


def compute_seo_score(
    content: str,
    title: str,
    target_kw: str,
    secondary_kws: list[str],
    meta_description: str,
    word_count: int,
    target_word_count: int,
) -> tuple[int, list[str]]:
    """Compute SEO score 0-100 from content properties. Returns (score, missing_items)."""
    score = 0
    missing: list[str] = []
    kw_lower = target_kw.lower()
    content_lower = content.lower()

    # Keyword in H1/title: +15
    if kw_lower in title.lower():
        score += 15
    else:
        missing.append(f"Add '{target_kw}' to the title (H1)")

    # Keyword in meta description: +10
    if meta_description and kw_lower in meta_description.lower():
        score += 10
    else:
        missing.append("Include target keyword in meta description")

    # Keyword in first 100 words: +10
    if kw_lower in " ".join(content.split()[:100]).lower():
        score += 10
    else:
        missing.append("Mention target keyword in the first paragraph")

    # Word count target met: +10
    if word_count >= target_word_count * 0.9:
        score += 10
    else:
        missing.append(f"Aim for ~{target_word_count} words (currently {word_count})")

    # H2 headings with keyword: up to +10
    h2_headings = re.findall(r"^#{2,3} .+", content, re.MULTILINE)
    headings_with_kw = sum(1 for h in h2_headings if kw_lower in h.lower())
    score += min(headings_with_kw * 4, 10)
    if headings_with_kw == 0:
        missing.append("Add target keyword to at least one H2 heading")

    # Secondary keywords present: up to +15
    secondary_found = sum(1 for kw in secondary_kws if kw.lower() in content_lower)
    score += min(secondary_found * 3, 15)
    if secondary_kws and secondary_found == 0:
        missing.append("Include secondary keywords naturally in the content")

    # Lists or tables present (featured snippet structure): +10
    if re.search(r"^\s*[-*\d]", content, re.MULTILINE) or "|" in content:
        score += 10
    else:
        missing.append("Add a list or table — helps win featured snippets")

    # Meta description length 120-160 chars: +5
    if meta_description and 120 <= len(meta_description) <= 160:
        score += 5
    else:
        missing.append("Write meta description between 120-160 characters")

    # CTA present: +5
    cta_phrases = ["get started", "learn more", "try", "sign up", "contact", "book", "download"]
    if any(p in content_lower for p in cta_phrases):
        score += 5
    else:
        missing.append("Add a clear call-to-action")

    # External links: +5
    if len(re.findall(r"https?://", content)) >= 2:
        score += 5
    else:
        missing.append("Link to 2+ authoritative external sources")

    return min(score, 100), missing


# ── Models ───────────────────────────────────────────────────────────────────

class KeywordResearchRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    seed_topic: str
    niche: str = ""
    competitor_urls: list[str] = []
    count: int = 20
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "seed_topic": "AI productivity tools for founders",
                "niche": "SaaS",
                "count": 10,
            }
        }
    )


class KeywordItem(BaseModel):
    keyword: str
    search_intent: str = "informational"
    estimated_difficulty: int = 50
    relevance_score: float = 0.5
    suggested_content_type: str = ""
    related_keywords: list[str] = []
    search_volume_estimate: str = "N/A"

    @field_validator("search_volume_estimate", mode="before")
    @classmethod
    def coerce_volume_to_str(cls, v: object) -> str:
        return str(v) if v is not None else "N/A"

    @field_validator("estimated_difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 50

    @field_validator("relevance_score", mode="before")
    @classmethod
    def coerce_relevance(cls, v: object) -> float:
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.5


class KeywordCluster(BaseModel):
    cluster_name: str
    keywords: list[str]
    primary_intent: str


class KeywordResearchResponse(BaseModel):
    keywords: list[KeywordItem]
    clusters: list[KeywordCluster]
    tokens_used: int = 0
    model_used: str = ""


class GenerateBlogRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    topic: str
    target_keyword: str
    secondary_keywords: list[str] = []
    word_count: int = 2000
    output_format: str = "markdown"
    include_meta: bool = True
    include_schema_markup: bool = False
    tone_override: str | None = None
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "topic": "How AI Productivity Tools Are Changing How Founders Work in 2025",
                "target_keyword": "AI productivity tools for founders",
                "secondary_keywords": ["founder tools", "AI automation startup"],
                "word_count": 2000,
                "output_format": "markdown",
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
    tokens_used: int = 0
    model_used: str = ""


class AnalyzeContentRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    content: str
    target_keyword: str
    url: str | None = None
    metadata: dict = Field(default_factory=dict)

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
    word_count: int = 0
    keyword_density: str = "0%"
    tokens_used: int = 0
    model_used: str = ""


class ContentBriefRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    topic: str
    target_keyword: str
    competitor_urls: list[str] = []
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "topic": "AI productivity tools for founders",
                "target_keyword": "AI productivity tools for founders",
            }
        }
    )


class ContentBriefData(BaseModel):
    search_intent: str = ""
    recommended_word_count: int = 1500
    content_type: str = ""
    title_options: list[str] = []
    h2_structure: list[str] = []
    must_include_topics: list[str] = []
    must_answer_questions: list[str] = []
    competitor_gaps: list[str] = []
    internal_linking_opportunities: list[str] = []
    cta_recommendation: str = ""
    estimated_traffic_potential: str = ""
    serp_features: list[str] = []
    topical_authority_tip: str = ""


class ContentBriefResponse(BaseModel):
    brief: ContentBriefData
    tokens_used: int = 0
    model_used: str = ""


class BlogIdeaItem(BaseModel):
    title: str
    topic: str
    target_keyword: str
    secondary_keywords: list[str] = []
    rationale: str = ""
    content_angle: str = ""
    estimated_difficulty: int = 50

    @field_validator("estimated_difficulty", mode="before")
    @classmethod
    def coerce_difficulty(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 50


class GenerateBlogIdeasRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    count: int = 5
    metadata: dict = Field(default_factory=dict)


class GenerateBlogIdeasResponse(BaseModel):
    ideas: list[BlogIdeaItem]
    generated_at: str = ""
    tokens_used: int = 0
    model_used: str = ""


class SerpAnalysisRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    keyword: str
    metadata: dict = Field(default_factory=dict)


class SerpAnalysisResponse(BaseModel):
    keyword: str
    serp_features: list[str] = []
    paa_questions: list[str] = []
    top_result_formats: list[str] = []
    recommended_format: str = ""
    recommended_word_count_range: str = ""
    featured_snippet_opportunity: bool = False
    featured_snippet_tip: str = ""
    competition_assessment: str = ""
    content_angle: str = ""
    tokens_used: int = 0
    model_used: str = ""


class ClusterPage(BaseModel):
    title: str
    target_keyword: str
    content_type: str = ""
    funnel_stage: str = ""
    search_intent: str = ""
    estimated_difficulty: int = 50
    priority: int = 1

    @field_validator("estimated_difficulty", "priority", mode="before")
    @classmethod
    def coerce_int(cls, v: object) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 50


class TopicalMapRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    main_topic: str
    site_stage: str = "new"
    cluster_count: int = 8
    metadata: dict = Field(default_factory=dict)


class TopicalMapResponse(BaseModel):
    pillar_topic: str = ""
    pillar_page: ClusterPage | None = None
    cluster_pages: list[ClusterPage] = []
    strategy_summary: str = ""
    estimated_weeks_to_authority: str = ""
    quick_win_page: ClusterPage | None = None
    tokens_used: int = 0
    model_used: str = ""


class MetaAlternative(BaseModel):
    meta_title: str
    meta_description: str


class MetaOptimizerRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    target_keyword: str
    page_topic: str
    existing_title: str | None = None
    existing_description: str | None = None
    brand_name: str | None = None
    metadata: dict = Field(default_factory=dict)


class MetaOptimizerResponse(BaseModel):
    meta_title: str
    meta_title_chars: int = 0
    meta_description: str
    meta_description_chars: int = 0
    alternatives: list[MetaAlternative] = []
    ctr_tips: list[str] = []
    tokens_used: int = 0
    model_used: str = ""


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Sage chat")
async def sage_chat(request: ChatRequest) -> ChatSyncResponse:
    try:
        return await _agent.chat_sync(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/keyword-research", response_model=KeywordResearchResponse, summary="Keyword research")
async def keyword_research(request: KeywordResearchRequest) -> KeywordResearchResponse:
    """Generate keyword research with SERP-backed intent mapping and clusters."""
    try:
        if settings.MOCK_MODE:
            topic = request.seed_topic
            keywords = [
                KeywordItem(keyword="AI productivity tools for founders", search_intent="commercial", estimated_difficulty=42,
                           relevance_score=0.98, suggested_content_type="comparison_page",
                           related_keywords=["best AI tools startups", "founder productivity apps"],
                           search_volume_estimate="1,200/mo"),
                KeywordItem(keyword="AI tools for startup founders 2025", search_intent="informational", estimated_difficulty=35,
                           relevance_score=0.94, suggested_content_type="listicle",
                           related_keywords=["startup AI tools", "AI startup stack"],
                           search_volume_estimate="880/mo"),
                KeywordItem(keyword="how to automate founder tasks with AI", search_intent="informational", estimated_difficulty=28,
                           relevance_score=0.89, suggested_content_type="how_to_guide",
                           related_keywords=["automate startup workflow", "AI task automation"],
                           search_volume_estimate="590/mo"),
                KeywordItem(keyword="AI productivity software comparison", search_intent="commercial", estimated_difficulty=55,
                           relevance_score=0.85, suggested_content_type="comparison_table",
                           related_keywords=["Notion AI vs alternatives", "productivity tool reviews"],
                           search_volume_estimate="2,100/mo"),
                KeywordItem(keyword="founder time management AI", search_intent="informational", estimated_difficulty=22,
                           relevance_score=0.82, suggested_content_type="blog_post",
                           related_keywords=["time blocking for founders", "AI calendar tools"],
                           search_volume_estimate="320/mo"),
            ]
            clusters = [
                KeywordCluster(cluster_name="Top-of-funnel Awareness", keywords=["AI tools for startup founders 2025", "founder time management AI", "how to automate founder tasks with AI"], primary_intent="informational"),
                KeywordCluster(cluster_name="Bottom-of-funnel Conversion", keywords=["AI productivity tools for founders", "AI productivity software comparison"], primary_intent="commercial"),
            ]
            return KeywordResearchResponse(keywords=keywords[:request.count], clusters=clusters)

        from agents.scout.scraper import serper_search, google_autocomplete
        year = datetime.now(timezone.utc).year
        niche = request.niche or ""

        # 4 parallel research operations
        autocomplete, results_general, results_questions, results_niche = await asyncio.gather(
            google_autocomplete(request.seed_topic),
            serper_search(f"{request.seed_topic} {niche} guide tutorial {year}".strip()),
            serper_search(f"site:reddit.com OR site:quora.com {request.seed_topic} questions"),
            serper_search(f"{request.seed_topic} {niche} best tools {year}".strip()),
        )

        # Build rich SERP context
        serp_snippets = [
            f"- [{r['title']}]({r.get('link', '')}): {r.get('snippet', '')}"
            for r in (results_general + results_niche)[:10]
            if r.get("title") and r.get("snippet")
        ]
        question_snippets = [
            f"- {r['snippet']}"
            for r in results_questions[:5]
            if r.get("snippet")
        ]

        serp_context = ""
        if serp_snippets:
            serp_context += f"\n\nTop ranking content for '{request.seed_topic}':\n" + "\n".join(serp_snippets[:8])
        if question_snippets:
            serp_context += "\n\nQuestions people are asking:\n" + "\n".join(question_snippets)
        if autocomplete:
            serp_context += f"\n\nGoogle autocomplete: {', '.join(autocomplete[:12])}"

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"
        prompt = (
            f"Generate {request.count} high-quality SEO keywords for: '{request.seed_topic}'"
            f"{f' in the {niche} niche' if niche else ''}.\n"
            f"{serp_context}\n\n"
            "Based on the real SERP data above, for each keyword provide:\n"
            "- keyword: the exact search query\n"
            "- search_intent: informational | navigational | transactional | commercial\n"
            "- estimated_difficulty: 1-100 (base on domain authority of ranking pages you see)\n"
            "- relevance_score: 0.0-1.0\n"
            "- suggested_content_type: e.g. 'listicle', 'how-to guide', 'comparison page', 'landing page'\n"
            "- related_keywords: list of 3 semantically related keywords\n"
            "- search_volume_estimate: rough monthly estimate as a string (e.g. '1,200/mo', 'High', 'Low')\n\n"
            "Also provide keyword_clusters grouping keywords by topic/intent.\n"
            "Each cluster: cluster_name (string), keywords (list of keyword strings), primary_intent (string).\n\n"
            "Return JSON with keys 'keywords' (array) and 'clusters' (array). Return ONLY JSON, no fences."
        )

        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        tokens_used = _llm.count_tokens(raw)

        data = safe_json_loads(raw)
        if isinstance(data, list):
            data = {"keywords": data, "clusters": []}

        keywords = []
        for item in data.get("keywords", [])[:request.count]:
            try:
                keywords.append(KeywordItem(**item))
            except Exception as e:
                _log.warning("Skipping invalid keyword item %s: %s", item, e)

        clusters = []
        for c in data.get("clusters", []):
            try:
                clusters.append(KeywordCluster(**c))
            except Exception as e:
                _log.warning("Skipping invalid cluster %s: %s", c, e)

        return KeywordResearchResponse(
            keywords=keywords,
            clusters=clusters,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/keyword-research failed")
        raise


@router.post("/generate-blog", response_model=GenerateBlogResponse, summary="Generate SEO blog post")
async def generate_blog(request: GenerateBlogRequest) -> GenerateBlogResponse:
    """Generate a full SEO-optimized blog post with SERP-informed competitor structure."""
    try:
        if settings.MOCK_MODE:
            year = datetime.now(timezone.utc).year
            slug = request.target_keyword.lower().replace(" ", "-").replace("/", "-")
            body = f"""# {request.topic}

## Introduction

**{request.target_keyword}** are fundamentally changing how modern founders build companies. In {year}, the founders who move fastest aren't necessarily the smartest — they're the ones who leverage AI as a force multiplier.

In this guide, we'll break down the exact tools, workflows, and strategies that are saving founders 10+ hours per week.

## Why Founders Need AI Productivity Tools

Running a startup means wearing 12 different hats before lunch. Marketing, product, sales, operations, finance — the list never ends.

Here's what the data shows:
- **73% of founders** report feeling overwhelmed by operational tasks (CB Insights, {year})
- The average founder spends **3.2 hours/day** on tasks that could be automated
- Teams using AI productivity tools ship **2.4x faster** than those that don't

## The Top AI Productivity Tools for Founders in {year}

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

The best AI stack isn't the most expensive one — it's the one you actually use:

1. **Start with one workflow** — Pick your biggest time drain and solve that first
2. **Integrate, don't duplicate** — Choose tools that connect to your existing stack
3. **Measure the ROI** — Track hours saved and output quality before expanding
4. **Build feedback loops** — The best AI tools get better as they learn your preferences

## Frequently Asked Questions

**What are the best AI productivity tools for founders?**
The best tools depend on your biggest bottleneck — content, data analysis, email, or scheduling.

**How much do AI productivity tools cost?**
Most modern AI tools cost $20-200/month. The ROI from 10+ hours saved per week makes them easily worth it.

## Conclusion

The future of founder productivity isn't about working harder — it's about working with AI that understands your business, your voice, and your goals.

Ready to get started? [Try Veqiro AI free →](https://veqiro.com)
"""
            wp_format = None
            wix_format = None
            if request.output_format == "wordpress":
                wp_format = format_for_wordpress(request.topic, body, tags=request.secondary_keywords)
            elif request.output_format == "wix":
                wix_format = format_for_wix(request.topic, body, excerpt=f"Discover the best {request.target_keyword}.", tags=request.secondary_keywords)

            seo_score, seo_suggestions = compute_seo_score(
                content=body,
                title=request.topic,
                target_kw=request.target_keyword,
                secondary_kws=request.secondary_keywords,
                meta_description=f"Complete guide to {request.target_keyword}. Save 10+ hours per week.",
                word_count=len(body.split()),
                target_word_count=request.word_count,
            )
            blog = BlogContent(
                title=request.topic,
                meta_title=f"{request.target_keyword} | Complete Guide {year}",
                meta_description=f"Discover the best {request.target_keyword}. Our complete guide covers tools, workflows, and strategies for saving 10+ hours per week.",
                slug=slug,
                content=body,
                word_count=len(body.split()),
                headings=["Introduction", f"Why Founders Need {request.target_keyword}", f"The Top {request.target_keyword} in {year}", "How to Build Your AI Stack as a Founder", "Frequently Asked Questions", "Conclusion"],
                target_keyword=request.target_keyword,
                secondary_keywords=request.secondary_keywords,
                schema_markup={
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": request.topic,
                "description": f"Complete guide to {request.target_keyword}. Save 10+ hours per week.",
                "keywords": [request.target_keyword] + request.secondary_keywords,
                "author": {"@type": "Organization"},
                "datePublished": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "url": f"/{slug}",
            } if request.include_schema_markup else None,
                wordpress_format=wp_format,
                wix_format=wix_format,
            )
            return GenerateBlogResponse(blog=blog, seo_score=seo_score, seo_suggestions=seo_suggestions)

        from agents.scout.scraper import serper_search, google_autocomplete
        year = datetime.now(timezone.utc).year
        today = datetime.now(timezone.utc).strftime("%B %d, %Y")

        # Pre-generation SERP research
        results_ranking, autocomplete_lsi = await asyncio.gather(
            serper_search(f'"{request.target_keyword}" guide tutorial {year}'),
            google_autocomplete(request.target_keyword),
        )

        # Scrape top 2 ranking posts for structure insights
        top_urls = [r["link"] for r in results_ranking[:2] if r.get("link")]
        scraped_texts = [t for t in await asyncio.gather(*[_safe_scrape(u) for u in top_urls]) if t]

        # Extract competitor H2 structure
        competitor_context = ""
        if scraped_texts:
            comp_h2s: list[str] = []
            for text in scraped_texts:
                comp_h2s.extend(re.findall(r"^#{1,3} (.+)$", text, re.MULTILINE)[:6])
            if comp_h2s:
                competitor_context += "\n\nCompetitor heading structures (use as inspiration, don't copy):\n" + "\n".join(f"- {h}" for h in comp_h2s[:10])

        if results_ranking:
            serp_snippets = "\n".join(
                f"- {r['title']}: {r.get('snippet', '')}"
                for r in results_ranking[:5] if r.get("title")
            )
            competitor_context += f"\n\nCurrently ranking articles:\n{serp_snippets}"

        if autocomplete_lsi:
            competitor_context += f"\n\nLSI / related keywords to weave in: {', '.join(autocomplete_lsi[:10])}"

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"
        tone = request.tone_override or "educational, authoritative, direct"

        format_instruction = (
            "Use proper HTML tags (<h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <table>, <tr>, <th>, <td>). "
            "Do NOT use Markdown syntax (no #, **, |pipes|) — output HTML only."
            if request.output_format == "html" else
            "Use Markdown syntax (# headings, **bold**, | tables |)."
        )

        prompt = (
            f"Today is {today}.\n"
            f"IMPORTANT: Write a blog post of AT LEAST {request.word_count} words. "
            f"Do not stop writing until you have reached {request.word_count} words in the article body. "
            f"Expand each section thoroughly with examples, data, and explanation to hit this target.\n\n"
            f"Topic: {request.topic}\n"
            f"Primary keyword: {request.target_keyword}\n"
            f"Secondary keywords: {', '.join(request.secondary_keywords) or 'None'}\n"
            f"Tone: {tone}\n"
            f"Output format: {request.output_format} — {format_instruction}\n"
            f"{competitor_context}\n\n"
            "Requirements:\n"
            "- Start with exactly: 'Meta Title: <title under 60 chars>' then 'Meta Description: <160 chars max, must include target keyword>'\n"
            "- Then the full blog post beginning with a H1 heading\n"
            "- Include target keyword in H1, first paragraph, and at least 2 H2 headings\n"
            "- Use H2/H3 for structure — include at least 5 H2 sections, each with 2-4 substantial paragraphs\n"
            "- Include a numbered list AND a comparison table (critical for featured snippets)\n"
            "- Weave in LSI keywords naturally — no keyword stuffing\n"
            "- Apply E-E-A-T: include specific data points, statistics, or expert framing with source URLs\n"
            "- End with a clear CTA paragraph\n"
            "- Include 2+ external links to authoritative sources (use real URLs)\n"
        )

        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=8000,
        )
        tokens_used = _llm.count_tokens(raw)

        # Extract meta fields from first 8 lines
        meta_title = f"{request.target_keyword} | Guide {year}"
        meta_description = f"Complete guide to {request.target_keyword}."
        content_lines = raw.splitlines()
        body_start = 0
        for i, line in enumerate(content_lines[:8]):
            stripped = line.strip()
            if stripped.lower().startswith("meta title:"):
                meta_title = stripped.split(":", 1)[1].strip()[:60]
                body_start = i + 1
            elif stripped.lower().startswith("meta description:"):
                meta_description = stripped.split(":", 1)[1].strip()[:160]
                body_start = i + 1

        blog_content = "\n".join(content_lines[body_start:]).strip()
        headings = re.findall(r"^#{1,3} (.+)$", blog_content, flags=re.MULTILINE)
        slug = re.sub(r"[^a-z0-9-]", "", request.target_keyword.lower().replace(" ", "-"))
        word_count = len(blog_content.split())
        title = headings[0] if headings else request.topic

        # Compute real SEO score
        seo_score, seo_suggestions = compute_seo_score(
            content=blog_content,
            title=title,
            target_kw=request.target_keyword,
            secondary_kws=request.secondary_keywords,
            meta_description=meta_description,
            word_count=word_count,
            target_word_count=request.word_count,
        )

        wp_format = None
        wix_format = None
        if request.output_format == "wordpress":
            wp_format = format_for_wordpress(request.topic, blog_content, tags=request.secondary_keywords)
        elif request.output_format == "wix":
            wix_format = format_for_wix(request.topic, blog_content, excerpt=f"Guide to {request.target_keyword}.", tags=request.secondary_keywords)

        blog = BlogContent(
            title=title,
            meta_title=meta_title,
            meta_description=meta_description,
            slug=slug,
            content=blog_content,
            word_count=word_count,
            headings=headings,
            target_keyword=request.target_keyword,
            secondary_keywords=request.secondary_keywords,
            schema_markup={
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": title,
                "description": meta_description,
                "keywords": [request.target_keyword] + request.secondary_keywords,
                "author": {"@type": "Organization"},
                "datePublished": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "url": f"/{slug}",
            } if request.include_schema_markup else None,
            wordpress_format=wp_format,
            wix_format=wix_format,
        )
        return GenerateBlogResponse(
            blog=blog,
            seo_score=seo_score,
            seo_suggestions=seo_suggestions,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/generate-blog failed")
        raise


@router.post("/analyze-content", response_model=ContentAnalysisResponse, summary="Analyze content SEO")
async def analyze_content(request: AnalyzeContentRequest) -> ContentAnalysisResponse:
    """Analyze existing content for SEO quality with SERP competitive context."""
    try:
        if settings.MOCK_MODE:
            word_count = len(request.content.split())
            return ContentAnalysisResponse(
                score=67,
                issues=[
                    "Target keyword not in meta description",
                    "H1 missing — content starts directly with H2",
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
                    "Break up long paragraphs — aim for max 3 sentences per paragraph",
                ],
                missing_keywords=["2025", "founders", "productivity", "AI automation", "workflow"],
                readability_grade="Grade 11 (Flesch-Kincaid) — consider simplifying for Grade 8-9",
                word_count=word_count,
                keyword_density="1.2%",
            )

        from agents.scout.scraper import serper_search, scrape_url
        year = datetime.now(timezone.utc).year
        content = request.content

        # If URL provided, scrape live page
        if request.url:
            try:
                scraped = await scrape_url(request.url)
                if scraped and len(scraped) > len(content):
                    content = scraped
            except Exception:
                pass

        # SERP competitive check
        competitor_context = ""
        try:
            results = await serper_search(f"{request.target_keyword} {year}")
            if results:
                snippets = "\n".join(
                    f"- {r['title']}: {r.get('snippet', '')}"
                    for r in results[:5] if r.get("title")
                )
                competitor_context = (
                    f"\n\nCurrently ranking pages for '{request.target_keyword}':\n{snippets}\n"
                    "Use these to identify what specific gaps this content has vs. what's ranking."
                )
        except Exception:
            pass

        # Algorithmic score
        word_count = len(content.split())
        kw_lower = request.target_keyword.lower()
        kw_occurrences = content.lower().count(kw_lower)
        keyword_density = f"{round(kw_occurrences / max(word_count, 1) * 100, 1)}%"
        headings = re.findall(r"^#{1,3} (.+)$", content, re.MULTILINE)
        title = headings[0] if headings else ""
        meta_description = ""
        for line in content.splitlines()[:5]:
            if line.strip().lower().startswith("meta description:"):
                meta_description = line.split(":", 1)[1].strip()

        algo_score, algo_missing = compute_seo_score(
            content=content,
            title=title,
            target_kw=request.target_keyword,
            secondary_kws=[],
            meta_description=meta_description,
            word_count=word_count,
            target_word_count=1500,
        )

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"
        prompt = (
            f"Perform a detailed SEO audit on this content.\n"
            f"Target keyword: {request.target_keyword}\n"
            f"{'URL: ' + request.url if request.url else ''}\n"
            f"{competitor_context}\n\n"
            f"Content:\n{content[:3500]}\n\n"
            "Return JSON with:\n"
            "- issues: list of specific SEO problems (name the exact heading/section where possible)\n"
            "- improvements: list of actionable fixes with clear instructions\n"
            "- missing_keywords: important related keywords to add\n"
            "- readability_grade: Flesch-Kincaid grade level estimate\n"
            "Return ONLY the JSON, no markdown fences."
        )
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        tokens_used = _llm.count_tokens(raw)

        data = safe_json_loads(raw)
        all_issues = list(data.get("issues", []))
        for item in algo_missing:
            if item not in all_issues:
                all_issues.insert(0, item)

        return ContentAnalysisResponse(
            score=algo_score,
            issues=all_issues,
            improvements=list(data.get("improvements", [])),
            missing_keywords=list(data.get("missing_keywords", [])),
            readability_grade=str(data.get("readability_grade", "N/A")),
            word_count=word_count,
            keyword_density=keyword_density,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/analyze-content failed")
        raise


@router.post("/content-brief", response_model=ContentBriefResponse, summary="Generate content brief")
async def content_brief(request: ContentBriefRequest) -> ContentBriefResponse:
    """Generate a comprehensive structured SEO content brief with real competitor analysis."""
    try:
        if settings.MOCK_MODE:
            return ContentBriefResponse(
                brief=ContentBriefData(
                    search_intent="commercial_investigation",
                    recommended_word_count=2200,
                    content_type="Ultimate Guide / Comparison",
                    title_options=[
                        f"Best {request.target_keyword}: Complete Guide for 2025",
                        f"{request.target_keyword}: 10 Tools Ranked and Reviewed",
                        f"How to Choose the Right {request.target_keyword} (2025)",
                    ],
                    h2_structure=[
                        f"What Are {request.target_keyword}?",
                        f"Why Founders Need {request.target_keyword}",
                        "Top 10 Tools Compared",
                        "How to Build Your Stack",
                        "Real Case Studies",
                        "Frequently Asked Questions",
                    ],
                    must_include_topics=[
                        "Definition and overview",
                        "Key features to look for",
                        "Pricing comparison",
                        "Pros and cons of top tools",
                        "Getting started guide",
                    ],
                    must_answer_questions=[
                        f"What are the best {request.target_keyword}?",
                        "How much do they cost?",
                        "Are they worth it for small teams?",
                        "How do I integrate them with my existing stack?",
                    ],
                    competitor_gaps=[
                        "Most competitors don't cover founder-specific workflows",
                        "Gap: No content on AI for pre-revenue founders",
                        "Opportunity: Include ROI calculator",
                    ],
                    internal_linking_opportunities=[
                        "Link to: AI content marketing guide",
                        "Link to: Founder productivity checklist",
                    ],
                    cta_recommendation="Free trial signup with specific time-saving promise",
                    estimated_traffic_potential="800-2,500 monthly visits (12-month projection)",
                    serp_features=["featured snippet", "PAA box"],
                    topical_authority_tip="Write a 'AI stack for pre-revenue founders' post next to build topical authority in this cluster.",
                )
            )

        from agents.scout.scraper import serper_search, google_autocomplete
        year = datetime.now(timezone.utc).year

        # Always research SERP + autocomplete
        results_serp, autocomplete_paa = await asyncio.gather(
            serper_search(f"{request.target_keyword} {year}"),
            google_autocomplete(request.target_keyword),
        )

        # Detect SERP features
        serp_features: list[str] = []
        for r in results_serp[:5]:
            if r.get("imageUrl") and "image pack" not in serp_features:
                serp_features.append("image pack")
            title_snippet = (r.get("title", "") + " " + r.get("snippet", "")).lower()
            if "video" in title_snippet and "video carousel" not in serp_features:
                serp_features.append("video carousel")

        # Scrape competitors (user-provided or top SERP results)
        urls_to_scrape = list(request.competitor_urls[:3])
        if not urls_to_scrape:
            urls_to_scrape = [r["link"] for r in results_serp[:3] if r.get("link")]

        scraped = [t for t in await asyncio.gather(*[_safe_scrape(u) for u in urls_to_scrape]) if t]

        # Build competitor context
        competitor_context = ""
        if scraped:
            comp_summaries = []
            for i, text in enumerate(scraped[:3], 1):
                h2s = re.findall(r"^#{1,3} (.+)$", text, re.MULTILINE)[:5]
                comp_summaries.append(f"Competitor {i} headings: {h2s}\nSnippet: {text[:500]}")
            competitor_context = "\n\nCompetitor analysis:\n" + "\n---\n".join(comp_summaries)

        if results_serp:
            serp_snippets = "\n".join(
                f"- [{r.get('title', '')}]({r.get('link', '')}): {r.get('snippet', '')}"
                for r in results_serp[:6] if r.get("title")
            )
            competitor_context += f"\n\nTop SERP results:\n{serp_snippets}"

        if autocomplete_paa:
            competitor_context += f"\n\nRelated searches: {', '.join(autocomplete_paa[:10])}"

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"
        prompt = (
            f"Create a comprehensive SEO content brief for a real content team.\n"
            f"Topic: {request.topic}\n"
            f"Target keyword: {request.target_keyword}\n"
            f"{competitor_context}\n\n"
            "Return a JSON object with EXACTLY these keys:\n"
            "- search_intent: informational | commercial | transactional | navigational\n"
            "- recommended_word_count: integer based on competitor benchmarks\n"
            "- content_type: e.g. 'Ultimate Guide', 'Listicle', 'Comparison Page', 'How-To'\n"
            "- title_options: list of 3 compelling title variations\n"
            "- h2_structure: ordered list of H2 headings to include\n"
            "- must_include_topics: list of topics that MUST be covered\n"
            "- must_answer_questions: list of specific questions the content must answer\n"
            "- competitor_gaps: list of topics/angles competitors are missing that we can own\n"
            "- internal_linking_opportunities: list of related content to link to\n"
            "- cta_recommendation: specific CTA recommendation\n"
            "- estimated_traffic_potential: realistic monthly traffic estimate\n"
            "- serp_features: list of SERP features this keyword triggers\n"
            "- topical_authority_tip: what related content to publish NEXT to build topical authority\n"
            "Return ONLY the JSON, no markdown fences."
        )

        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        tokens_used = _llm.count_tokens(raw)

        data = safe_json_loads(raw)
        # Merge algorithmically detected SERP features
        if serp_features:
            existing = data.get("serp_features") or []
            if isinstance(existing, list):
                data["serp_features"] = list(dict.fromkeys(serp_features + existing))

        brief = ContentBriefData(**{k: v for k, v in data.items() if k in ContentBriefData.model_fields})
        return ContentBriefResponse(
            brief=brief,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/content-brief failed")
        raise


@router.post("/generate-blog-ideas", response_model=GenerateBlogIdeasResponse, summary="Generate blog post ideas")
async def generate_blog_ideas(request: GenerateBlogIdeasRequest) -> GenerateBlogIdeasResponse:
    """Generate trending blog post ideas tailored to the company's brandkit."""
    try:
        from core.brand_kit import load_brand_kit

        brand_kit = await load_brand_kit(request.organization_id)
        generated_at = datetime.now(timezone.utc).isoformat()

        if settings.MOCK_MODE:
            ideas = [
                BlogIdeaItem(
                    title=f"How {brand_kit.company_name or 'AI Tools'} Is Changing the Way Founders Build in 2025",
                    topic="AI-powered founder productivity and business operations",
                    target_keyword="AI tools for founders 2025",
                    secondary_keywords=["founder productivity", "startup AI stack", "AI automation"],
                    rationale="Founders are actively searching for ways to reduce operational overhead; this positions your product at the intersection of a high-intent commercial query.",
                    content_angle="Walk through a day-in-the-life of a founder who delegates repetitive work to AI — show the before/after time savings with real numbers.",
                    estimated_difficulty=38,
                ),
                BlogIdeaItem(
                    title=f"The {brand_kit.industry or 'SaaS'} Founder's Guide to Scaling Without Hiring",
                    topic="Lean scaling strategies using AI and automation for early-stage startups",
                    target_keyword=f"scaling {brand_kit.industry or 'startup'} without hiring",
                    secondary_keywords=["lean startup operations", "AI agents for business", "no-hire scale"],
                    rationale="Budget-constrained founders are searching for alternatives to headcount growth; combines high SEO opportunity with strong brand alignment.",
                    content_angle="Contrast the traditional hire-to-scale model with an AI-first operations stack, and show exactly which roles can be augmented first.",
                    estimated_difficulty=31,
                ),
                BlogIdeaItem(
                    title=f"10 Ways {brand_kit.target_audience or 'Startup Founders'} Are Using AI to Outpace Competitors in 2025",
                    topic="Practical AI use cases for competitive advantage in startup contexts",
                    target_keyword="AI competitive advantage startups",
                    secondary_keywords=["startup AI use cases", "AI business strategy", "competitive intelligence AI"],
                    rationale="Listicle format captures featured snippet opportunities; high share potential on LinkedIn among your target audience.",
                    content_angle="Interview-style listicle — frame each use case as something a real founder discovered, making the content feel earned and credible.",
                    estimated_difficulty=45,
                ),
                BlogIdeaItem(
                    title="The Real Cost of Not Using AI in Your Business (2025 Data)",
                    topic="Quantifying the opportunity cost of manual processes vs AI-augmented workflows",
                    target_keyword="cost of not using AI business",
                    secondary_keywords=["AI ROI for startups", "AI time savings", "manual vs automated workflow"],
                    rationale="Loss-aversion framing consistently outperforms benefit-led headlines; taps into a growing search trend as AI adoption becomes mainstream.",
                    content_angle="Lead with a provocative cost calculation (hours × hourly rate × manual tasks), then reveal how AI addresses each line item.",
                    estimated_difficulty=28,
                ),
                BlogIdeaItem(
                    title=f"What the Best {brand_kit.industry or 'Tech'} Founders Do in the First 90 Days",
                    topic="High-leverage early-stage founder habits and tooling decisions",
                    target_keyword=f"first 90 days {brand_kit.industry or 'startup'} founder",
                    secondary_keywords=["early stage startup checklist", "founder habits", "startup operations 90 days"],
                    rationale="High-intent audience researching what 'good' looks like; strong internal linking opportunity to product-specific content.",
                    content_angle="Structure as a day-by-day playbook with explicit tool and AI recommendations woven in naturally at each stage.",
                    estimated_difficulty=33,
                ),
            ]
            return GenerateBlogIdeasResponse(ideas=ideas[:request.count], generated_at=generated_at)

        from agents.scout.scraper import serper_search, google_autocomplete

        # Build company context for the prompt
        company_ctx_parts = []
        if brand_kit.company_name:
            company_ctx_parts.append(f"Company: {brand_kit.company_name}")
        if brand_kit.company_description:
            company_ctx_parts.append(f"Description: {brand_kit.company_description}")
        if brand_kit.industry:
            company_ctx_parts.append(f"Industry: {brand_kit.industry}")
        if brand_kit.target_audience:
            company_ctx_parts.append(f"Target audience: {brand_kit.target_audience}")
        if brand_kit.key_differentiators:
            company_ctx_parts.append(f"Key differentiators: {', '.join(brand_kit.key_differentiators[:5])}")
        company_ctx = "\n".join(company_ctx_parts) if company_ctx_parts else "Early-stage SaaS startup"

        # Research trending topics in the company's space
        year = datetime.now(timezone.utc).year
        industry = brand_kit.industry or "startup"
        audience = brand_kit.target_audience or "founders"

        trending_results, autocomplete_terms = await asyncio.gather(
            serper_search(f"trending {industry} blog topics {year} {audience}"),
            google_autocomplete(f"best blog topics for {industry} {year}"),
        )

        trending_snippets = "\n".join(
            f"- {r['title']}: {r.get('snippet', '')}"
            for r in trending_results[:8] if r.get("title")
        )
        autocomplete_str = ", ".join(autocomplete_terms[:12]) if autocomplete_terms else ""

        serp_context = ""
        if trending_snippets:
            serp_context += f"\n\nCurrently trending content in '{industry}':\n{trending_snippets}"
        if autocomplete_str:
            serp_context += f"\n\nWhat people are searching for: {autocomplete_str}"

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"
        prompt = (
            f"Generate {request.count} high-quality, trendy blog post IDEAS for this company.\n\n"
            f"Company context:\n{company_ctx}\n"
            f"{serp_context}\n\n"
            "Requirements:\n"
            "- Each idea must be genuinely relevant to the company's industry and target audience\n"
            "- Titles must be specific, compelling, and optimised for SEO — not generic\n"
            "- Target keywords must be realistic search queries people actually use\n"
            "- Rationale must explain WHY this topic is trending/high-value for this company specifically\n"
            "- Content angle must describe a distinctive hook that makes this post stand out vs competitors\n\n"
            "Return JSON with a key 'ideas' containing an array of objects. Each object must have:\n"
            "- title: compelling, SEO-optimised blog post title\n"
            "- topic: one-sentence description of the content theme\n"
            "- target_keyword: the primary search keyword to rank for\n"
            "- secondary_keywords: array of 3-5 related keywords\n"
            "- rationale: 1-2 sentences on WHY this is valuable for this company right now\n"
            "- content_angle: 1-2 sentences describing the distinctive hook/perspective\n"
            "- estimated_difficulty: integer 1-100 (SEO difficulty)\n\n"
            "Return ONLY JSON, no markdown fences."
        )

        raw = await _llm.complete(
            provider=_agent.default_provider,
            model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
        )
        tokens_used = _llm.count_tokens(raw)

        data = safe_json_loads(raw)
        ideas: list[BlogIdeaItem] = []
        for item in data.get("ideas", [])[:request.count]:
            try:
                ideas.append(BlogIdeaItem(**item))
            except Exception as e:
                _log.warning("Skipping invalid blog idea %s: %s", item, e)

        return GenerateBlogIdeasResponse(
            ideas=ideas,
            generated_at=generated_at,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/generate-blog-ideas failed")
        raise


@router.post("/serp-analysis", response_model=SerpAnalysisResponse, summary="SERP feature analysis")
async def serp_analysis(request: SerpAnalysisRequest) -> SerpAnalysisResponse:
    """Deep-dive a keyword's SERP: features, PAA questions, content format, and competitive angle."""
    try:
        if settings.MOCK_MODE:
            return SerpAnalysisResponse(
                keyword=request.keyword,
                serp_features=["featured_snippet", "people_also_ask"],
                paa_questions=[f"What is {request.keyword}?", f"How does {request.keyword} work?", f"Is {request.keyword} worth it?"],
                top_result_formats=["ultimate_guide", "listicle", "how-to"],
                recommended_format="Write a comprehensive ultimate guide with an FAQ section targeting PAA",
                recommended_word_count_range="2,000–3,500 words",
                featured_snippet_opportunity=True,
                featured_snippet_tip="Open with a concise 40-60 word definition block immediately under the H1",
                competition_assessment="Moderate — mix of DA 40-70 sites, winnable with strong E-E-A-T and cluster strategy",
                content_angle="Focus on practical implementation steps that competitors skip",
            )

        from agents.scout.scraper import serper_search_rich
        rich = await serper_search_rich(request.keyword)
        organic = rich.get("organic", [])
        paa = rich.get("paa", [])
        features = rich.get("serp_features", [])
        featured = rich.get("featured_snippet")

        context = f"Keyword: {request.keyword}\n"
        context += f"SERP features detected: {', '.join(features) if features else 'none'}\n"
        if featured:
            context += f"Featured snippet: {json.dumps(featured)[:400]}\n"
        if paa:
            context += f"People Also Ask: {'; '.join(paa[:6])}\n"
        if organic:
            context += "Top results:\n" + "\n".join(f"- {r['title']}: {r.get('snippet','')}" for r in organic[:8])

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"

        prompt = (
            f"{context}\n\n"
            "Analyse this SERP data and return JSON with:\n"
            "- keyword\n"
            "- serp_features: list of feature strings (use the detected ones above)\n"
            "- paa_questions: list of PAA questions (use the real ones above)\n"
            "- top_result_formats: list of content formats you see in top results\n"
            "- recommended_format: exact format recommendation\n"
            "- recommended_word_count_range: e.g. '2,000–3,500 words'\n"
            "- featured_snippet_opportunity: true/false\n"
            "- featured_snippet_tip: how to capture it\n"
            "- competition_assessment: honest difficulty verdict\n"
            "- content_angle: distinctive angle to differentiate\n"
            "Return ONLY JSON, no markdown fences."
        )
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
        )
        tokens_used = _llm.count_tokens(raw)
        data = safe_json_loads(raw)
        data["serp_features"] = data.get("serp_features") or features
        data["paa_questions"] = data.get("paa_questions") or paa
        return SerpAnalysisResponse(
            **{k: v for k, v in data.items() if k in SerpAnalysisResponse.model_fields},
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/serp-analysis failed")
        raise


@router.post("/topical-map", response_model=TopicalMapResponse, summary="Topic cluster map")
async def topical_map(request: TopicalMapRequest) -> TopicalMapResponse:
    """Build a hub-and-spoke content cluster map for a pillar topic."""
    try:
        if settings.MOCK_MODE:
            pillar = ClusterPage(title=f"The Ultimate Guide to {request.main_topic}", target_keyword=request.main_topic, content_type="Ultimate guide", funnel_stage="TOFU", search_intent="informational", estimated_difficulty=45, priority=1)
            return TopicalMapResponse(
                pillar_topic=request.main_topic,
                pillar_page=pillar,
                cluster_pages=[
                    ClusterPage(title=f"How to Get Started with {request.main_topic}", target_keyword=f"how to start {request.main_topic}", content_type="How-to guide", funnel_stage="TOFU", search_intent="informational", estimated_difficulty=25, priority=1),
                    ClusterPage(title=f"Best {request.main_topic} Tools in 2025", target_keyword=f"best {request.main_topic} tools", content_type="Listicle", funnel_stage="MOFU", search_intent="commercial", estimated_difficulty=40, priority=2),
                ],
                strategy_summary=f"Build topical authority on '{request.main_topic}' by publishing the pillar page first, then adding cluster pages weekly.",
                estimated_weeks_to_authority="12–16 weeks at 2 posts/week",
                quick_win_page=ClusterPage(title=f"How to Get Started with {request.main_topic}", target_keyword=f"how to start {request.main_topic}", content_type="How-to guide", funnel_stage="TOFU", search_intent="informational", estimated_difficulty=25, priority=1),
            )

        from agents.scout.scraper import serper_search_rich
        rich = await serper_search_rich(request.main_topic)
        paa = rich.get("paa", [])
        related = rich.get("related_searches", [])
        organic = rich.get("organic", [])

        difficulty_guidance = {
            "new": "max difficulty 35 — target low-competition, long-tail keywords only",
            "growing": "difficulty up to 55 — mix of mid-competition keywords",
            "established": "difficulty up to 75 — can target competitive head terms",
        }.get(request.site_stage, "max difficulty 35")

        context = f"Main topic: {request.main_topic}\nSite stage: {request.site_stage} ({difficulty_guidance})\n"
        if paa:
            context += f"Questions people are searching: {'; '.join(paa[:6])}\n"
        if related:
            context += f"Related searches: {', '.join(related[:8])}\n"
        if organic:
            context += "What's ranking now:\n" + "\n".join(f"- {r['title']}" for r in organic[:6])

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"

        prompt = (
            f"{context}\n\n"
            f"Create a hub-and-spoke topic cluster map: 1 pillar page + {request.cluster_count} cluster pages.\n"
            "Each page object must have: title, target_keyword, content_type, funnel_stage (TOFU/MOFU/BOFU), "
            "search_intent (informational/commercial/transactional/navigational), estimated_difficulty (int), priority (int, 1=first).\n\n"
            "Return JSON with:\n"
            "- pillar_topic\n- pillar_page (page object)\n- cluster_pages (array)\n"
            "- strategy_summary (2-3 sentences)\n- estimated_weeks_to_authority\n"
            "- quick_win_page (full page object — the single cluster page to write first)\n"
            "Return ONLY JSON, no markdown fences."
        )
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
        )
        tokens_used = _llm.count_tokens(raw)
        data = safe_json_loads(raw)

        def _parse_page(obj: dict | None) -> ClusterPage | None:
            if not obj or not isinstance(obj, dict):
                return None
            try:
                return ClusterPage(**obj)
            except Exception:
                return None

        cluster_pages = []
        for item in data.get("cluster_pages", [])[:request.cluster_count]:
            p = _parse_page(item)
            if p:
                cluster_pages.append(p)

        return TopicalMapResponse(
            pillar_topic=data.get("pillar_topic", request.main_topic),
            pillar_page=_parse_page(data.get("pillar_page")),
            cluster_pages=cluster_pages,
            strategy_summary=data.get("strategy_summary", ""),
            estimated_weeks_to_authority=data.get("estimated_weeks_to_authority", ""),
            quick_win_page=_parse_page(data.get("quick_win_page")),
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/topical-map failed")
        raise


@router.post("/meta-optimizer", response_model=MetaOptimizerResponse, summary="Meta title & description optimiser")
async def meta_optimizer(request: MetaOptimizerRequest) -> MetaOptimizerResponse:
    """Optimise or generate meta title (≤60 chars) and meta description (≤160 chars) for maximum CTR."""
    try:
        if settings.MOCK_MODE:
            title = f"{request.target_keyword.title()} — Complete Guide"[:60]
            desc = f"Learn everything about {request.target_keyword}. Step-by-step guide with real examples. Start ranking today."[:160]
            return MetaOptimizerResponse(
                meta_title=title,
                meta_title_chars=len(title),
                meta_description=desc,
                meta_description_chars=len(desc),
                alternatives=[MetaAlternative(meta_title=f"How to Master {request.target_keyword}"[:60], meta_description=f"The complete {request.target_keyword} playbook used by top founders. Free guide — no fluff, just results."[:160])],
                ctr_tips=["Keyword appears in first 3 words of title", "Description answers 'what's in it for me'", "Action verb drives click intent"],
            )

        from core.brand_kit import load_brand_kit
        brand_kit = await load_brand_kit(request.organization_id)
        brand_name = request.brand_name or brand_kit.company_name or ""

        existing_ctx = ""
        if request.existing_title:
            existing_ctx += f"Current title ({len(request.existing_title)} chars): {request.existing_title}\n"
        if request.existing_description:
            existing_ctx += f"Current description ({len(request.existing_description)} chars): {request.existing_description}\n"

        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"

        prompt = (
            f"Optimise meta tags for maximum CTR.\n"
            f"Target keyword: {request.target_keyword}\n"
            f"Page topic: {request.page_topic}\n"
            f"Brand name: {brand_name}\n"
            f"{existing_ctx}\n"
            "Hard rules:\n"
            "- meta_title MUST be ≤60 characters. Include keyword naturally. Use a power word.\n"
            "- meta_description MUST be ≤160 characters. Include keyword. State clear benefit. Subtle CTA.\n"
            "- Provide 2 alternative pairs.\n"
            "- Explain 3 specific reasons these will improve CTR.\n\n"
            "Return JSON with:\n"
            "- meta_title (string ≤60 chars)\n- meta_title_chars (int)\n"
            "- meta_description (string ≤160 chars)\n- meta_description_chars (int)\n"
            "- alternatives: array of 2 objects each with meta_title and meta_description\n"
            "- ctr_tips: array of 3 strings\n"
            "Return ONLY JSON, no markdown fences."
        )
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}],
        )
        tokens_used = _llm.count_tokens(raw)
        data = safe_json_loads(raw)

        meta_title = str(data.get("meta_title", ""))[:60]
        meta_desc = str(data.get("meta_description", ""))[:160]
        alts = []
        for a in data.get("alternatives", [])[:2]:
            if isinstance(a, dict):
                alts.append(MetaAlternative(
                    meta_title=str(a.get("meta_title", ""))[:60],
                    meta_description=str(a.get("meta_description", ""))[:160],
                ))

        return MetaOptimizerResponse(
            meta_title=meta_title,
            meta_title_chars=len(meta_title),
            meta_description=meta_desc,
            meta_description_chars=len(meta_desc),
            alternatives=alts,
            ctr_tips=data.get("ctr_tips", [])[:3],
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/meta-optimizer failed")
        raise


# ── SEO Page Audit ────────────────────────────────────────────────────────────

class PageAuditRequest(BaseModel):
    url: str
    target_keyword: str
    user_id: str
    organization_id: str = ""
    metadata: dict = {}


class UrlAnalysis(BaseModel):
    url: str; is_https: bool; keyword_in_slug: bool
    url_length: int; url_depth: int; has_stop_words: bool
    slug: str; score: int; issues: list[str]


class TechnicalSeoAudit(BaseModel):
    score: int
    title: str; title_length: int; title_has_keyword: bool; title_has_brand: bool
    meta_description: str; meta_description_length: int
    meta_description_has_keyword: bool; meta_description_has_cta: bool
    has_canonical: bool; canonical_url: str | None; canonical_is_self: bool
    is_indexable: bool; is_followable: bool
    h1_count: int; h1_text: str; h1_has_keyword: bool
    h2_count: int; h3_count: int; keyword_in_h2: bool
    heading_hierarchy_valid: bool; heading_hierarchy_issues: list[str]
    has_schema_markup: bool; schema_types: list[str]; schema_issues: list[str]
    schema_eligible_rich_results: list[str]
    has_og_tags: bool; og_title: str; og_description: str; og_image: str
    has_twitter_card: bool; has_viewport: bool; has_hreflang: bool
    has_preconnect_hints: bool
    issues: list[str]


class SpeedSignals(BaseModel):
    score: int
    render_blocking_scripts: int; render_blocking_stylesheets: int
    total_external_requests: int
    images_lazy_loaded: int; images_not_lazy_loaded: int
    images_using_modern_format: int; images_total: int
    has_inline_critical_css: bool; has_font_preloading: bool
    issues: list[str]


class ImageSeoAudit(BaseModel):
    score: int
    images_total: int; images_missing_alt: int
    images_with_descriptive_alt: int; images_with_generic_alt: int
    images_with_keyword_filename: int
    images_with_dimensions: int; images_without_dimensions: int
    webp_avif_percentage: float
    issues: list[str]


class OnPageSeoAudit(BaseModel):
    score: int
    word_count: int; reading_time_minutes: int
    keyword_density: str; keyword_occurrences: int
    keyword_in_title: bool; keyword_in_h1: bool; keyword_in_meta: bool
    keyword_in_first_100_words: bool; keyword_in_h2s: bool; keyword_in_last_paragraph: bool
    lsi_keywords_found: list[str]; lsi_keywords_missing: list[str]
    paa_answered: list[str]; paa_unanswered: list[str]
    has_featured_snippet_structure: bool; featured_snippet_type: str | None
    has_faq_section: bool
    content_freshness: str | None; last_modified: str | None
    readability_grade: str; content_depth_assessment: str
    anchor_text_generic_count: int; anchor_text_descriptive_count: int
    issues: list[str]; improvements: list[str]


class EeatAudit(BaseModel):
    score: int
    has_author_byline: bool; has_author_bio: bool
    has_publication_date: bool; has_updated_date: bool
    has_external_citations: bool; citation_count: int
    has_authoritative_citations: bool
    has_trust_links: bool; has_social_proof_schema: bool
    credentials_signals: list[str]; missing_signals: list[str]
    issues: list[str]


class CompetitorSnapshot(BaseModel):
    url: str; title: str; meta_description: str
    word_count_estimate: int; main_h2s: list[str]
    schema_types: list[str]; main_topics: list[str]


class CompetitiveSeoAudit(BaseModel):
    score: int
    serp_features_present: list[str]; serp_features_missing: list[str]
    avg_competitor_word_count: int; your_word_count: int; word_count_gap: int
    word_count_verdict: str
    top_competitors: list[CompetitorSnapshot]
    content_gaps: list[str]; unique_angle_opportunity: str
    featured_snippet_holder: str | None; featured_snippet_format: str | None
    featured_snippet_tip: str
    paa_questions: list[str]; competitor_schema_types: list[str]


class PageSeoAuditResponse(BaseModel):
    url: str; target_keyword: str; overall_score: int
    url_analysis: UrlAnalysis
    technical: TechnicalSeoAudit
    speed_signals: SpeedSignals
    image_seo: ImageSeoAudit
    on_page: OnPageSeoAudit
    eeat: EeatAudit
    competitive: CompetitiveSeoAudit
    critical_issues: list[str]; high_priority: list[str]
    medium_priority: list[str]; quick_wins: list[str]
    mentor_summary: str; next_move: str
    action_plan_30d: list[str]; action_plan_60d: list[str]; action_plan_90d: list[str]
    tokens_used: int = 0; model_used: str = ""


def _parse_html_seo(html: str, page_url: str, target_keyword: str) -> dict:
    """Comprehensive HTML parsing for all SEO signals. Pure Python — no external calls."""
    from bs4 import BeautifulSoup
    import urllib.parse as up

    kw = target_keyword.lower()
    soup = BeautifulSoup(html, "html.parser")
    parsed_base = up.urlparse(page_url)
    base_netloc = parsed_base.netloc

    # ── Title ──
    title_tag = soup.find("title")
    title = title_tag.get_text().strip() if title_tag else ""

    # ── Meta description ──
    meta_desc_tag = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
    meta_desc = meta_desc_tag.get("content", "").strip() if meta_desc_tag else ""

    # ── Canonical ──
    canonical_tag = soup.find("link", attrs={"rel": re.compile(r"canonical", re.I)})
    canonical_url = canonical_tag.get("href", "").strip() if canonical_tag else None

    # ── Robots meta ──
    robots_tag = soup.find("meta", attrs={"name": re.compile(r"robots", re.I)})
    robots_content = robots_tag.get("content", "").lower() if robots_tag else ""
    is_indexable = "noindex" not in robots_content
    is_followable = "nofollow" not in robots_content

    # ── Headings ──
    h1_tags = soup.find_all("h1")
    h2_tags = soup.find_all("h2")
    h3_tags = soup.find_all("h3")
    h4_tags = soup.find_all("h4")
    h1_texts = [h.get_text().strip() for h in h1_tags]
    h2_texts = [h.get_text().strip() for h in h2_tags]
    h3_texts = [h.get_text().strip() for h in h3_tags]

    # Heading hierarchy check
    heading_issues = []
    all_headings = [(int(h.name[1]), h.get_text().strip()) for h in soup.find_all(["h1","h2","h3","h4","h5","h6"])]
    if not h1_tags:
        heading_issues.append("Missing H1 tag")
    elif len(h1_tags) > 1:
        heading_issues.append(f"Multiple H1 tags found ({len(h1_tags)}) — should be exactly 1")
    prev_level = 0
    for level, _ in all_headings:
        if prev_level and level > prev_level + 1:
            heading_issues.append(f"Heading hierarchy skip: H{prev_level} → H{level}")
            break
        prev_level = level

    # ── Schema markup ──
    schema_scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    schema_types, schema_issues, eligible_rich = [], [], []
    for s in schema_scripts:
        try:
            data = json.loads(s.string or "")
            t = data.get("@type", "")
            if isinstance(t, list): t = t[0]
            if t: schema_types.append(str(t))
            # Check completeness
            if t == "Article":
                for field in ["headline", "author", "datePublished", "image", "publisher"]:
                    if field not in data:
                        schema_issues.append(f"Article schema missing '{field}'")
                eligible_rich.append("Article rich result")
            elif t == "FAQPage":
                if "mainEntity" not in data:
                    schema_issues.append("FAQPage schema missing 'mainEntity'")
                else:
                    eligible_rich.append("FAQ rich result")
            elif t == "HowTo":
                if "step" not in data:
                    schema_issues.append("HowTo schema missing 'step'")
                else:
                    eligible_rich.append("HowTo rich result")
            elif t == "Product":
                for field in ["name", "offers"]:
                    if field not in data:
                        schema_issues.append(f"Product schema missing '{field}'")
                eligible_rich.append("Product rich result")
            elif t == "BreadcrumbList":
                eligible_rich.append("Breadcrumb rich result")
        except Exception:
            schema_issues.append("Invalid JSON-LD block")
    if not schema_types:
        eligible_rich = ["Article (add schema)", "FAQPage (add schema)", "BreadcrumbList (add schema)"]

    # ── OG / Twitter ──
    og_title_tag = soup.find("meta", attrs={"property": "og:title"})
    og_desc_tag = soup.find("meta", attrs={"property": "og:description"})
    og_image_tag = soup.find("meta", attrs={"property": "og:image"})
    twitter_tag = soup.find("meta", attrs={"name": re.compile(r"twitter:card", re.I)})
    has_og = bool(og_title_tag or og_desc_tag)

    # ── Viewport, hreflang, preconnect ──
    viewport_tag = soup.find("meta", attrs={"name": re.compile(r"viewport", re.I)})
    hreflang_tags = soup.find_all("link", attrs={"hreflang": True})
    preconnect_tags = soup.find_all("link", attrs={"rel": re.compile(r"preconnect|dns-prefetch", re.I)})

    # ── All links ──
    all_a = soup.find_all("a", href=True)
    internal_links, external_links = [], []
    generic_anchors = {"click here", "here", "read more", "learn more", "this", "link", "more"}
    anchor_generic = 0
    anchor_descriptive = 0
    for a in all_a:
        href = a.get("href", "")
        anchor_text = a.get_text().strip().lower()
        full = up.urljoin(page_url, href)
        parsed = up.urlparse(full)
        if parsed.netloc in ("", base_netloc) or not parsed.netloc:
            internal_links.append({"url": full, "anchor": anchor_text, "nofollow": "nofollow" in a.get("rel", [])})
        else:
            external_links.append({"url": full, "anchor": anchor_text, "nofollow": "nofollow" in a.get("rel", [])})
        if anchor_text in generic_anchors or len(anchor_text) < 4:
            anchor_generic += 1
        else:
            anchor_descriptive += 1

    # ── Images ──
    imgs = soup.find_all("img")
    modern_exts = {".webp", ".avif"}
    imgs_missing_alt, imgs_descriptive_alt, imgs_generic_alt = 0, 0, 0
    imgs_kw_filename, imgs_with_dims, imgs_without_dims = 0, 0, 0
    imgs_lazy, imgs_not_lazy = 0, 0
    imgs_modern = 0
    for img in imgs:
        alt = img.get("alt", "")
        src = img.get("src", "").lower()
        loading = img.get("loading", "")
        if not alt:
            imgs_missing_alt += 1
        elif len(alt.split()) >= 3:
            imgs_descriptive_alt += 1
        else:
            imgs_generic_alt += 1
        if kw in src:
            imgs_kw_filename += 1
        if img.get("width") and img.get("height"):
            imgs_with_dims += 1
        else:
            imgs_without_dims += 1
        if loading == "lazy":
            imgs_lazy += 1
        else:
            imgs_not_lazy += 1
        ext = "." + src.split(".")[-1].split("?")[0] if "." in src else ""
        if ext in modern_exts:
            imgs_modern += 1
    total_imgs = len(imgs)

    # ── Speed signals (from <head>) ──
    head = soup.find("head") or soup
    head_scripts = head.find_all("script", src=True)
    head_scripts_blocking = [s for s in head_scripts if not s.get("defer") and not s.get("async")]
    head_styles = head.find_all("link", attrs={"rel": re.compile(r"^stylesheet$", re.I)})
    head_inline_style = bool(head.find("style"))
    font_preload = bool(head.find("link", attrs={"rel": re.compile(r"preload", re.I), "as": "font"}))
    all_external_resources = [
        t for t in head.find_all(["script", "link"])
        if (t.get("src") or t.get("href", "")).startswith("http")
        and up.urlparse(t.get("src") or t.get("href", "")).netloc != base_netloc
    ]
    has_picture_webp = bool(soup.find("picture"))

    # ── Body text ──
    body = soup.find("body") or soup
    body_text = body.get_text(" ", strip=True)
    words = body_text.split()
    word_count = len(words)
    first_100 = " ".join(words[:100]).lower()
    last_100 = " ".join(words[-100:]).lower()

    # ── Keyword presence ──
    kw_in_title = kw in title.lower()
    kw_in_h1 = any(kw in h.lower() for h in h1_texts)
    kw_in_meta = kw in meta_desc.lower()
    kw_in_first_100 = kw in first_100
    kw_in_h2s = any(kw in h.lower() for h in h2_texts)
    kw_in_last = kw in last_100
    kw_occurrences = body_text.lower().count(kw)
    kw_density = f"{(kw_occurrences / max(word_count, 1) * 100):.1f}%"

    # ── Featured snippet structures ──
    has_ordered_list = bool(body.find("ol"))
    has_table = bool(body.find("table"))
    has_definition = bool(re.search(r"<(dl|dt|dd)", str(body)))
    has_unordered = bool(body.find("ul"))
    snippet_type = None
    if has_ordered_list: snippet_type = "ordered_list"
    elif has_table: snippet_type = "table"
    elif has_definition: snippet_type = "definition"
    elif has_unordered: snippet_type = "unordered_list"
    has_snippet_structure = bool(snippet_type)

    # ── FAQ section ──
    faq_pattern = re.compile(r"\b(faq|frequently asked|questions?)\b", re.I)
    has_faq = bool(soup.find(string=faq_pattern)) or bool(
        soup.find(lambda t: t.name in ("h2","h3") and faq_pattern.search(t.get_text()))
    )

    # ── Content freshness ──
    content_freshness = None
    last_modified = None
    for script in schema_scripts:
        try:
            d = json.loads(script.string or "")
            if "datePublished" in d:
                content_freshness = d["datePublished"][:10]
            if "dateModified" in d:
                last_modified = d["dateModified"][:10]
        except Exception:
            pass
    if not content_freshness:
        og_pub = soup.find("meta", attrs={"property": "article:published_time"})
        if og_pub:
            content_freshness = og_pub.get("content", "")[:10]
    if not content_freshness:
        time_tag = soup.find("time", attrs={"datetime": True})
        if time_tag:
            content_freshness = time_tag["datetime"][:10]

    # ── E-E-A-T signals ──
    author_pattern = re.compile(r"\bby\s+[A-Z][a-z]+ [A-Z][a-z]+\b")
    meta_author = soup.find("meta", attrs={"name": re.compile(r"author", re.I)})
    schema_author = any("author" in json.loads(s.string or "{}") for s in schema_scripts if s.string)
    has_author_byline = bool(meta_author or schema_author or author_pattern.search(body_text[:3000]))
    about_author_pattern = re.compile(r"\babout\s+the\s+author\b", re.I)
    has_author_bio = bool(soup.find(string=about_author_pattern))
    has_pub_date = bool(content_freshness)
    has_updated_date = bool(last_modified)
    authoritative_domains = {".edu", ".gov", ".org"}
    major_pubs = {"wikipedia.org", "nytimes.com", "reuters.com", "bbc.com", "techcrunch.com",
                  "forbes.com", "harvard.edu", "mit.edu", "nature.com", "pubmed.ncbi.nlm.nih.gov"}
    ext_links = [l for l in external_links]
    citation_count = len(ext_links)
    has_authoritative = any(
        any(d in up.urlparse(l["url"]).netloc for d in authoritative_domains) or
        any(p in up.urlparse(l["url"]).netloc for p in major_pubs)
        for l in ext_links
    )
    trust_domains = ["privacy", "contact", "about"]
    nav_links = soup.find_all("a", href=True)
    has_trust_links = any(
        any(t in a.get("href", "").lower() for t in trust_domains) for a in nav_links
    )
    has_social_proof_schema = any(t in ("Review", "AggregateRating") for t in schema_types)
    credentials_re = re.compile(r"\b(PhD|MD|MBA|certified|licensed|accredited|\d+\s+years? of experience|expert)\b", re.I)
    cred_matches = credentials_re.findall(body_text[:5000])

    # ── Brand in title ──
    title_has_brand = "|" in title or " - " in title or " – " in title

    # ── Meta CTA ──
    cta_words = ["get", "try", "start", "learn", "discover", "find", "explore", "download"]
    meta_has_cta = any(w in meta_desc.lower() for w in cta_words)

    return {
        # URL
        "title": title, "meta_desc": meta_desc, "canonical_url": canonical_url,
        "is_indexable": is_indexable, "is_followable": is_followable,
        "title_has_brand": title_has_brand, "meta_has_cta": meta_has_cta,
        # Headings
        "h1_texts": h1_texts, "h2_texts": h2_texts, "h3_texts": h3_texts,
        "heading_issues": heading_issues, "heading_hierarchy_valid": len(heading_issues) == 0,
        # Schema
        "schema_types": schema_types, "schema_issues": schema_issues,
        "schema_eligible_rich_results": eligible_rich,
        # OG/Social
        "has_og": has_og,
        "og_title": og_title_tag.get("content", "") if og_title_tag else "",
        "og_description": og_desc_tag.get("content", "") if og_desc_tag else "",
        "og_image": og_image_tag.get("content", "") if og_image_tag else "",
        "has_twitter_card": bool(twitter_tag),
        "has_viewport": bool(viewport_tag), "has_hreflang": bool(hreflang_tags),
        "has_preconnect": bool(preconnect_tags),
        # Links
        "internal_link_count": len(internal_links), "external_link_count": len(external_links),
        "anchor_generic": anchor_generic, "anchor_descriptive": anchor_descriptive,
        "external_links": external_links,
        # Images
        "total_imgs": total_imgs, "imgs_missing_alt": imgs_missing_alt,
        "imgs_descriptive_alt": imgs_descriptive_alt, "imgs_generic_alt": imgs_generic_alt,
        "imgs_kw_filename": imgs_kw_filename, "imgs_with_dims": imgs_with_dims,
        "imgs_without_dims": imgs_without_dims, "imgs_lazy": imgs_lazy,
        "imgs_not_lazy": imgs_not_lazy, "imgs_modern": imgs_modern,
        "has_picture_webp": has_picture_webp,
        # Speed
        "render_blocking_scripts": len(head_scripts_blocking),
        "render_blocking_stylesheets": len(head_styles),
        "total_external_requests": len(all_external_resources),
        "has_inline_css": head_inline_style, "has_font_preload": font_preload,
        # On-page
        "word_count": word_count, "body_text": body_text[:10000],
        "kw_in_title": kw_in_title, "kw_in_h1": kw_in_h1, "kw_in_meta": kw_in_meta,
        "kw_in_first_100": kw_in_first_100, "kw_in_h2s": kw_in_h2s, "kw_in_last": kw_in_last,
        "kw_occurrences": kw_occurrences, "kw_density": kw_density,
        "has_snippet_structure": has_snippet_structure, "snippet_type": snippet_type,
        "has_faq": has_faq,
        "content_freshness": content_freshness, "last_modified": last_modified,
        # E-E-A-T
        "has_author_byline": has_author_byline, "has_author_bio": has_author_bio,
        "has_pub_date": has_pub_date, "has_updated_date": has_updated_date,
        "citation_count": citation_count, "has_authoritative": has_authoritative,
        "has_trust_links": has_trust_links, "has_social_proof_schema": has_social_proof_schema,
        "cred_signals": list(set(cred_matches)),
    }


def _score_url(url: str, kw: str) -> UrlAnalysis:
    from urllib.parse import urlparse
    STOP_WORDS = {"the","a","an","and","or","but","in","on","of","to","for","with","is","are","was","were","at","by","from"}
    parsed = urlparse(url)
    is_https = parsed.scheme == "https"
    slug = parsed.path.strip("/").split("/")[-1] if parsed.path.strip("/") else ""
    parts = re.split(r"[-_/]", parsed.path.lower())
    kw_words = set(kw.lower().split())
    keyword_in_slug = bool(kw_words & set(parts))
    url_length = len(url)
    url_depth = len([p for p in parsed.path.split("/") if p])
    slug_words = set(re.split(r"[-_]", slug.lower()))
    has_stop_words = bool(slug_words & STOP_WORDS)
    score = 100
    issues = []
    if not is_https: score -= 20; issues.append("Not HTTPS — Google prefers secure URLs")
    if not keyword_in_slug: score -= 15; issues.append("Target keyword not in URL slug")
    if url_length > 75: score -= 10; issues.append(f"URL is {url_length} chars — ideal < 75")
    if url_depth > 3: score -= 10; issues.append(f"URL depth is {url_depth} levels — ideal ≤ 3")
    if has_stop_words: score -= 5; issues.append("URL slug contains stop words (the, and, of, etc.)")
    if re.search(r"[A-Z]", parsed.path): score -= 5; issues.append("URL contains uppercase letters")
    if re.search(r"[^a-z0-9\-_/.]", parsed.path): score -= 5; issues.append("URL contains special characters")
    return UrlAnalysis(url=url, is_https=is_https, keyword_in_slug=keyword_in_slug,
                       url_length=url_length, url_depth=url_depth, has_stop_words=has_stop_words,
                       slug=slug, score=max(0, score), issues=issues)


def _score_technical(p: dict, kw: str) -> TechnicalSeoAudit:
    score = 100
    issues = []
    kw_lower = kw.lower()
    title_len = len(p["title"])
    meta_len = len(p["meta_desc"])
    canon = p["canonical_url"]
    if not p["title"]: score -= 20; issues.append("Missing title tag")
    elif title_len < 30: score -= 10; issues.append(f"Title too short ({title_len} chars) — aim for 50-60")
    elif title_len > 65: score -= 5; issues.append(f"Title too long ({title_len} chars) — may be truncated in SERP")
    if not p["kw_in_title"]: score -= 15; issues.append("Target keyword not in title tag")
    if not p["meta_desc"]: score -= 15; issues.append("Missing meta description")
    elif meta_len < 120: score -= 5; issues.append(f"Meta description too short ({meta_len} chars) — aim for 120-160")
    elif meta_len > 165: score -= 5; issues.append(f"Meta description too long ({meta_len} chars) — will be truncated")
    if not p["kw_in_meta"]: score -= 10; issues.append("Target keyword not in meta description")
    if not p["is_indexable"]: score -= 30; issues.append("CRITICAL: Page has noindex — Google will not index this page")
    h1_count = len(p["h1_texts"])
    if h1_count == 0: score -= 15; issues.append("Missing H1 tag")
    elif h1_count > 1: score -= 8; issues.append(f"Multiple H1 tags ({h1_count}) — use exactly one")
    if not p["kw_in_h1"] and h1_count > 0: score -= 8; issues.append("Target keyword not in H1")
    if not p["has_og"]: score -= 5; issues.append("Missing Open Graph tags (og:title, og:description)")
    if not p["has_viewport"]: score -= 5; issues.append("Missing viewport meta — page may not be mobile-friendly")
    if not p["schema_types"]: score -= 5; issues.append("No structured data (schema markup) found")
    issues.extend(p["heading_issues"])
    issues.extend(p["schema_issues"])
    return TechnicalSeoAudit(
        score=max(0, score), title=p["title"], title_length=title_len,
        title_has_keyword=p["kw_in_title"], title_has_brand=p["title_has_brand"],
        meta_description=p["meta_desc"], meta_description_length=meta_len,
        meta_description_has_keyword=p["kw_in_meta"], meta_description_has_cta=p["meta_has_cta"],
        has_canonical=bool(canon), canonical_url=canon,
        canonical_is_self=bool(not canon or canon.rstrip("/") == p.get("url","").rstrip("/")),
        is_indexable=p["is_indexable"], is_followable=p["is_followable"],
        h1_count=len(p["h1_texts"]), h1_text=p["h1_texts"][0] if p["h1_texts"] else "",
        h1_has_keyword=p["kw_in_h1"],
        h2_count=len(p["h2_texts"]), h3_count=len(p["h3_texts"]), keyword_in_h2=p["kw_in_h2s"],
        heading_hierarchy_valid=p["heading_hierarchy_valid"], heading_hierarchy_issues=p["heading_issues"],
        has_schema_markup=bool(p["schema_types"]), schema_types=p["schema_types"],
        schema_issues=p["schema_issues"], schema_eligible_rich_results=p["schema_eligible_rich_results"],
        has_og_tags=p["has_og"], og_title=p["og_title"], og_description=p["og_description"],
        og_image=p["og_image"], has_twitter_card=p["has_twitter_card"],
        has_viewport=p["has_viewport"], has_hreflang=p["has_hreflang"],
        has_preconnect_hints=p["has_preconnect"], issues=issues,
    )


def _score_speed(p: dict) -> SpeedSignals:
    score = 100
    issues = []
    if p["render_blocking_scripts"] > 2:
        score -= min(30, p["render_blocking_scripts"] * 5)
        issues.append(f"{p['render_blocking_scripts']} render-blocking scripts in <head> — add defer or async")
    if p["render_blocking_stylesheets"] > 3:
        score -= 10; issues.append(f"{p['render_blocking_stylesheets']} render-blocking stylesheets — consider inlining critical CSS")
    if p["total_external_requests"] > 15:
        score -= min(20, (p["total_external_requests"] - 15) * 2)
        issues.append(f"{p['total_external_requests']} external resource requests — reduces page speed")
    total_imgs = p["total_imgs"]
    if total_imgs > 0 and p["imgs_not_lazy"] > 3:
        score -= 10; issues.append(f"{p['imgs_not_lazy']} images without lazy loading — add loading=\"lazy\"")
    if total_imgs > 0:
        pct = p["imgs_modern"] / total_imgs * 100
        if pct < 50:
            score -= 10; issues.append(f"Only {pct:.0f}% of images use modern format (WebP/AVIF)")
    if not p["has_inline_css"]:
        issues.append("No inline critical CSS detected — consider inlining above-the-fold CSS")
    if not p["has_font_preload"]:
        issues.append("No font preloading detected — add <link rel='preload' as='font'>")
    return SpeedSignals(
        score=max(0, score),
        render_blocking_scripts=p["render_blocking_scripts"],
        render_blocking_stylesheets=p["render_blocking_stylesheets"],
        total_external_requests=p["total_external_requests"],
        images_lazy_loaded=p["imgs_lazy"], images_not_lazy_loaded=p["imgs_not_lazy"],
        images_using_modern_format=p["imgs_modern"], images_total=p["total_imgs"],
        has_inline_critical_css=p["has_inline_css"], has_font_preloading=p["has_font_preload"],
        issues=issues,
    )


def _score_image_seo(p: dict) -> ImageSeoAudit:
    score = 100
    issues = []
    total = p["total_imgs"]
    if total == 0:
        return ImageSeoAudit(score=80, images_total=0, images_missing_alt=0,
                             images_with_descriptive_alt=0, images_with_generic_alt=0,
                             images_with_keyword_filename=0, images_with_dimensions=0,
                             images_without_dimensions=0, webp_avif_percentage=0.0, issues=[])
    miss_pct = p["imgs_missing_alt"] / total
    if miss_pct > 0.5: score -= 30; issues.append(f"{p['imgs_missing_alt']} of {total} images missing alt text — critical for accessibility and SEO")
    elif miss_pct > 0.2: score -= 15; issues.append(f"{p['imgs_missing_alt']} images missing alt text")
    if p["imgs_generic_alt"] > 2: score -= 10; issues.append(f"{p['imgs_generic_alt']} images have generic alt text — use descriptive, keyword-rich alts")
    webp_pct = p["imgs_modern"] / total * 100
    if webp_pct < 30: score -= 15; issues.append(f"Only {webp_pct:.0f}% of images use modern formats (WebP/AVIF) — convert for faster loads")
    if p["imgs_without_dims"] > 2: score -= 10; issues.append(f"{p['imgs_without_dims']} images missing explicit width/height — causes layout shift (CLS)")
    if p["imgs_kw_filename"] == 0: score -= 5; issues.append("No images have keyword in filename — name images descriptively")
    return ImageSeoAudit(
        score=max(0, score), images_total=total, images_missing_alt=p["imgs_missing_alt"],
        images_with_descriptive_alt=p["imgs_descriptive_alt"], images_with_generic_alt=p["imgs_generic_alt"],
        images_with_keyword_filename=p["imgs_kw_filename"],
        images_with_dimensions=p["imgs_with_dims"], images_without_dimensions=p["imgs_without_dims"],
        webp_avif_percentage=round(webp_pct if total else 0.0, 1), issues=issues,
    )


def _score_eeat(p: dict, lsi_results: list[str]) -> EeatAudit:
    score = 0
    missing = []
    if p["has_author_byline"]: score += 20
    else: missing.append("Add author byline (By [Name])")
    if p["has_author_bio"]: score += 15
    else: missing.append("Add author bio section")
    if p["has_pub_date"]: score += 10
    else: missing.append("Add publication date (datePublished in schema or meta)")
    if p["has_updated_date"]: score += 5
    else: missing.append("Add last-updated date")
    if p["citation_count"] > 0: score += 10
    else: missing.append("Add external citations/references to authoritative sources")
    if p["has_authoritative"]: score += 15
    else: missing.append("Link to .edu, .gov, or major publications for authority signals")
    if p["has_trust_links"]: score += 10
    else: missing.append("Add links to Privacy Policy, Contact, and About pages in navigation/footer")
    if p["has_social_proof_schema"]: score += 10
    else: missing.append("Add Review or AggregateRating schema for social proof")
    if p["cred_signals"]: score += 5

    issues = [f"E-E-A-T score is {score}/100 — low trust signals may hurt ranking in YMYL topics"] if score < 50 else []
    return EeatAudit(
        score=min(100, score),
        has_author_byline=p["has_author_byline"], has_author_bio=p["has_author_bio"],
        has_publication_date=p["has_pub_date"], has_updated_date=p["has_updated_date"],
        has_external_citations=p["citation_count"] > 0, citation_count=p["citation_count"],
        has_authoritative_citations=p["has_authoritative"], has_trust_links=p["has_trust_links"],
        has_social_proof_schema=p["has_social_proof_schema"],
        credentials_signals=p["cred_signals"], missing_signals=missing, issues=issues,
    )


@router.post("/page-audit", response_model=PageSeoAuditResponse, summary="Deep SEO audit of a single page")
async def page_seo_audit(request: PageAuditRequest) -> PageSeoAuditResponse:
    """Comprehensive SEO audit: technical, speed signals, image SEO, on-page, E-E-A-T, competitive."""
    from agents.scout.scraper import fetch_page_html, serper_search_rich, google_autocomplete, scrape_url

    try:
        if settings.MOCK_MODE:
            mock_url = request.url or "https://example.com/blog/saas-project-management"
            mock_kw = request.target_keyword or "SaaS project management"
            return PageSeoAuditResponse(
                url=mock_url, target_keyword=mock_kw, overall_score=64,
                url_analysis=UrlAnalysis(url=mock_url, is_https=True, keyword_in_slug=True,
                    url_length=55, url_depth=2, has_stop_words=False, slug="saas-project-management", score=85,
                    issues=["URL depth is acceptable but could be shallower"]),
                technical=TechnicalSeoAudit(score=71, title="SaaS Project Management: Top Tools 2025",
                    title_length=42, title_has_keyword=True, title_has_brand=False,
                    meta_description="", meta_description_length=0,
                    meta_description_has_keyword=False, meta_description_has_cta=False,
                    has_canonical=True, canonical_url=mock_url, canonical_is_self=True,
                    is_indexable=True, is_followable=True,
                    h1_count=1, h1_text="SaaS Project Management Tools for Startups",
                    h1_has_keyword=True, h2_count=5, h3_count=8, keyword_in_h2=True,
                    heading_hierarchy_valid=True, heading_hierarchy_issues=[],
                    has_schema_markup=True, schema_types=["Article"],
                    schema_issues=["Article schema missing 'datePublished'", "Article schema missing 'publisher'"],
                    schema_eligible_rich_results=["Article rich result"],
                    has_og_tags=True, og_title="SaaS Project Management", og_description="Top tools guide",
                    og_image="https://example.com/img/hero.jpg",
                    has_twitter_card=False, has_viewport=True, has_hreflang=False,
                    has_preconnect_hints=False, issues=["Missing meta description", "Twitter card not set"]),
                speed_signals=SpeedSignals(score=55, render_blocking_scripts=4,
                    render_blocking_stylesheets=2, total_external_requests=18,
                    images_lazy_loaded=3, images_not_lazy_loaded=7, images_using_modern_format=2,
                    images_total=10, has_inline_critical_css=False, has_font_preloading=False,
                    issues=["4 render-blocking scripts in <head>", "7 images without lazy loading", "Only 20% of images use WebP"]),
                image_seo=ImageSeoAudit(score=60, images_total=10, images_missing_alt=3,
                    images_with_descriptive_alt=5, images_with_generic_alt=2,
                    images_with_keyword_filename=1, images_with_dimensions=6, images_without_dimensions=4,
                    webp_avif_percentage=20.0,
                    issues=["3 images missing alt text", "4 images without width/height attributes"]),
                on_page=OnPageSeoAudit(score=68, word_count=1200, reading_time_minutes=5,
                    keyword_density="1.1%", keyword_occurrences=13,
                    keyword_in_title=True, keyword_in_h1=True, keyword_in_meta=False,
                    keyword_in_first_100_words=True, keyword_in_h2s=True, keyword_in_last_paragraph=False,
                    lsi_keywords_found=["project tracking", "team collaboration", "task management"],
                    lsi_keywords_missing=["agile methodology", "sprint planning", "resource allocation"],
                    paa_answered=["What is SaaS project management?", "How does it work?"],
                    paa_unanswered=["What is the best SaaS tool for project management?", "Is SaaS project management secure?"],
                    has_featured_snippet_structure=True, featured_snippet_type="unordered_list",
                    has_faq_section=False, content_freshness="2024-11-01", last_modified=None,
                    readability_grade="Grade 9 — clear and accessible", content_depth_assessment="Moderate — covers basics but lacks depth on pricing and integrations",
                    anchor_text_generic_count=3, anchor_text_descriptive_count=8,
                    issues=["Keyword missing from meta description", "No FAQ section (PAA opportunity missed)"],
                    improvements=["Add FAQ schema to capture PAA feature", "Include pricing comparison table"]),
                eeat=EeatAudit(score=35, has_author_byline=False, has_author_bio=False,
                    has_publication_date=True, has_updated_date=False,
                    has_external_citations=True, citation_count=2, has_authoritative_citations=False,
                    has_trust_links=True, has_social_proof_schema=False,
                    credentials_signals=[], missing_signals=["Add author byline", "Add author bio", "Add Review schema"],
                    issues=["Low E-E-A-T score — no author attribution reduces trust"]),
                competitive=CompetitiveSeoAudit(score=52,
                    serp_features_present=["people_also_ask"],
                    serp_features_missing=["featured_snippet", "image_pack"],
                    avg_competitor_word_count=2800, your_word_count=1200, word_count_gap=-1600,
                    word_count_verdict="You're 1,600 words behind competitors — high priority to expand content",
                    top_competitors=[
                        CompetitorSnapshot(url="https://monday.com/blog/project-management/saas", title="Best SaaS PM Tools 2025 | monday.com",
                            meta_description="Compare top SaaS project management tools.", word_count_estimate=3200,
                            main_h2s=["What is SaaS PM?", "Top 10 Tools", "Pricing Comparison", "How to Choose"],
                            schema_types=["Article","FAQPage"], main_topics=["tool comparison","pricing","integrations","team size"]),
                    ],
                    content_gaps=["Pricing comparison table missing", "Integration ecosystem not covered", "No customer case studies"],
                    unique_angle_opportunity="Cover AI-native PM tools specifically for early-stage startups — competitors focus on enterprise",
                    featured_snippet_holder="monday.com", featured_snippet_format="ordered_list",
                    featured_snippet_tip="Add a numbered 'Top 5 SaaS PM tools' list with one-sentence descriptions — matches featured snippet format",
                    paa_questions=["What is SaaS project management?", "What is the best tool?", "Is it secure?", "How much does it cost?"],
                    competitor_schema_types=["Article","FAQPage","BreadcrumbList"]),
                critical_issues=["Missing meta description (directly hurts CTR)", "No author byline (E-E-A-T signal missing)"],
                high_priority=["Expand content to 2,800+ words to match competitor depth", "Add FAQ schema to target PAA feature", "Fix 4 render-blocking scripts"],
                medium_priority=["Convert images to WebP format", "Add Twitter card meta", "Fix 4 images missing width/height"],
                quick_wins=["Add meta description (30 min)", "Add author name to byline (15 min)", "Add missing datePublished to Article schema (10 min)"],
                mentor_summary="This page has strong on-page basics — keyword placement is solid — but it's losing on depth and trust. Competitors average 2,800 words vs your 1,200, and the lack of author attribution hurts E-E-A-T on a competitive topic.",
                next_move="Write 1,600 more words expanding the pricing comparison and integration sections, then add an FAQ schema block targeting the 4 unanswered PAA questions.",
                action_plan_30d=["Add meta description", "Add author byline + bio", "Expand content to 2,500+ words", "Add FAQ schema"],
                action_plan_60d=["Convert images to WebP", "Add pricing comparison table", "Fix render-blocking scripts", "Build 3 internal links from related pages"],
                action_plan_90d=["Target featured snippet with ordered list format", "Add AggregateRating schema", "Publish follow-up piece targeting missing PAA questions"],
                tokens_used=0, model_used="mock",
            )

        # ── Live execution ──
        (html, extracted_text), serp_data, lsi_suggestions = await asyncio.gather(
            fetch_page_html(request.url),
            serper_search_rich(request.target_keyword),
            google_autocomplete(request.target_keyword),
        )

        if not html:
            raise HTTPException(status_code=422, detail=f"Could not fetch page: {request.url}")

        p = _parse_html_seo(html, request.url, request.target_keyword)
        p["url"] = request.url

        # Scrape top 3 competitor pages in parallel
        competitor_urls = [item["link"] for item in serp_data.get("organic", [])[:5]
                          if item["link"] != request.url][:3]
        competitor_htmls = await asyncio.gather(*[fetch_page_html(u) for u in competitor_urls], return_exceptions=True)

        competitor_snapshots: list[CompetitorSnapshot] = []
        competitor_word_counts = []
        competitor_schemas: set[str] = set()

        for i, (c_url, result) in enumerate(zip(competitor_urls, competitor_htmls)):
            if isinstance(result, Exception) or not result[0]:
                continue
            c_html, _ = result
            c_parsed = _parse_html_seo(c_html, c_url, request.target_keyword)
            c_wc = c_parsed["word_count"]
            competitor_word_counts.append(c_wc)
            competitor_schemas.update(c_parsed["schema_types"])
            organic_item = serp_data["organic"][i] if i < len(serp_data["organic"]) else {}
            competitor_snapshots.append(CompetitorSnapshot(
                url=c_url,
                title=c_parsed["title"] or organic_item.get("title", ""),
                meta_description=c_parsed["meta_desc"] or organic_item.get("snippet", ""),
                word_count_estimate=c_wc,
                main_h2s=c_parsed["h2_texts"][:6],
                schema_types=c_parsed["schema_types"],
                main_topics=[],
            ))

        avg_competitor_wc = int(sum(competitor_word_counts) / len(competitor_word_counts)) if competitor_word_counts else 0
        your_wc = p["word_count"]
        wc_gap = your_wc - avg_competitor_wc
        wc_verdict = (
            f"You're {abs(wc_gap):,} words {'ahead of' if wc_gap >= 0 else 'behind'} competitors — "
            + ("solid advantage" if wc_gap > 200 else "high priority to expand" if wc_gap < -500 else "close to parity")
        )

        # LSI coverage
        lsi_lower = [s.lower() for s in lsi_suggestions]
        body_lower = p["body_text"].lower()
        lsi_found = [s for s in lsi_suggestions if s.lower() in body_lower]
        lsi_missing = [s for s in lsi_suggestions if s.lower() not in body_lower]

        # PAA coverage
        paa_questions = serp_data.get("paa", [])
        paa_answered = [q for q in paa_questions if q.lower() in body_lower or any(w in body_lower for w in q.lower().split() if len(w) > 4)]
        paa_unanswered = [q for q in paa_questions if q not in paa_answered]

        # SERP features
        all_possible_features = ["featured_snippet", "people_also_ask", "image_pack", "video_carousel", "news_pack", "knowledge_graph", "shopping_results"]
        serp_present = serp_data.get("serp_features", [])
        serp_missing = [f for f in all_possible_features if f not in serp_present]
        featured_snippet = serp_data.get("featured_snippet")
        fs_holder = featured_snippet.get("source") if featured_snippet else None
        fs_format = None
        if featured_snippet:
            fs_text = str(featured_snippet)
            if re.search(r"\d+\.", fs_text): fs_format = "ordered_list"
            elif "•" in fs_text or "- " in fs_text: fs_format = "unordered_list"
            elif "|" in fs_text: fs_format = "table"
            else: fs_format = "definition"

        # Score all dimensions algorithmically
        url_analysis = _score_url(request.url, request.target_keyword)
        technical = _score_technical(p, request.target_keyword)
        technical.canonical_url = p["canonical_url"]
        speed = _score_speed(p)
        image_seo = _score_image_seo(p)
        eeat = _score_eeat(p, lsi_suggestions)

        on_page_score = 100
        on_page_issues = []
        on_page_improvements = []
        if not p["kw_in_first_100"]: on_page_score -= 15; on_page_issues.append("Keyword not in first 100 words")
        if not p["kw_in_h2s"]: on_page_score -= 10; on_page_issues.append("Keyword not in any H2")
        if not p["kw_in_last"]: on_page_score -= 5; on_page_improvements.append("Add keyword to concluding paragraph")
        if len(lsi_missing) > 4: on_page_score -= 10; on_page_improvements.append(f"Add LSI keywords: {', '.join(lsi_missing[:4])}")
        if len(paa_unanswered) > 2: on_page_score -= 10; on_page_improvements.append("Address unanswered PAA questions")
        if not p["has_snippet_structure"]: on_page_score -= 10; on_page_improvements.append("Add a list or table to target featured snippets")
        if your_wc < 600: on_page_score -= 20; on_page_issues.append(f"Thin content — only {your_wc} words")
        elif your_wc < 1200: on_page_score -= 10; on_page_issues.append(f"Below average word count ({your_wc} words)")

        on_page = OnPageSeoAudit(
            score=max(0, on_page_score),
            word_count=your_wc, reading_time_minutes=max(1, your_wc // 200),
            keyword_density=p["kw_density"], keyword_occurrences=p["kw_occurrences"],
            keyword_in_title=p["kw_in_title"], keyword_in_h1=p["kw_in_h1"],
            keyword_in_meta=p["kw_in_meta"], keyword_in_first_100_words=p["kw_in_first_100"],
            keyword_in_h2s=p["kw_in_h2s"], keyword_in_last_paragraph=p["kw_in_last"],
            lsi_keywords_found=lsi_found, lsi_keywords_missing=lsi_missing,
            paa_answered=paa_answered, paa_unanswered=paa_unanswered,
            has_featured_snippet_structure=p["has_snippet_structure"],
            featured_snippet_type=p["snippet_type"],
            has_faq_section=p["has_faq"],
            content_freshness=p["content_freshness"], last_modified=p["last_modified"],
            readability_grade="", content_depth_assessment="",
            anchor_text_generic_count=p["anchor_generic"],
            anchor_text_descriptive_count=p["anchor_descriptive"],
            issues=on_page_issues, improvements=on_page_improvements,
        )

        competitive = CompetitiveSeoAudit(
            score=max(0, min(100, 50 + (wc_gap // 100))),
            serp_features_present=serp_present, serp_features_missing=serp_missing,
            avg_competitor_word_count=avg_competitor_wc, your_word_count=your_wc, word_count_gap=wc_gap,
            word_count_verdict=wc_verdict,
            top_competitors=competitor_snapshots,
            content_gaps=[], unique_angle_opportunity="",
            featured_snippet_holder=fs_holder, featured_snippet_format=fs_format,
            featured_snippet_tip="" if fs_holder else "Target featured snippet by adding a concise definition paragraph or numbered list near the top of the page",
            paa_questions=paa_questions,
            competitor_schema_types=list(competitor_schemas),
        )

        # Weighted overall score
        overall_score = int(
            url_analysis.score * 0.05 +
            technical.score * 0.20 +
            speed.score * 0.10 +
            image_seo.score * 0.05 +
            on_page.score * 0.25 +
            eeat.score * 0.15 +
            competitive.score * 0.20
        )

        # LLM call for semantic analysis, content gaps, recommendations, action plan
        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"

        competitor_summary = "\n".join(
            f"- {c.url} ({c.word_count_estimate} words, schema: {', '.join(c.schema_types) or 'none'}, topics: {', '.join(c.main_h2s[:3])})"
            for c in competitor_snapshots
        )
        audit_context = f"""
URL: {request.url}
Target keyword: {request.target_keyword}
Scores: URL={url_analysis.score} Technical={technical.score} Speed={speed.score} Image={image_seo.score} On-Page={on_page.score} EEAT={eeat.score} Overall={overall_score}

KEY FINDINGS:
- Title: "{p['title']}" ({len(p['title'])} chars, keyword {'✓' if p['kw_in_title'] else '✗'})
- Meta description: {'Present' if p['meta_desc'] else 'MISSING'}
- H1 count: {len(p['h1_texts'])}, H1 text: "{p['h1_texts'][0] if p['h1_texts'] else 'NONE'}"
- Word count: {your_wc} (avg competitor: {avg_competitor_wc}, gap: {wc_gap:+})
- Schema types: {', '.join(p['schema_types']) or 'none'}
- Render-blocking scripts: {p['render_blocking_scripts']}
- Images missing alt: {p['imgs_missing_alt']} of {p['total_imgs']}
- Author byline: {'yes' if p['has_author_byline'] else 'NO'}
- External citations: {p['citation_count']}
- LSI keywords missing: {', '.join(lsi_missing[:5])}
- PAA unanswered: {', '.join(paa_unanswered[:3])}
- SERP features missing: {', '.join(serp_missing)}
- Featured snippet holder: {fs_holder or 'none'}

COMPETITORS (top {len(competitor_snapshots)}):
{competitor_summary}

CONTENT EXCERPT (first 1500 chars):
{p['body_text'][:1500]}
"""
        prompt = f"""You are a senior SEO strategist reviewing an audit report. Based on the data below, provide a JSON response with these exact keys:

{audit_context}

Return ONLY valid JSON with these keys:
{{
  "readability_grade": "e.g. Grade 8 — clear and accessible",
  "content_depth_assessment": "1-2 sentence honest assessment of content depth vs competitors",
  "content_gaps": ["3-5 specific topics competitors cover that this page misses"],
  "unique_angle_opportunity": "One specific untapped angle this page could own",
  "featured_snippet_tip": "Exact actionable tip to capture or improve featured snippet",
  "eeat_credentials_assessment": "1 sentence on E-E-A-T status",
  "critical_issues": ["2-4 must-fix issues blocking ranking"],
  "high_priority": ["3-5 fixes for within 2 weeks"],
  "medium_priority": ["3-4 fixes for this month"],
  "quick_wins": ["3-5 easy, high-impact changes doable today (under 1 hour each)"],
  "mentor_summary": "2-3 sentence strategic narrative: what story does this audit tell? Be honest and specific.",
  "next_move": "The single highest-ROI action to take right now, in one clear sentence",
  "action_plan_30d": ["3-4 actions for first 30 days"],
  "action_plan_60d": ["3-4 actions for days 30-60"],
  "action_plan_90d": ["2-3 actions for days 60-90"]
}}"""

        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}], max_tokens=2000,
        )
        tokens_used = _llm.count_tokens(raw)
        llm_data = safe_json_loads(raw) or {}

        # Merge LLM insights into objects
        on_page.readability_grade = str(llm_data.get("readability_grade", ""))
        on_page.content_depth_assessment = str(llm_data.get("content_depth_assessment", ""))
        competitive.content_gaps = llm_data.get("content_gaps", [])
        competitive.unique_angle_opportunity = str(llm_data.get("unique_angle_opportunity", ""))
        competitive.featured_snippet_tip = str(llm_data.get("featured_snippet_tip", competitive.featured_snippet_tip))

        return PageSeoAuditResponse(
            url=request.url, target_keyword=request.target_keyword, overall_score=overall_score,
            url_analysis=url_analysis, technical=technical, speed_signals=speed,
            image_seo=image_seo, on_page=on_page, eeat=eeat, competitive=competitive,
            critical_issues=llm_data.get("critical_issues", []),
            high_priority=llm_data.get("high_priority", []),
            medium_priority=llm_data.get("medium_priority", []),
            quick_wins=llm_data.get("quick_wins", []),
            mentor_summary=str(llm_data.get("mentor_summary", "")),
            next_move=str(llm_data.get("next_move", "")),
            action_plan_30d=llm_data.get("action_plan_30d", []),
            action_plan_60d=llm_data.get("action_plan_60d", []),
            action_plan_90d=llm_data.get("action_plan_90d", []),
            tokens_used=tokens_used, model_used=_agent.default_model,
        )
    except HTTPException:
        raise
    except Exception:
        _log.exception("sage/page-audit failed")
        raise


# ── Site Audit ────────────────────────────────────────────────────────────────

class SiteAuditRequest(BaseModel):
    domain: str
    max_pages: int = 10
    user_id: str
    organization_id: str = ""
    metadata: dict = {}


class PageSummary(BaseModel):
    url: str; http_status: int; title: str; word_count: int; score: int
    has_meta_description: bool; has_h1: bool; has_schema: bool
    is_indexable: bool; redirect_target: str | None
    issues: list[str]; quick_wins: list[str]


class RobotsTxtAnalysis(BaseModel):
    found: bool; has_sitemap_directive: bool
    disallowed_paths: list[str]; crawl_delay: float | None; issues: list[str]


class SiteAuditResponse(BaseModel):
    domain: str; total_pages_found: int; pages_analyzed: int
    overall_site_score: int; avg_page_score: float
    pages_200: int; pages_301: int; pages_404: int; pages_other: int
    redirect_chains: list[list[str]]
    pages_missing_meta: int; pages_missing_h1: int
    pages_thin_content: int; pages_missing_schema: int
    pages_noindex_in_sitemap: int
    duplicate_title_groups: list[list[str]]
    cannibalization_candidates: list[dict]
    orphan_pages: list[str]
    has_about_page: bool; has_contact_page: bool; has_privacy_page: bool
    robots_txt: RobotsTxtAnalysis
    top_pages: list[PageSummary]; problem_pages: list[PageSummary]; all_pages: list[PageSummary]
    critical_issues: list[str]; quick_wins: list[str]
    site_health_summary: str; content_gap_opportunities: list[str]
    internal_linking_opportunities: list[str]
    tokens_used: int = 0; model_used: str = ""


def _quick_page_score(p: dict) -> tuple[int, list[str], list[str]]:
    """Fast algorithmic score for site audit (no LLM). Returns (score, issues, quick_wins)."""
    score = 100
    issues, wins = [], []
    if not p["title"]: score -= 20; issues.append("Missing title tag")
    elif len(p["title"]) > 65: score -= 5; issues.append("Title too long")
    if not p["meta_desc"]: score -= 15; issues.append("Missing meta description"); wins.append("Add meta description")
    if not p["is_indexable"]: score -= 30; issues.append("Page has noindex")
    if not p["h1_texts"]: score -= 15; issues.append("Missing H1"); wins.append("Add H1 tag")
    if p["word_count"] < 300: score -= 20; issues.append(f"Thin content ({p['word_count']} words)")
    elif p["word_count"] < 600: score -= 10; issues.append(f"Below-average word count ({p['word_count']} words)")
    if not p["schema_types"]: score -= 10; issues.append("No schema markup"); wins.append("Add Article or BreadcrumbList schema")
    if not p["has_og"]: score -= 5; issues.append("No Open Graph tags"); wins.append("Add og:title and og:description")
    if p["imgs_missing_alt"] > 0: score -= min(10, p["imgs_missing_alt"] * 2); issues.append(f"{p['imgs_missing_alt']} images missing alt text")
    return max(0, score), issues, wins


@router.post("/site-audit", response_model=SiteAuditResponse, summary="Full-site SEO health check via sitemap crawl")
async def site_audit(request: SiteAuditRequest) -> SiteAuditResponse:
    """Crawl a website via sitemap, check HTTP status, analyze each page, return site-wide SEO health report."""
    from agents.scout.scraper import fetch_sitemap, fetch_page_html, fetch_page_status, fetch_robots_txt

    try:
        max_pages = min(request.max_pages, 20)
        domain = request.domain.strip()
        if not domain.startswith("http"):
            domain = f"https://{domain}"
        domain = domain.rstrip("/")

        if settings.MOCK_MODE:
            mock_pages = [
                PageSummary(url=f"{domain}/", http_status=200, title="Home - Example Company",
                    word_count=450, score=72, has_meta_description=True, has_h1=True, has_schema=False,
                    is_indexable=True, redirect_target=None, issues=["No schema markup"], quick_wins=["Add BreadcrumbList schema"]),
                PageSummary(url=f"{domain}/about", http_status=200, title="About Us",
                    word_count=280, score=55, has_meta_description=False, has_h1=True, has_schema=False,
                    is_indexable=True, redirect_target=None, issues=["Missing meta description", "Thin content"], quick_wins=["Add meta description"]),
                PageSummary(url=f"{domain}/blog/seo-guide", http_status=200, title="Complete SEO Guide 2025",
                    word_count=3200, score=88, has_meta_description=True, has_h1=True, has_schema=True,
                    is_indexable=True, redirect_target=None, issues=[], quick_wins=[]),
                PageSummary(url=f"{domain}/pricing", http_status=200, title="Pricing",
                    word_count=180, score=38, has_meta_description=False, has_h1=False, has_schema=False,
                    is_indexable=True, redirect_target=None,
                    issues=["Missing meta description", "Missing H1", "Thin content", "No schema"],
                    quick_wins=["Add meta description", "Add H1", "Add FAQ schema"]),
                PageSummary(url=f"{domain}/old-post", http_status=404, title="",
                    word_count=0, score=0, has_meta_description=False, has_h1=False, has_schema=False,
                    is_indexable=False, redirect_target=None, issues=["404 Not Found — dead link in sitemap"], quick_wins=["Remove from sitemap or redirect"]),
            ]
            scores = [p.score for p in mock_pages if p.http_status == 200]
            return SiteAuditResponse(
                domain=domain, total_pages_found=9, pages_analyzed=5,
                overall_site_score=int(sum(scores)/len(scores)), avg_page_score=round(sum(scores)/len(scores),1),
                pages_200=4, pages_301=0, pages_404=1, pages_other=0,
                redirect_chains=[], pages_missing_meta=2, pages_missing_h1=1,
                pages_thin_content=2, pages_missing_schema=4, pages_noindex_in_sitemap=0,
                duplicate_title_groups=[], cannibalization_candidates=[],
                orphan_pages=[f"{domain}/contact"],
                has_about_page=True, has_contact_page=True, has_privacy_page=False,
                robots_txt=RobotsTxtAnalysis(found=True, has_sitemap_directive=True,
                    disallowed_paths=["/admin"], crawl_delay=None, issues=[]),
                top_pages=mock_pages[:1], problem_pages=mock_pages[3:],
                all_pages=mock_pages,
                critical_issues=["1 page returning 404 in sitemap", "Pricing page missing H1 and meta description"],
                quick_wins=["Add meta descriptions to 2 pages (30 min)", "Add Privacy Policy page", "Add BreadcrumbList schema to homepage"],
                site_health_summary="Site has a solid foundation with one strong content piece, but several key pages (pricing, about) are under-optimized. The 404 in the sitemap needs immediate attention.",
                content_gap_opportunities=["No blog posts targeting commercial intent keywords", "Missing comparison/alternative pages"],
                internal_linking_opportunities=["Blog post should link to pricing page", "Homepage has no links to blog content"],
                tokens_used=0, model_used="mock",
            )

        # ── Live execution ──
        robots, discovered_urls = await asyncio.gather(
            fetch_robots_txt(domain),
            fetch_sitemap(domain),
        )

        total_found = len(discovered_urls)
        urls_to_check = discovered_urls[:max_pages * 2]

        # HEAD requests for status codes (fast, concurrent)
        sem_head = asyncio.Semaphore(10)
        async def _check_status(url: str):
            async with sem_head:
                return url, *(await fetch_page_status(url))

        status_results = await asyncio.gather(*[_check_status(u) for u in urls_to_check], return_exceptions=True)

        status_200, status_301, status_404, status_other = [], [], [], []
        redirect_map: dict[str, str] = {}
        for res in status_results:
            if isinstance(res, Exception): continue
            url, code, final = res
            if code == 200: status_200.append(url)
            elif code in (301, 302): status_301.append(url); redirect_map[url] = final or url
            elif code == 404: status_404.append(url)
            else: status_other.append(url)

        # Detect redirect chains
        redirect_chains = []
        for src, dst in redirect_map.items():
            if dst in redirect_map:
                redirect_chains.append([src, dst, redirect_map[dst]])

        # Fetch + parse pages (only 200s, up to max_pages)
        pages_to_analyze = status_200[:max_pages]
        sem_fetch = asyncio.Semaphore(5)
        async def _fetch_parse(url: str):
            async with sem_fetch:
                html, _ = await fetch_page_html(url)
                return url, html

        fetch_results = await asyncio.gather(*[_fetch_parse(u) for u in pages_to_analyze], return_exceptions=True)

        all_pages: list[PageSummary] = []
        all_internal_links: set[str] = set()
        title_map: dict[str, list[str]] = {}

        for res in fetch_results:
            if isinstance(res, Exception) or not res[1]: continue
            url, html = res
            p = _parse_html_seo(html, url, "")
            score, issues, wins = _quick_page_score(p)
            title = p["title"]
            if title:
                title_map.setdefault(title.lower(), []).append(url)
            for link in p.get("external_links", []):
                href = link.get("url", "")
                if href:
                    all_internal_links.add(href)
            all_pages.append(PageSummary(
                url=url, http_status=200, title=title,
                word_count=p["word_count"], score=score,
                has_meta_description=bool(p["meta_desc"]),
                has_h1=bool(p["h1_texts"]), has_schema=bool(p["schema_types"]),
                is_indexable=p["is_indexable"], redirect_target=None,
                issues=issues, quick_wins=wins,
            ))

        # Add 404 pages
        for url in status_404:
            all_pages.append(PageSummary(
                url=url, http_status=404, title="", word_count=0, score=0,
                has_meta_description=False, has_h1=False, has_schema=False,
                is_indexable=False, redirect_target=None,
                issues=["404 Not Found — remove from sitemap or set up redirect"],
                quick_wins=["Redirect to nearest relevant page or remove from sitemap"],
            ))

        sorted_pages = sorted([p for p in all_pages if p.http_status == 200], key=lambda x: x.score, reverse=True)
        top_pages = sorted_pages[:5]
        problem_pages = sorted(all_pages, key=lambda x: x.score)[:5]

        scores = [p.score for p in all_pages if p.http_status == 200]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        overall = int(avg_score)

        # Site-wide stats
        pages_missing_meta = sum(1 for p in all_pages if not p.has_meta_description and p.http_status == 200)
        pages_missing_h1 = sum(1 for p in all_pages if not p.has_h1 and p.http_status == 200)
        pages_thin = sum(1 for p in all_pages if p.word_count < 300 and p.http_status == 200)
        pages_no_schema = sum(1 for p in all_pages if not p.has_schema and p.http_status == 200)
        pages_noindex = sum(1 for p in all_pages if not p.is_indexable)

        # Duplicate titles
        dup_groups = [urls for urls in title_map.values() if len(urls) > 1]

        # Cannibalization (pages with very similar first words in title)
        cannibalization: list[dict] = []
        title_starts: dict[str, list[str]] = {}
        for p in all_pages:
            if p.title:
                start = " ".join(p.title.lower().split()[:3])
                title_starts.setdefault(start, []).append(p.url)
        for key, urls in title_starts.items():
            if len(urls) > 1:
                cannibalization.append({"suspected_keyword": key, "urls": urls})

        # Core pages
        all_urls_lower = [p.url.lower() for p in all_pages]
        has_about = any("/about" in u for u in all_urls_lower)
        has_contact = any("/contact" in u for u in all_urls_lower)
        has_privacy = any("/privacy" in u for u in all_urls_lower)

        # Orphan pages (in sitemap but not linked from any analyzed page)
        analyzed_urls = {p.url for p in all_pages}
        orphan_pages = [u for u in analyzed_urls if u not in all_internal_links and u != domain + "/"]

        # LLM aggregate insights
        system = await _agent.build_system_prompt(request.user_id, request.organization_id)
        memory_context = request.metadata.get("memory_context", "")
        if memory_context:
            system += f"\n\n## Memory Context\n{memory_context}"

        site_summary = f"""
Domain: {domain}
Pages analyzed: {len(all_pages)} (200: {len(status_200)}, 404: {len(status_404)}, 301: {len(status_301)})
Overall site score: {overall}/100
Missing meta descriptions: {pages_missing_meta}
Missing H1 tags: {pages_missing_h1}
Thin content pages: {pages_thin}
No schema markup: {pages_no_schema}
Duplicate title groups: {len(dup_groups)}
Orphan pages: {len(orphan_pages)}
Has robots.txt: {robots['found']}
Has sitemap in robots.txt: {robots.get('has_sitemap_directive')}

Best pages: {', '.join(p.url for p in top_pages[:3])}
Worst pages: {', '.join(p.url + f" ({p.score})" for p in problem_pages[:3])}

Page titles: {'; '.join(p.title for p in all_pages[:8] if p.title)}
"""
        prompt = f"""You are a senior SEO strategist reviewing a site audit. Based on this data, return ONLY valid JSON:

{site_summary}

{{
  "critical_issues": ["2-4 most urgent site-wide issues"],
  "quick_wins": ["3-5 easy site-wide fixes with estimated time"],
  "site_health_summary": "2-3 sentence honest assessment of overall site SEO health",
  "content_gap_opportunities": ["3 specific content opportunities for this site"],
  "internal_linking_opportunities": ["3 specific internal linking improvements"]
}}"""

        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system, messages=[{"role": "user", "content": prompt}], max_tokens=800,
        )
        tokens_used = _llm.count_tokens(raw)
        llm_data = safe_json_loads(raw) or {}

        return SiteAuditResponse(
            domain=domain, total_pages_found=total_found,
            pages_analyzed=len([p for p in all_pages if p.http_status == 200]),
            overall_site_score=overall, avg_page_score=avg_score,
            pages_200=len(status_200), pages_301=len(status_301),
            pages_404=len(status_404), pages_other=len(status_other),
            redirect_chains=redirect_chains,
            pages_missing_meta=pages_missing_meta, pages_missing_h1=pages_missing_h1,
            pages_thin_content=pages_thin, pages_missing_schema=pages_no_schema,
            pages_noindex_in_sitemap=pages_noindex,
            duplicate_title_groups=dup_groups,
            cannibalization_candidates=cannibalization,
            orphan_pages=orphan_pages,
            has_about_page=has_about, has_contact_page=has_contact, has_privacy_page=has_privacy,
            robots_txt=RobotsTxtAnalysis(**robots),
            top_pages=top_pages, problem_pages=problem_pages, all_pages=all_pages,
            critical_issues=llm_data.get("critical_issues", []),
            quick_wins=llm_data.get("quick_wins", []),
            site_health_summary=str(llm_data.get("site_health_summary", "")),
            content_gap_opportunities=llm_data.get("content_gap_opportunities", []),
            internal_linking_opportunities=llm_data.get("internal_linking_opportunities", []),
            tokens_used=tokens_used, model_used=_agent.default_model,
        )
    except Exception:
        _log.exception("sage/site-audit failed")
        raise


# ─── Discover Pages (for page-picker UI) ─────────────────────────────────────

class DiscoverPagesRequest(BaseModel):
    domain: str
    user_id: str
    organization_id: str = ""
    metadata: dict = {}


class DiscoveredPage(BaseModel):
    url: str
    title: str
    status_code: int


class DiscoverPagesResponse(BaseModel):
    domain: str
    pages: list[DiscoveredPage]
    total_found: int
    sitemap_found: bool


@router.post("/discover-pages", response_model=DiscoverPagesResponse)
async def discover_pages(request: DiscoverPagesRequest) -> DiscoverPagesResponse:
    """Fetch page list from a domain's sitemap for user selection before batch audit."""
    from agents.scout.scraper import fetch_sitemap, fetch_page_html, fetch_page_status

    domain = request.domain.strip()
    if not domain.startswith("http"):
        domain = f"https://{domain}"
    domain = domain.rstrip("/")

    if settings.MOCK_MODE:
        return DiscoverPagesResponse(
            domain=domain, sitemap_found=True, total_found=6,
            pages=[
                DiscoveredPage(url=f"{domain}/", title="Home — Example SaaS", status_code=200),
                DiscoveredPage(url=f"{domain}/about", title="About Us", status_code=200),
                DiscoveredPage(url=f"{domain}/pricing", title="Pricing Plans", status_code=200),
                DiscoveredPage(url=f"{domain}/blog/seo-guide", title="The Complete SEO Guide 2025", status_code=200),
                DiscoveredPage(url=f"{domain}/blog/content-strategy", title="Content Strategy for SaaS", status_code=200),
                DiscoveredPage(url=f"{domain}/contact", title="Contact", status_code=200),
            ],
        )

    try:
        sitemap_urls = await fetch_sitemap(domain)
        sitemap_found = bool(sitemap_urls)

        if not sitemap_urls:
            try:
                html, _ = await fetch_page_html(domain)
                if html:
                    from bs4 import BeautifulSoup
                    from urllib.parse import urlparse as _up, urljoin
                    soup = BeautifulSoup(html, "html.parser")
                    base = _up(domain)
                    seen: set[str] = set()
                    for a in soup.find_all("a", href=True):
                        href = urljoin(domain, a["href"]).split("#")[0].split("?")[0].rstrip("/") or domain
                        p2 = _up(href)
                        if p2.netloc == base.netloc and p2.scheme in ("http", "https") and href not in seen:
                            seen.add(href)
                            sitemap_urls.append(href)
                            if len(sitemap_urls) >= 30:
                                break
            except Exception:
                pass

        sitemap_urls = list(dict.fromkeys(sitemap_urls))[:30]
        sem = asyncio.Semaphore(8)

        async def _check(url: str) -> DiscoveredPage | None:
            async with sem:
                try:
                    status, final_url = await fetch_page_status(url)
                    effective = final_url or url
                    title = ""
                    if status == 200:
                        try:
                            html, _ = await fetch_page_html(effective)
                            if html:
                                from bs4 import BeautifulSoup
                                soup = BeautifulSoup(html, "html.parser")
                                t = soup.find("title")
                                title = t.get_text(strip=True)[:120] if t else ""
                        except Exception:
                            pass
                    return DiscoveredPage(url=effective, title=title, status_code=status)
                except Exception:
                    return None

        raw = await asyncio.gather(*[_check(u) for u in sitemap_urls])
        pages = [r for r in raw if r is not None]
        pages.sort(key=lambda pg: (0 if pg.status_code == 200 else 1, pg.url))

        return DiscoverPagesResponse(domain=domain, pages=pages, total_found=len(sitemap_urls), sitemap_found=sitemap_found)
    except Exception:
        _log.exception("sage/discover-pages failed")
        raise


# ─── Batch Page Audit ─────────────────────────────────────────────────────────

class BatchPageAuditRequest(BaseModel):
    urls: list[str]
    target_keyword: str
    user_id: str
    organization_id: str = ""
    metadata: dict = {}


class BatchPageAuditResponse(BaseModel):
    domain: str
    total_audited: int
    results: list[PageSeoAuditResponse]
    tokens_used: int = 0
    model_used: str = ""


@router.post("/batch-page-audit", response_model=BatchPageAuditResponse)
async def batch_page_audit(request: BatchPageAuditRequest) -> BatchPageAuditResponse:
    """Run full page SEO audits in parallel for user-selected pages (max 5)."""
    import httpx
    from urllib.parse import urlparse as _up

    urls = [u.strip() for u in request.urls[:5] if u.strip()]
    if not urls:
        raise HTTPException(status_code=422, detail="No URLs provided")

    domain = _up(urls[0]).netloc

    if settings.MOCK_MODE:
        mock_r = PageSeoAuditResponse(
            url=urls[0], target_keyword=request.target_keyword, overall_score=64,
            url_analysis=UrlAnalysis(url=urls[0], is_https=True, keyword_in_slug=True,
                url_length=55, url_depth=2, has_stop_words=False, slug="", score=85, issues=[]),
            technical=TechnicalSeoAudit(score=71, title="Example Page",
                title_length=12, title_has_keyword=True, title_has_brand=False,
                meta_description="", meta_description_length=0,
                meta_description_has_keyword=False, meta_description_has_cta=False,
                has_canonical=True, canonical_url=urls[0], canonical_is_self=True,
                is_indexable=True, is_followable=True,
                h1_count=1, h1_text="Example H1", h1_has_keyword=True,
                h2_count=3, h3_count=4, keyword_in_h2=True,
                heading_hierarchy_valid=True, heading_hierarchy_issues=[],
                has_schema_markup=False, schema_types=[], schema_issues=[],
                schema_eligible_rich_results=[],
                has_og_tags=False, og_title="", og_description="", og_image="",
                has_twitter_card=False, has_viewport=True, has_hreflang=False,
                has_preconnect_hints=False, issues=["Missing meta description", "No schema"]),
            speed_signals=SpeedSignals(score=65, render_blocking_scripts=2,
                render_blocking_stylesheets=1, total_external_requests=12,
                images_lazy_loaded=4, images_not_lazy_loaded=2,
                images_using_modern_format=2, images_total=6,
                has_inline_critical_css=False, has_font_preloading=False, issues=[]),
            image_seo=ImageSeoAudit(score=70, images_total=6, images_missing_alt=1,
                images_with_descriptive_alt=4, images_with_generic_alt=1,
                images_with_keyword_filename=1, images_with_dimensions=5,
                images_without_dimensions=1, webp_avif_percentage=33.0, issues=[]),
            on_page=OnPageSeoAudit(score=68, word_count=900, reading_time_minutes=4,
                keyword_density="1.0%", keyword_occurrences=9,
                keyword_in_title=True, keyword_in_h1=True, keyword_in_meta=False,
                keyword_in_first_100_words=True, keyword_in_h2s=True, keyword_in_last_paragraph=False,
                lsi_keywords_found=[], lsi_keywords_missing=[],
                paa_answered=[], paa_unanswered=[],
                has_featured_snippet_structure=False, featured_snippet_type=None,
                has_faq_section=False, content_freshness=None, last_modified=None,
                readability_grade="Grade 8", content_depth_assessment="Moderate depth",
                anchor_text_generic_count=2, anchor_text_descriptive_count=5,
                issues=[], improvements=[]),
            eeat=EeatAudit(score=40, has_author_byline=False, has_author_bio=False,
                has_publication_date=False, has_updated_date=False,
                has_external_citations=False, citation_count=0,
                has_authoritative_citations=False, has_trust_links=True,
                has_social_proof_schema=False, credentials_signals=[],
                missing_signals=["Add author byline"], issues=[]),
            competitive=CompetitiveSeoAudit(score=50,
                serp_features_present=[], serp_features_missing=["featured_snippet"],
                avg_competitor_word_count=2000, your_word_count=900, word_count_gap=-1100,
                word_count_verdict="1,100 words behind competitors",
                top_competitors=[], content_gaps=[], unique_angle_opportunity="",
                featured_snippet_holder=None, featured_snippet_format=None,
                featured_snippet_tip="", paa_questions=[], competitor_schema_types=[]),
            critical_issues=["Missing meta description", "No schema markup"],
            high_priority=["Expand content to 2,000+ words"],
            medium_priority=["Convert images to WebP"],
            quick_wins=["Add meta description (30 min)"],
            mentor_summary="This page has solid keyword placement but needs meta description and schema to compete.",
            next_move="Write a compelling meta description targeting your primary keyword.",
            action_plan_30d=["Add meta description", "Add schema markup"],
            action_plan_60d=["Expand content to 2,000+ words"],
            action_plan_90d=["Build internal links from related pages"],
            tokens_used=0, model_used="mock",
        )
        results = [mock_r.model_copy(update={"url": u, "overall_score": max(30, 64 - i * 8)}) for i, u in enumerate(urls)]
        return BatchPageAuditResponse(domain=domain, total_audited=len(results), results=results)

    sem = asyncio.Semaphore(3)
    _internal_headers = {"X-Internal-Api-Key": settings.INTERNAL_API_KEY}

    async def _audit(url: str) -> PageSeoAuditResponse | None:
        async with sem:
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(
                        "http://127.0.0.1:8000/ai/sage/page-audit",
                        headers=_internal_headers,
                        json={
                            "url": url,
                            "target_keyword": request.target_keyword,
                            "user_id": request.user_id,
                            "organization_id": request.organization_id,
                            "metadata": request.metadata,
                        },
                    )
                    if resp.status_code == 200:
                        return PageSeoAuditResponse.model_validate(resp.json())
                    _log.warning("batch-page-audit: %s returned %d", url, resp.status_code)
            except Exception as exc:
                _log.warning("batch-page-audit failed for %s: %s", url, exc)
            return None

    raw = await asyncio.gather(*[_audit(u) for u in urls])
    valid = [r for r in raw if r is not None]

    return BatchPageAuditResponse(
        domain=domain,
        total_audited=len(valid),
        results=valid,
        tokens_used=sum(r.tokens_used for r in valid),
        model_used=_agent.default_model,
    )

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

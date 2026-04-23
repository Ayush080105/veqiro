import asyncio
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from agents.scout.agent import ScoutAgent
from agents.scout.scraper import scrape_url, hash_content, diff_content, fetch_rss, google_autocomplete

router = APIRouter(prefix="/ai/scout", tags=["Scout"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = ScoutAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

class ResearchTopicRequest(BaseModel):
    user_id: str
    topic: str
    depth: str = "standard"  # "quick" | "standard" | "deep"
    sources_hint: list[str] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "topic": "AI productivity tools for founders 2025",
                "depth": "standard",
                "sources_hint": [],
            }
        }
    )


class ResearchTopicResponse(BaseModel):
    findings: str
    synthesis: str
    sources_scraped: list[str]
    keywords_found: list[str]
    tokens_used: int = 0
    model_used: str = ""


class ResearchCompanyRequest(BaseModel):
    user_id: str
    company_name: str
    company_url: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "company_name": "Notion",
                "company_url": "https://notion.so",
            }
        }
    )


class CompanyProfile(BaseModel):
    name: str
    description: str
    founded: str
    team_size: str
    funding: str
    key_features: list[str]
    pricing: dict
    target_market: str
    strengths: list[str]
    weaknesses: list[str]
    recent_news: list[str]


class ResearchCompanyResponse(BaseModel):
    company: CompanyProfile
    scraped_at: str
    tokens_used: int = 0
    model_used: str = ""


class CompetitorInput(BaseModel):
    name: str
    url: str
    last_scan_hash: str | None = None

    model_config = ConfigDict(
        json_schema_extra={"example": {"name": "Notion", "url": "https://notion.so", "last_scan_hash": None}}
    )


class CompetitorScanRequest(BaseModel):
    user_id: str
    competitors: list[CompetitorInput]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "competitors": [
                    {"name": "Notion", "url": "https://notion.so", "last_scan_hash": None},
                    {"name": "ClickUp", "url": "https://clickup.com", "last_scan_hash": None},
                ],
            }
        }
    )


class CompetitorScanResult(BaseModel):
    competitor_name: str
    url: str
    has_changes: bool
    change_summary: str
    significance: str  # "low" | "medium" | "high"
    new_hash: str


class CompetitorScanResponse(BaseModel):
    results: list[CompetitorScanResult]
    scanned_at: str
    tokens_used: int = 0
    model_used: str = ""


class TrendingTopicsRequest(BaseModel):
    user_id: str
    industry: str
    count: int = 10

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "industry": "SaaS / AI Productivity",
                "count": 5,
            }
        }
    )


class TrendItem(BaseModel):
    topic: str
    momentum: str  # "rising" | "stable" | "declining"
    relevance_score: float
    content_angle: str
    search_volume_estimate: str


class TrendingTopicsResponse(BaseModel):
    trends: list[TrendItem]
    generated_at: str
    tokens_used: int = 0
    model_used: str = ""


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Scout chat")
async def scout_chat(request: ChatRequest) -> ChatSyncResponse:
    """
    Scout's intelligent research chat. Understands natural language requests and
    autonomously uses tools for web search, company research, competitor scanning,
    and trend discovery. Optimized for founder competitive intelligence.
    """
    try:
        return await _agent.chat_sync(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/research-topic", response_model=ResearchTopicResponse, summary="Research a topic")
async def research_topic(request: ResearchTopicRequest) -> ResearchTopicResponse:
    """Deep research on any topic using web scraping and LLM synthesis."""
    if settings.MOCK_MODE:
        keywords = await google_autocomplete(request.topic)
        return ResearchTopicResponse(
            findings=(
                f"**Research Findings: {request.topic}**\n\n"
                "**Market Size & Growth:**\n"
                "The global AI productivity tools market is valued at $8.4B in 2025, projected to reach $23.8B by 2026 (31% CAGR). "
                "SMBs represent 42% of TAM with founders and small teams as the fastest-growing segment.\n\n"
                "**Key Players:**\n"
                "1. Notion AI – 20M+ users, strong knowledge management, recent AI writing expansion\n"
                "2. Monday.com AI – Enterprise workflow automation, $500M+ ARR\n"
                "3. ClickUp AI – Aggressive SMB pricing, broad feature set\n"
                "4. Linear – Developer-focused, design-led, fast-growing\n\n"
                "**Emerging Trends:**\n"
                "- Vertical-specific AI agents outperform generalist tools by 3x in user retention\n"
                "- Voice-first interfaces gaining traction for mobile-first founders\n"
                "- Integration ecosystems (not standalone tools) winning in enterprise\n"
                "- 78% of founders prefer tools that integrate with existing stack vs. new ecosystems"
            ),
            synthesis=(
                f"The opportunity in {request.topic} is significant and largely unclaimed at the 'founder-specific' vertical. "
                "No dominant player owns this category with purpose-built AI agents tailored to founder workflows. "
                "The key strategic insight: founders need AI that understands business context, not generic chat. "
                "First-mover advantage is available in the niche of 'AI workspace for pre-seed to Series A founders.'"
            ),
            sources_scraped=["https://techcrunch.com", "https://crunchbase.com", "https://g2.com"],
            keywords_found=keywords[:8],
        )

    from agents.scout.scraper import serper_search
    keywords, search_results = await asyncio.gather(
        google_autocomplete(request.topic),
        serper_search(request.topic),
    )
    sources = request.sources_hint or []

    async def _safe_scrape(url: str) -> str | None:
        try:
            return (await scrape_url(url))[:2000]
        except Exception:
            return None

    scrape_outcomes = await asyncio.gather(*[_safe_scrape(u) for u in sources[:3]])
    scraped_texts = [t for t in scrape_outcomes if t is not None]

    search_context = ""
    if search_results:
        search_context = "\n\nWeb search results:\n" + "\n".join(
            f"- {r['title']}: {r['snippet']} ({r['link']})" for r in search_results[:8]
        )
    scraped_context = ""
    if scraped_texts:
        scraped_context = "\n\nScraped sources:\n" + "\n\n---\n\n".join(scraped_texts)

    system = await _agent.build_system_prompt(request.user_id)
    findings_raw, synthesis_raw = await asyncio.gather(
        _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": (
                f"Research and synthesize a comprehensive intelligence report on: {request.topic}\n"
                f"Related keywords: {keywords[:10]}{search_context}{scraped_context}\n\n"
                "Cover: market size & trends, key players, opportunities, risks. "
                "Cite sources where possible."
            )}],
        ),
        _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": (
                f"In 2-3 sentences, what is the single most important strategic insight for a founder "
                f"researching '{request.topic}'? Be specific and actionable."
            )}],
        ),
    )
    total_tokens = _llm.count_tokens(findings_raw) + _llm.count_tokens(synthesis_raw)
    return ResearchTopicResponse(
        findings=findings_raw,
        synthesis=synthesis_raw,
        sources_scraped=sources,
        keywords_found=keywords[:10],
        tokens_used=total_tokens,
        model_used=_agent.default_model,
    )


@router.post("/research-company", response_model=ResearchCompanyResponse, summary="Research a company")
async def research_company(request: ResearchCompanyRequest) -> ResearchCompanyResponse:
    """Build a comprehensive company profile through web research."""
    if settings.MOCK_MODE:
        return ResearchCompanyResponse(
            company=CompanyProfile(
                name=request.company_name,
                description=f"{request.company_name} is an AI-powered productivity and collaboration platform targeting knowledge workers and SMBs.",
                founded="2022",
                team_size="40-100 employees",
                funding="$12M Series A (Feb 2025)",
                key_features=[
                    "AI-powered task automation",
                    "Smart project templates",
                    "Real-time collaboration",
                    "Analytics dashboard",
                    "500+ native integrations",
                ],
                pricing={"starter": "$15/user/month", "pro": "$35/user/month", "enterprise": "Custom"},
                target_market="SMBs (10-200 employees), tech-forward teams",
                strengths=[
                    "Strong product design and UX",
                    "Large integration ecosystem",
                    "Well-funded with growth momentum",
                ],
                weaknesses=[
                    "Lacks vertical-specific features for founders",
                    "No financial/analytics intelligence built-in",
                    "Steep learning curve for non-technical users",
                ],
                recent_news=[
                    "Launched AI Copilot feature (Q1 2025)",
                    "Raised $12M Series A (Feb 2025)",
                    "Expanded to EU market (Mar 2025)",
                ],
            ),
            scraped_at=datetime.utcnow().isoformat(),
        )

    import json
    from core.utils import safe_json_loads
    from agents.scout.scraper import serper_search
    url = request.company_url or f"https://{request.company_name.lower().replace(' ', '')}.com"
    content, search_results = await asyncio.gather(
        scrape_url(url),
        serper_search(f"{request.company_name} company features pricing funding 2025"),
    )
    search_context = ""
    if search_results:
        search_context = "\n\nWeb search results:\n" + "\n".join(
            f"- {r['title']}: {r['snippet']}" for r in search_results[:5]
        )
    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Build a structured company intelligence profile for: {request.company_name}\n"
            f"Website content:\n{content[:2500]}{search_context}\n\n"
            "Return JSON with exactly these fields: "
            "name (string), description (string), founded (string), team_size (string), "
            "funding (string), key_features (list of strings), pricing (dict of tier→price), "
            "target_market (string), strengths (list of strings), weaknesses (list of strings), "
            "recent_news (list of strings). "
            "Return ONLY the JSON, no markdown fences."
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = safe_json_loads(raw)
        profile = CompanyProfile(**data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse company profile — retry. ({exc})")
    return ResearchCompanyResponse(
        company=profile,
        scraped_at=datetime.utcnow().isoformat(),
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


@router.post("/scan-competitors", response_model=CompetitorScanResponse, summary="Scan for competitor changes")
async def scan_competitors(request: CompetitorScanRequest) -> CompetitorScanResponse:
    """Monitor competitor websites for significant changes."""
    if settings.MOCK_MODE:
        results = []
        for comp in request.competitors:
            new_hash = hash_content(f"mock_content_{comp.name}_2025")
            has_changes = comp.last_scan_hash is not None and comp.last_scan_hash != new_hash
            results.append(CompetitorScanResult(
                competitor_name=comp.name,
                url=comp.url,
                has_changes=has_changes,
                change_summary=(
                    "Pricing page updated: Starter plan reduced from $19 to $15/user/month. "
                    "New 'AI Copilot' feature added to Pro tier. Homepage headline changed to emphasize AI."
                ) if has_changes else "No significant changes detected since last scan.",
                significance="high" if has_changes else "low",
                new_hash=new_hash,
            ))
        return CompetitorScanResponse(results=results, scanned_at=datetime.utcnow().isoformat())

    system = await _agent.build_system_prompt(request.user_id)

    async def _scan_one(comp: CompetitorInput) -> tuple[CompetitorScanResult, int]:
        content = await scrape_url(comp.url)
        new_hash = hash_content(content)
        has_changes = comp.last_scan_hash is not None and comp.last_scan_hash != new_hash

        if has_changes:
            diff = diff_content(comp.last_scan_hash or "", content[:3000])
            summary_raw = await _llm.complete(
                provider=_agent.default_provider, model=_agent.default_model,
                system=system,
                messages=[{"role": "user", "content": (
                    f"Analyze these changes on {comp.name}'s website ({comp.url}) "
                    f"and summarize what changed and its strategic significance for a competing founder:\n\n{diff[:2000]}\n\n"
                    "Return a 2-3 sentence summary and a significance level: low, medium, or high."
                )}],
            )
            _tokens = _llm.count_tokens(summary_raw)
            change_summary = summary_raw.strip()
            significance = "high" if any(w in summary_raw.lower() for w in ["pricing", "feature", "launch", "major"]) else "medium"
        else:
            change_summary = "No previous scan available." if comp.last_scan_hash is None else "No significant changes detected since last scan."
            significance = "low"
            _tokens = 0

        return CompetitorScanResult(
            competitor_name=comp.name,
            url=comp.url,
            has_changes=has_changes,
            change_summary=change_summary,
            significance=significance,
            new_hash=new_hash,
        ), _tokens

    pairs = await asyncio.gather(*[_scan_one(c) for c in request.competitors])
    results = [r for r, _ in pairs]
    total_tokens = sum(t for _, t in pairs)
    return CompetitorScanResponse(
        results=list(results),
        scanned_at=datetime.utcnow().isoformat(),
        tokens_used=total_tokens,
        model_used=_agent.default_model,
    )


@router.post("/trending-topics", response_model=TrendingTopicsResponse, summary="Get trending topics")
async def trending_topics(request: TrendingTopicsRequest) -> TrendingTopicsResponse:
    """Discover trending topics and content opportunities in a given industry."""
    if settings.MOCK_MODE:
        trends = [
            TrendItem(topic="AI agents replacing SaaS point solutions", momentum="rising", relevance_score=0.95,
                     content_angle="Thought leadership: why the future is agentic, not app-based",
                     search_volume_estimate="28K/month, +210% YoY"),
            TrendItem(topic="Founder burnout and productivity systems", momentum="rising", relevance_score=0.91,
                     content_angle="Pain point + solution: personal story about reclaiming time",
                     search_volume_estimate="15K/month, +85% YoY"),
            TrendItem(topic="AI-generated content detection tools", momentum="rising", relevance_score=0.82,
                     content_angle="Contrarian: why AI content still wins when done right",
                     search_volume_estimate="42K/month, +320% YoY"),
            TrendItem(topic="Bootstrapping vs VC in 2025", momentum="stable", relevance_score=0.78,
                     content_angle="Data-driven comparison with real founder examples",
                     search_volume_estimate="8K/month, +12% YoY"),
            TrendItem(topic="Product-led growth for B2B SaaS", momentum="stable", relevance_score=0.75,
                     content_angle="How-to guide with specific PLG metrics to track",
                     search_volume_estimate="22K/month, +35% YoY"),
        ]
        return TrendingTopicsResponse(trends=trends[:request.count], generated_at=datetime.utcnow().isoformat())

    import json
    from core.utils import safe_json_loads
    from agents.scout.scraper import serper_search
    keywords, news_results = await asyncio.gather(
        google_autocomplete(request.industry),
        serper_search(f"{request.industry} trends news 2025", search_type="news"),
    )
    news_context = ""
    if news_results:
        news_context = "\n\nRecent news:\n" + "\n".join(f"- {r['title']}: {r['snippet']}" for r in news_results[:6])
    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Identify {request.count} trending topics in {request.industry}.\n"
            f"Related keywords: {keywords[:10]}{news_context}\n\n"
            "Return a JSON array. Each item: topic, momentum (rising/stable/declining), "
            "relevance_score (0.0-1.0), content_angle, search_volume_estimate. "
            "Return ONLY the JSON array, no markdown fences."
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        items = safe_json_loads(raw)
        trends = [TrendItem(**item) for item in items[:request.count]]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Trending topics returned unparseable data — retry. ({exc})")
    return TrendingTopicsResponse(
        trends=trends,
        generated_at=datetime.utcnow().isoformat(),
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )

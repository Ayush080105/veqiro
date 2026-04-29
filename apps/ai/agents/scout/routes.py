import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, field_validator

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from agents.scout.agent import ScoutAgent
from agents.scout.scraper import scrape_url, fetch_rss, google_autocomplete

router = APIRouter(prefix="/ai/scout", tags=["Scout"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = ScoutAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

class ResearchTopicRequest(BaseModel):
    user_id: str
    organization_id: str = ""
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


class TopicPlayerItem(BaseModel):
    name: str
    role: str = ""
    note: str = ""

class TopicStatItem(BaseModel):
    label: str
    value: str

class ResearchTopicResponse(BaseModel):
    bottom_line: str = ""
    market_overview: str = ""
    key_players: list[TopicPlayerItem] = []
    opportunities: list[str] = []
    risks: list[str] = []
    key_stats: list[TopicStatItem] = []
    emerging_trends: list[str] = []
    target_customers: str = ""
    recommended_actions: list[str] = []
    # kept for server-layer compatibility
    sources_scraped: list[str] = []
    keywords_found: list[str] = []
    tokens_used: int = 0
    model_used: str = ""


class ResearchCompanyRequest(BaseModel):
    user_id: str
    organization_id: str = ""
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


class TrendingTopicsRequest(BaseModel):
    user_id: str
    organization_id: str = ""
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
    momentum: str = "stable"  # "rising" | "stable" | "declining"
    relevance_score: float = 0.5
    search_volume_estimate: str = "N/A"
    why_trending: str = ""
    market_size: str = ""
    target_audience: str = ""
    key_players: list[str] = []
    opportunity: str = ""
    key_challenges: list[str] = []
    time_horizon: str = ""
    related_trends: list[str] = []
    content_angle: str = ""
    content_hook: str = ""
    next_steps: list[str] = []

    @field_validator("search_volume_estimate", mode="before")
    @classmethod
    def coerce_to_str(cls, v: object) -> str:
        return str(v) if v is not None else "N/A"


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

    import logging as _log_rt
    from core.utils import safe_json_loads
    from agents.scout.scraper import serper_search

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    year = datetime.now(timezone.utc).year
    topic = request.topic
    depth = request.depth  # "quick" | "standard" | "deep"

    # Scale searches and scraping by depth
    if depth == "quick":
        search_tasks = [
            google_autocomplete(topic),
            serper_search(f"{topic} market overview {year}"),
        ]
        keywords, results_general = await asyncio.gather(*search_tasks)
        results_news, results_deep = [], []
        scrape_limit, search_snippet_limit = 0, 4
    elif depth == "deep":
        keywords, results_general, results_news, results_deep = await asyncio.gather(
            google_autocomplete(topic),
            serper_search(f"{topic} market size trends {year}"),
            serper_search(f"{topic} news analysis {year}", search_type="news"),
            serper_search(f"{topic} opportunities challenges risks players"),
        )
        scrape_limit, search_snippet_limit = 3, 8
    else:  # standard
        keywords, results_general, results_news = await asyncio.gather(
            google_autocomplete(topic),
            serper_search(f"{topic} market size trends {year}"),
            serper_search(f"{topic} news analysis {year}", search_type="news"),
        )
        results_deep = []
        scrape_limit, search_snippet_limit = 1, 6

    sources = request.sources_hint or []
    async def _safe_scrape(url: str) -> str | None:
        try:
            return (await scrape_url(url))[:2000]
        except Exception:
            return None
    scraped_texts = [t for t in await asyncio.gather(*[_safe_scrape(u) for u in sources[:scrape_limit]]) if t]

    def _fmt_results(results: list, label: str, limit: int = 6) -> str:
        if not results:
            return ""
        lines = "\n".join(f"  - {r['title']}: {r['snippet']} ({r['link']})" for r in results[:limit])
        return f"\n\n**{label}:**\n{lines}"

    search_context = (
        _fmt_results(results_general, "General search", search_snippet_limit)
        + _fmt_results(results_news, "Recent news", search_snippet_limit)
        + _fmt_results(results_deep, "Deep search (opportunities/risks/players)", search_snippet_limit)
        + ("\n\nScraped sources:\n" + "\n---\n".join(scraped_texts) if scraped_texts else "")
    )
    source_urls = [r["link"] for r in (results_general + results_news)[:8] if r.get("link")]

    # Scale output volume by depth
    if depth == "quick":
        depth_instructions = (
            "This is a QUICK overview. Be concise:\n"
            "- bottom_line: 1-2 sentences\n"
            "- market_overview: 2 sentences\n"
            "- key_players: 2-3 players\n"
            "- opportunities: 2-3 items, 1 sentence each\n"
            "- risks: 2-3 items, 1 sentence each\n"
            "- key_stats: 2-4 stats\n"
            "- emerging_trends: 2-3 items\n"
            "- target_customers: 1-2 sentences\n"
            "- recommended_actions: 2-3 items\n"
        )
    elif depth == "deep":
        depth_instructions = (
            "This is a DEEP DIVE. Be thorough and detailed:\n"
            "- bottom_line: 3-4 sentences with specific evidence\n"
            "- market_overview: 4-5 sentences with TAM, SAM, growth rate, and key drivers\n"
            "- key_players: 6-8 players with detailed notes\n"
            "- opportunities: 6-8 items, 2-3 sentences each\n"
            "- risks: 6-8 items, 2-3 sentences each\n"
            "- key_stats: 6-10 stats\n"
            "- emerging_trends: 6-8 items\n"
            "- target_customers: 3-4 sentences with segments and willingness to pay\n"
            "- recommended_actions: 6-8 specific, prioritised steps\n"
        )
    else:
        depth_instructions = (
            "This is a STANDARD analysis:\n"
            "- bottom_line: 2-3 sentences\n"
            "- market_overview: 3-4 sentences\n"
            "- key_players: 4-5 players\n"
            "- opportunities: 4-5 items, 1-2 sentences each\n"
            "- risks: 4-5 items, 1-2 sentences each\n"
            "- key_stats: 4-6 stats\n"
            "- emerging_trends: 4-5 items\n"
            "- target_customers: 2-3 sentences\n"
            "- recommended_actions: 4-5 items\n"
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    try:
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": (
                f"Today is {today}. Produce a market intelligence brief on: **{topic}**\n"
                f"Depth: {depth.upper()}\n"
                f"Related keywords: {keywords[:10]}"
                f"{search_context}\n\n"
                f"{depth_instructions}\n"
                "Return a single JSON object with these exact fields: "
                "bottom_line, market_overview, key_players (array of {name, role, note}), "
                "opportunities (array of strings), risks (array of strings), "
                "key_stats (array of {label, value}), emerging_trends (array of strings), "
                "target_customers, recommended_actions (array of strings).\n"
                "Label facts [FACT], inferences [INFERRED], estimates [ESTIMATED]. Return ONLY the JSON, no markdown fences."
            )}],
        )
        tokens_used = _llm.count_tokens(raw)
        parsed = safe_json_loads(raw)

        def _players(items: list) -> list[TopicPlayerItem]:
            out = []
            for p in items:
                try:
                    out.append(TopicPlayerItem(**p) if isinstance(p, dict) else TopicPlayerItem(name=str(p)))
                except Exception:
                    pass
            return out

        def _stats(items: list) -> list[TopicStatItem]:
            out = []
            for s in items:
                try:
                    out.append(TopicStatItem(**s) if isinstance(s, dict) else TopicStatItem(label="Stat", value=str(s)))
                except Exception:
                    pass
            return out

        return ResearchTopicResponse(
            bottom_line=parsed.get("bottom_line", ""),
            market_overview=parsed.get("market_overview", ""),
            key_players=_players(parsed.get("key_players", [])),
            opportunities=parsed.get("opportunities", []),
            risks=parsed.get("risks", []),
            key_stats=_stats(parsed.get("key_stats", [])),
            emerging_trends=parsed.get("emerging_trends", []),
            target_customers=parsed.get("target_customers", ""),
            recommended_actions=parsed.get("recommended_actions", []),
            sources_scraped=source_urls,
            keywords_found=keywords[:10],
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )
    except HTTPException:
        raise
    except Exception as exc:
        _log_rt.getLogger(__name__).exception("research_topic failed | topic=%r", topic)
        raise HTTPException(status_code=500, detail=f"Research topic error: {exc}")


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
            scraped_at=datetime.now(timezone.utc).isoformat(),
        )

    import json
    from core.utils import safe_json_loads
    from agents.scout.scraper import serper_search

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    year = datetime.now(timezone.utc).year
    url = request.company_url or f"https://{request.company_name.lower().replace(' ', '')}.com"
    company_name = request.company_name

    (
        results_features,
        results_funding,
        results_reviews,
        results_news,
        results_jobs,
        results_vs,
        scraped_content,
    ) = await asyncio.gather(
        serper_search(f"{company_name} features pricing plans {year}"),
        serper_search(f"{company_name} funding raised investors {year}"),
        serper_search(f"{company_name} reviews complaints reddit g2 trustpilot"),
        serper_search(f"{company_name} news announcement launch {year}", search_type="news"),
        serper_search(f"{company_name} hiring jobs team size {year}"),
        serper_search(f"{company_name} vs alternatives competitors"),
        scrape_url(url),
    )

    def _fmt(results: list, label: str, limit: int = 5) -> str:
        if not results:
            return ""
        lines = "\n".join(f"  - {r['title']}: {r['snippet']}" for r in results[:limit])
        return f"\n\n**{label}:**\n{lines}"

    search_context = (
        _fmt(results_features, "Features & Pricing search")
        + _fmt(results_funding, "Funding & Investors search")
        + _fmt(results_reviews, "Reviews & Sentiment search")
        + _fmt(results_news, "Recent News")
        + _fmt(results_jobs, "Hiring & Team Size search")
        + _fmt(results_vs, "Competitors & Alternatives search")
    )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Today is {today}. Build a comprehensive, structured company intelligence profile for: **{company_name}**\n\n"
            f"Homepage content:\n{scraped_content[:2500]}"
            f"{search_context}\n\n"
            "Label every fact as [FACT], every inference as [INFERRED], every estimate as [ESTIMATED].\n\n"
            "Return JSON with exactly these fields:\n"
            "- name (string)\n"
            "- description (string — 2-3 sentence overview)\n"
            "- founded (string)\n"
            "- team_size (string)\n"
            "- funding (string — total raised, stage, lead investors if known)\n"
            "- key_features (list of strings — 5-8 core product capabilities)\n"
            "- pricing (dict of tier→price, e.g. {\"free\": \"$0\", \"pro\": \"$X/mo\"})\n"
            "- target_market (string — ICP description)\n"
            "- strengths (list of strings — 3-5 competitive advantages)\n"
            "- weaknesses (list of strings — 3-5 gaps or vulnerabilities)\n"
            "- recent_news (list of strings — 3-5 most recent developments as of today)\n\n"
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
        scraped_at=datetime.now(timezone.utc).isoformat(),
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


@router.post("/trending-topics", response_model=TrendingTopicsResponse, summary="Get trending topics")
async def trending_topics(request: TrendingTopicsRequest) -> TrendingTopicsResponse:
    """Discover trending topics and content opportunities in a given industry."""
    if settings.MOCK_MODE:
        trends = [
            TrendItem(topic="AI agents replacing SaaS point solutions", momentum="rising", relevance_score=0.95,
                     content_angle="Thought leadership: why the future is agentic, not app-based",
                     search_volume_estimate="28K/month, +210% YoY",
                     source_url="https://techcrunch.com"),
            TrendItem(topic="Founder burnout and productivity systems", momentum="rising", relevance_score=0.91,
                     content_angle="Pain point + solution: personal story about reclaiming time",
                     search_volume_estimate="15K/month, +85% YoY",
                     source_url="https://www.paulgraham.com/articles.html"),
            TrendItem(topic="AI-generated content detection tools", momentum="rising", relevance_score=0.82,
                     content_angle="Contrarian: why AI content still wins when done right",
                     search_volume_estimate="42K/month, +320% YoY",
                     source_url=None),
            TrendItem(topic="Bootstrapping vs VC in 2026", momentum="stable", relevance_score=0.78,
                     content_angle="Data-driven comparison with real founder examples",
                     search_volume_estimate="8K/month, +12% YoY",
                     source_url=None),
            TrendItem(topic="Product-led growth for B2B SaaS", momentum="stable", relevance_score=0.75,
                     content_angle="How-to guide with specific PLG metrics to track",
                     search_volume_estimate="22K/month, +35% YoY",
                     source_url=None),
        ]
        return TrendingTopicsResponse(trends=trends[:request.count], generated_at=datetime.now(timezone.utc).isoformat())

    import logging as _logging
    from core.utils import safe_json_loads
    from agents.scout.scraper import serper_search

    _log = _logging.getLogger(__name__)
    try:
        today = datetime.now(timezone.utc).strftime("%B %d, %Y")
        year = datetime.now(timezone.utc).year
        keywords, news_results = await asyncio.gather(
            google_autocomplete(request.industry),
            serper_search(f"{request.industry} trends news {year}", search_type="news"),
        )
        news_context = ""
        if news_results:
            news_context = "\n\nRecent news:\n" + "\n".join(f"- {r['title']}: {r['snippet']}" for r in news_results[:6])
        system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
        raw = await _llm.complete(
            provider=_agent.default_provider, model=_agent.default_model,
            system=system,
            messages=[{"role": "user", "content": (
                f"Today is {today}. Identify {request.count} trending topics in {request.industry}.\n"
                f"Related keywords: {keywords[:10]}{news_context}\n\n"
                "Return a JSON array. Each item is a full trend intelligence brief with these fields:\n"
                "- topic: string — clear trend name\n"
                "- momentum: 'rising', 'stable', or 'declining'\n"
                "- relevance_score: float 0.0–1.0\n"
                "- search_volume_estimate: string — e.g. '12K/month'\n"
                "- why_trending: string — 2-3 sentences on the specific trigger (event, regulation, product launch, cultural shift) and why it matters RIGHT NOW\n"
                "- market_size: string — 2-3 sentences on the size and growth trajectory of this opportunity (include TAM or growth % if known)\n"
                "- target_audience: string — 2-3 sentences describing exactly who is searching for and caring about this trend (job titles, company stages, pain points)\n"
                "- key_players: array of 2–4 company or brand names actively riding this trend\n"
                "- opportunity: string — 2-3 sentences on the concrete gap: who is underserved, what product or service could be built, and what the wedge is\n"
                "- key_challenges: array of 2–4 strings, each a specific challenge or risk in this space (technical, regulatory, competitive, adoption)\n"
                "- time_horizon: string — one sentence: is this a 3-6 month tactical window, a 1-2 year strategic bet, or a 5+ year structural shift? Explain why.\n"
                "- related_trends: array of 2–4 strings naming related trends this connects to\n"
                "- content_angle: string — 2-3 sentences on a specific content angle: format, audience pain point, unique perspective\n"
                "- content_hook: string — a punchy, ready-to-post headline or opening line (max 15 words)\n"
                "- next_steps: array of 3–5 strings, each a concrete actionable step a founder should take THIS WEEK to act on this trend\n"
                "Return ONLY the JSON array, no markdown fences."
            )}],
        )
        tokens_used = _llm.count_tokens(raw)
        parsed = safe_json_loads(raw)
        if isinstance(parsed, dict):
            parsed = next((v for v in parsed.values() if isinstance(v, list)), [])
        items: list = parsed if isinstance(parsed, list) else []
        trends = []
        for item in items[:request.count]:
            try:
                trends.append(TrendItem(**item))
            except Exception as item_exc:
                _log.warning("TrendItem parse failed for %r: %s", item, item_exc)
        if not trends:
            raise ValueError(f"No valid trend items in LLM output: {raw[:200]!r}")
    except HTTPException:
        raise
    except Exception as exc:
        _log.exception("trending_topics failed | industry=%r", request.industry)
        raise HTTPException(status_code=500, detail=f"Trending topics error: {exc}")
    return TrendingTopicsResponse(
        trends=trends,
        generated_at=datetime.now(timezone.utc).isoformat(),
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


# ── Discover Competitors ──────────────────────────────────────────────────────

class DiscoveredCompetitor(BaseModel):
    name: str
    url: str
    why_competitive: str
    pricing_model: str


class DiscoverCompetitorsRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    description: str
    industry: str
    count: int = 8

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "description": "AI workspace for startup founders with research and content agents",
                "industry": "AI productivity SaaS",
                "count": 8,
            }
        }
    )


class DiscoverCompetitorsResponse(BaseModel):
    competitors: list[DiscoveredCompetitor]
    generated_at: str
    tokens_used: int = 0
    model_used: str = ""


@router.post("/discover-competitors", response_model=DiscoverCompetitorsResponse, summary="Discover competitors online")
async def discover_competitors(request: DiscoverCompetitorsRequest) -> DiscoverCompetitorsResponse:
    """Find real competitors for a business using live web research."""
    if settings.MOCK_MODE:
        mock_competitors = [
            DiscoveredCompetitor(name="Notion AI", url="https://notion.so", why_competitive="All-in-one workspace with AI writing assistant targeting knowledge workers", pricing_model="Freemium, $10–$18/user/month"),
            DiscoveredCompetitor(name="ClickUp AI", url="https://clickup.com", why_competitive="Aggressive feature parity across project management, docs, and AI at low price", pricing_model="Freemium, $7–$19/user/month"),
            DiscoveredCompetitor(name="Monday.com", url="https://monday.com", why_competitive="Strong enterprise workflow automation with growing AI suite", pricing_model="$9–$24/user/month, Enterprise custom"),
            DiscoveredCompetitor(name="Linear", url="https://linear.app", why_competitive="Design-led developer productivity tool with strong product team following", pricing_model="Free tier, $8–$16/user/month"),
            DiscoveredCompetitor(name="Taskade", url="https://taskade.com", why_competitive="AI-first workspace specifically targeting startup teams and solo founders", pricing_model="Freemium, $8–$16/user/month"),
        ]
        return DiscoverCompetitorsResponse(competitors=mock_competitors[:request.count], generated_at=datetime.now(timezone.utc).isoformat())

    import json
    from core.utils import safe_json_loads
    from agents.scout.scraper import serper_search

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    year = datetime.now(timezone.utc).year
    results_alternatives, results_best = await asyncio.gather(
        serper_search(f"{request.industry} tools alternatives {year}"),
        serper_search(f"best {request.industry} software companies {year}"),
    )
    all_results = results_alternatives[:6] + results_best[:6]
    search_context = "\n\nSearch results:\n" + "\n".join(
        f"- {r['title']}: {r['snippet']} ({r['link']})" for r in all_results
    ) if all_results else ""

    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Today is {today}. Find {request.count} real competitors for a business described as: \"{request.description}\" in the {request.industry} space.\n"
            f"{search_context}\n\n"
            f"Return a JSON array of up to {request.count} competitors. Each object must have:\n"
            "- name: company name (string)\n"
            "- url: company website URL (string, must be a real, working URL)\n"
            "- why_competitive: 1 sentence explaining how they compete with the described business (string)\n"
            "- pricing_model: their pricing approach e.g. 'Freemium, $X/mo', 'Enterprise only', 'Usage-based' (string)\n\n"
            "Only include real, verifiable companies. Return ONLY the JSON array, no markdown fences."
        )}],
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        parsed = safe_json_loads(raw)
        if isinstance(parsed, dict):
            parsed = next((v for v in parsed.values() if isinstance(v, list)), [])
        items: list = parsed if isinstance(parsed, list) else []
        competitors = []
        for item in items[:request.count]:
            try:
                competitors.append(DiscoveredCompetitor(**item))
            except Exception:
                pass
        if not competitors:
            raise ValueError("No valid competitors parsed")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Competitor discovery returned unparseable data — retry. ({exc})")
    return DiscoverCompetitorsResponse(
        competitors=competitors,
        generated_at=datetime.now(timezone.utc).isoformat(),
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )

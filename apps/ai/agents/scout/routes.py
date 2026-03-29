import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from agents.scout.agent import ScoutAgent
from agents.scout.scraper import scrape_url, hash_content, diff_content, fetch_rss, google_autocomplete

router = APIRouter(prefix="/ai/scout", tags=["Scout"])

_llm = LLMClient()
_rag = RAGService()
_agent = ScoutAgent(_llm, _rag)


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


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Scout chat")
async def scout_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Scout's research response as a standard JSON response."""
    return await _agent.chat_sync(request)


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

    keywords = await google_autocomplete(request.topic)
    sources = request.sources_hint or []
    scraped_texts = []
    for url in sources[:3]:
        text = await scrape_url(url)
        scraped_texts.append(text[:2000])

    system = await _agent.build_system_prompt(request.user_id)
    context = f"Topic: {request.topic}\n\nScraped content:\n" + "\n\n---\n\n".join(scraped_texts)
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Research and synthesize findings on: {context}"}],
    )
    return ResearchTopicResponse(
        findings=raw,
        synthesis=f"Key insight: {raw[:300]}",
        sources_scraped=sources,
        keywords_found=keywords[:10],
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

    url = request.company_url or f"https://{request.company_name.lower().replace(' ', '')}.com"
    content = await scrape_url(url)
    system = await _agent.build_system_prompt(request.user_id)
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Build a company profile for {request.company_name}. Content: {content[:3000]}"}],
    )
    return ResearchCompanyResponse(
        company=CompanyProfile(
            name=request.company_name,
            description=raw[:300],
            founded="Unknown",
            team_size="Unknown",
            funding="Unknown",
            key_features=[],
            pricing={},
            target_market="Unknown",
            strengths=[],
            weaknesses=[],
            recent_news=[],
        ),
        scraped_at=datetime.utcnow().isoformat(),
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

    results = []
    for comp in request.competitors:
        content = await scrape_url(comp.url)
        new_hash = hash_content(content)
        has_changes = comp.last_scan_hash is not None and comp.last_scan_hash != new_hash
        change_summary = "No previous scan available."
        if has_changes:
            change_summary = f"Changes detected. New hash: {new_hash[:8]}..."
        results.append(CompetitorScanResult(
            competitor_name=comp.name,
            url=comp.url,
            has_changes=has_changes,
            change_summary=change_summary,
            significance="medium" if has_changes else "low",
            new_hash=new_hash,
        ))
    return CompetitorScanResponse(results=results, scanned_at=datetime.utcnow().isoformat())


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

    keywords = await google_autocomplete(request.industry)
    system = await _agent.build_system_prompt(request.user_id)
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Identify {request.count} trending topics in {request.industry}. Keywords: {keywords}. Return as JSON array with fields: topic, momentum, relevance_score, content_angle, search_volume_estimate"}],
    )
    try:
        items = json.loads(raw)
        trends = [TrendItem(**item) for item in items[:request.count]]
    except Exception:
        trends = []
    return TrendingTopicsResponse(trends=trends, generated_at=datetime.utcnow().isoformat())

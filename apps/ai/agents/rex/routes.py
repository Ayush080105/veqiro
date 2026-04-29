import asyncio
import json
import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse, DataPoint
from core.config import settings
from core.utils import strip_json_fences, safe_json_loads
from agents.rex.agent import RexAgent
from agents.rex.analytics import compute_anomalies, compute_health_indicator, compute_derived_metrics, compute_runway_scenarios, compute_unit_economics, correlate_anomalies
from agents.rex.forecasting import forecast_metric

router = APIRouter(prefix="/ai/rex", tags=["Rex"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = RexAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

class MetricsAnalysisRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    metrics: dict[str, list[DataPoint]]
    period: str = "monthly"

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "metrics": {
                    "revenue": [
                        {"date": "2025-01-01", "value": 42000},
                        {"date": "2025-02-01", "value": 48500},
                        {"date": "2025-03-01", "value": 58000},
                    ]
                },
                "period": "monthly",
            }
        }
    )


class AnalysisSummary(BaseModel):
    summary: str
    trend: str
    anomalies: list[dict]
    insights: list[str]
    health_indicator: str


class MetricsAnalysisResponse(BaseModel):
    analysis: AnalysisSummary
    charts_data: dict
    tokens_used: int = 0
    model_used: str = ""
    data_points_analyzed: int = 0
    confidence_level: str = "medium"


class ForecastRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    metric_name: str
    historical_data: list[DataPoint]
    horizon_days: int = 30

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "metric_name": "mrr",
                "historical_data": [
                    {"date": "2025-01-01", "value": 42000},
                    {"date": "2025-02-01", "value": 48500},
                    {"date": "2025-03-01", "value": 58000},
                ],
                "horizon_days": 30,
            }
        }
    )


class ForecastResponse(BaseModel):
    forecast: list[dict]
    confidence: float
    methodology: str
    summary: str
    tokens_used: int = 0
    model_used: str = ""


class FinancialAnalysisRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    revenue_data: list[DataPoint]
    expenses_data: list[DataPoint] = []
    subscribers_data: list[DataPoint] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "revenue_data": [
                    {"date": "2025-01-01", "value": 42000},
                    {"date": "2025-02-01", "value": 48500},
                    {"date": "2025-03-01", "value": 58000},
                ],
                "expenses_data": [{"date": "2025-03-01", "value": 35000}],
                "subscribers_data": [
                    {"date": "2025-02-01", "value": 230},
                    {"date": "2025-03-01", "value": 248},
                ],
            }
        }
    )


class FinancialAnalysisResponse(BaseModel):
    metrics: dict
    health_indicator: str
    narrative: str
    recommendations: list[str]
    tokens_used: int = 0
    model_used: str = ""
    data_points_analyzed: int = 0
    confidence_level: str = "medium"


class BriefingRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    date: str = ""
    all_metrics: dict = {}
    agent_summaries: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "date": "2025-03-01",
                "all_metrics": {"mrr": 58000, "churn_rate": 0.021},
                "agent_summaries": {"maya": "3 posts published, 12% engagement lift"},
            }
        }
    )


class BriefingResponse(BaseModel):
    briefing: dict
    tokens_used: int = 0
    model_used: str = ""


class InvestorUpdateRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    period: str
    metrics: dict = {}
    highlights: list[str] = []
    asks: list[str] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "period": "March 2025",
                "metrics": {"mrr": 58000, "arr": 696000, "growth_rate_pct": 19.7, "churn_rate_pct": 2.1},
                "highlights": ["Crossed $58K MRR milestone", "Launched enterprise tier", "2 Fortune 500 pilots started"],
                "asks": ["Introductions to Series A firms", "Advice on enterprise pricing strategy"],
            }
        }
    )


class InvestorUpdateResponse(BaseModel):
    subject_line: str
    executive_summary: str
    metrics_section: dict
    highlights_section: list[str]
    challenges_section: list[str]
    asks_section: list[str]
    full_email_body: str
    tokens_used: int = 0
    model_used: str = ""


class RunwayRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    cash_on_hand: float
    monthly_burn: float
    monthly_revenue: float = 0.0
    growth_rate_pct: float = 0.0
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "cash_on_hand": 750000.0,
                "monthly_burn": 48000.0,
                "monthly_revenue": 62000.0,
                "growth_rate_pct": 8.0,
                "metadata": {},
            }
        }
    )


class RunwayResponse(BaseModel):
    months_remaining: float | None
    date_of_zero: str
    cash_on_hand: float
    monthly_burn: float
    monthly_revenue: float
    net_burn: float
    scenarios: list[dict]
    verdict: str
    recommendation: str
    tokens_used: int = 0
    model_used: str = ""


class UnitEconomicsRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    marketing_spend: list[DataPoint]
    new_customers: list[DataPoint]
    avg_monthly_revenue_per_customer: float
    avg_customer_lifetime_months: float = 24.0
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "marketing_spend": [
                    {"date": "2025-01-01", "value": 14000},
                    {"date": "2025-02-01", "value": 16000},
                    {"date": "2025-03-01", "value": 18000},
                ],
                "new_customers": [
                    {"date": "2025-01-01", "value": 41},
                    {"date": "2025-02-01", "value": 47},
                    {"date": "2025-03-01", "value": 54},
                ],
                "avg_monthly_revenue_per_customer": 175.0,
                "avg_customer_lifetime_months": 24.0,
                "metadata": {},
            }
        }
    )


class UnitEconomicsResponse(BaseModel):
    cac: float
    ltv: float
    ltv_cac_ratio: float
    payback_months: float
    total_spend_analyzed: float
    total_new_customers_analyzed: int
    arpu: float
    lifetime_months: float
    ltv_cac_health: str
    payback_health: str
    health: str
    benchmark_context: str
    recommendations: list[str]
    tokens_used: int = 0
    model_used: str = ""


class ScenarioRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    base_metrics: dict
    scenarios: list[dict]
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "base_metrics": {"mrr": 62000, "burn": 48000, "cash": 750000, "growth_rate": 0.08},
                "scenarios": [
                    {"name": "Hire 2 engineers", "changes": {"burn_delta": 20000}},
                    {"name": "Cut marketing 40%", "changes": {"burn_delta": -8000, "growth_rate_override": 0.05}},
                ],
                "metadata": {},
            }
        }
    )


class ScenarioResponse(BaseModel):
    base_case: dict
    scenarios: list[dict]
    recommendation: str
    tokens_used: int = 0
    model_used: str = ""


class WeeklyDigestRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    metrics: dict
    prev_week: dict = {}
    metadata: dict = {}

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "metrics": {
                    "mrr": 62000, "arr": 744000, "burn": 48000, "cash": 750000,
                    "churn_rate": 0.021, "growth_rate": 0.068, "new_customers": 42,
                    "cac": 340, "ltv": 4200,
                },
                "prev_week": {
                    "mrr": 58100, "arr": 697200, "burn": 47000, "cash": 798000,
                    "churn_rate": 0.022, "growth_rate": 0.063, "new_customers": 38,
                    "cac": 358, "ltv": 4200,
                },
                "metadata": {},
            }
        }
    )


class WeeklyDigestResponse(BaseModel):
    period: str
    headline: str
    wow_changes: list[dict]
    alerts: list[dict]
    green_flags: list[dict]
    focus_this_week: list[str]
    generated_at: str
    tokens_used: int = 0
    model_used: str = ""
    confidence_level: str = "medium"
    metrics_count: int = 0


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Rex chat")
async def rex_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Rex's data analysis response as a standard JSON response."""
    return await _agent.chat_sync(request)


@router.post("/analyze-metrics", response_model=MetricsAnalysisResponse, summary="Analyze business metrics")
async def analyze_metrics(request: MetricsAnalysisRequest) -> MetricsAnalysisResponse:
    """Analyze business metrics and return insights with anomaly detection."""
    if settings.MOCK_MODE:
        return MetricsAnalysisResponse(
            analysis=AnalysisSummary(
                summary="MRR grew 38.1% over the analysis period, from $42,000 to $58,000. Strong upward trend with consistent month-over-month acceleration.",
                trend="up",
                anomalies=[],
                insights=[
                    "MRR growth rate of 38.1% exceeds the 20% SaaS benchmark – excellent trajectory",
                    "No anomalies detected – growth is consistent and linear",
                    "At current growth rate, ARR will exceed $1M within 4-5 months",
                    "Recommend analyzing CAC trends to ensure unit economics stay positive at scale",
                ],
                health_indicator="green",
            ),
            charts_data={
                "revenue_chart": [
                    {"date": "2025-01-01", "value": 42000},
                    {"date": "2025-02-01", "value": 48500},
                    {"date": "2025-03-01", "value": 58000},
                ]
            },
        )

    per_metric_anomalies: dict[str, list[dict]] = {}
    charts = {}
    health_inputs: dict = {}

    for metric_name, data_points in request.metrics.items():
        anomalies = compute_anomalies(data_points)
        per_metric_anomalies[metric_name] = anomalies
        charts[metric_name] = [{"date": dp.date, "value": dp.value} for dp in data_points]

        if len(data_points) >= 2:
            sorted_dps = sorted(data_points, key=lambda d: d.date)
            prev_val = sorted_dps[-2].value
            curr_val = sorted_dps[-1].value
            if metric_name in ("revenue", "mrr") and prev_val:
                health_inputs["growth_rate"] = (curr_val - prev_val) / prev_val
            elif metric_name == "churn_rate":
                health_inputs["churn_rate"] = curr_val
            elif metric_name in ("subscribers", "users") and prev_val > 0:
                health_inputs["churn_rate"] = max(0.0, (prev_val - curr_val) / prev_val)

    # Cross-correlate anomalies to find root-cause hints
    all_anomalies = correlate_anomalies(per_metric_anomalies)

    health = compute_health_indicator({
        "churn_rate": health_inputs.get("churn_rate", 0.0),
        "growth_rate": health_inputs.get("growth_rate", 0.0),
    })

    total_points = sum(len(v) for v in request.metrics.values())
    confidence_level = "high" if total_points >= 12 else "medium" if total_points >= 6 else "low"

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    metrics_summary = json.dumps({k: [{"date": d.date, "value": d.value} for d in v] for k, v in request.metrics.items()})
    prompt = (
        f"You are Rex, a CFO analyst. Analyze these {request.period} business metrics for a SaaS startup:\n"
        f"{metrics_summary}\n\n"
        "SaaS benchmarks:\n"
        "- MRR growth >10%/mo = excellent, 5-10% = good, <5% = watch, negative = critical\n"
        "- Monthly churn <2% = green, 2-4% = amber, >4% = red\n"
        "- Net burn negative (profitable) = green; runway <6mo = red\n"
        "- LTV:CAC >3x = green, 2-3x = amber, <2x = red\n\n"
        "Return a JSON object with:\n"
        "summary (2-3 sentences, lead with the single most important headline metric and its trend), "
        "trend ('up'|'down'|'flat'), "
        "insights (list of 3-5 specific observations with exact numbers and benchmark comparisons), "
        "health_indicator ('green'|'amber'|'red' — based on the benchmarks above)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        parsed = json.loads(strip_json_fences(raw))
        summary = parsed.get("summary", "Analysis complete.")
        trend = parsed.get("trend", "up")
        insights = parsed.get("insights", [])
        llm_health = parsed.get("health_indicator", health)
    except Exception:
        summary = raw[:400]
        trend = "up"
        insights = [raw[:200]]
        llm_health = health

    return MetricsAnalysisResponse(
        analysis=AnalysisSummary(
            summary=summary,
            trend=trend,
            anomalies=all_anomalies,
            insights=insights,
            health_indicator=llm_health,
        ),
        charts_data=charts,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
        data_points_analyzed=total_points,
        confidence_level=confidence_level,
    )


@router.post("/forecast", response_model=ForecastResponse, summary="Forecast a metric")
async def forecast(request: ForecastRequest) -> ForecastResponse:
    """Forecast future values for a given metric using Prophet or linear regression."""
    if settings.MOCK_MODE:
        base_date = datetime(2025, 4, 1)
        from datetime import timedelta
        forecast_pts = []
        base_val = 58000
        for i in range(min(request.horizon_days, 30)):
            val = base_val + (i * 850)
            forecast_pts.append({
                "date": (base_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "value": round(val, 2),
                "lower_bound": round(val * 0.92, 2),
                "upper_bound": round(val * 1.08, 2),
            })
        return ForecastResponse(
            forecast=forecast_pts,
            confidence=0.80,
            methodology="prophet",
            summary=f"Prophet model forecasts {request.metric_name} will grow to ${base_val + request.horizon_days * 850:,.0f} over {request.horizon_days} days (+{request.horizon_days * 850 / 58000 * 100:.1f}%).",
        )

    result = await forecast_metric(request.historical_data, request.horizon_days)
    return ForecastResponse(**result)


@router.post("/financial-analysis", response_model=FinancialAnalysisResponse, summary="Full financial analysis")
async def financial_analysis(request: FinancialAnalysisRequest) -> FinancialAnalysisResponse:
    """Compute comprehensive financial metrics and generate narrative."""
    if settings.MOCK_MODE:
        return FinancialAnalysisResponse(
            metrics={
                "mrr": 58000,
                "arr": 696000,
                "growth_rate": 0.197,
                "growth_rate_pct": 19.7,
                "churn_rate": 0.021,
                "churn_rate_pct": 2.1,
                "burn_rate": 38000,
                "net_burn": -20000,
                "runway_months": None,
                "is_profitable": True,
            },
            health_indicator="green",
            narrative=(
                "Veqiro AI is in strong financial health. MRR of $58,000 (ARR: $696K) grew 19.7% MoM, "
                "well above the 10% benchmark for early-stage SaaS. The business is cash-flow positive "
                "with net income of $20,000/month. Churn at 2.1% is below the 3% industry average. "
                "At current trajectory, the company will cross $1M ARR within 2-3 months."
            ),
            recommendations=[
                "Invest surplus cash flow into customer acquisition – CAC payback appears strong",
                "Monitor churn closely as expansion occurs; set up automated at-risk customer alerts",
                "Consider raising a seed round now while metrics are trending – strong narrative for investors",
            ],
        )

    derived = compute_derived_metrics(request.revenue_data, request.expenses_data, request.subscribers_data)
    health = compute_health_indicator(derived)
    total_points = len(request.revenue_data) + len(request.expenses_data) + len(request.subscribers_data)
    confidence_level = "high" if total_points >= 12 else "medium" if total_points >= 4 else "low"
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)

    prompt = (
        "You are Rex, a startup CFO. Provide a financial narrative and specific action items based on these computed metrics:\n"
        f"{json.dumps(derived, default=str)}\n\n"
        "Context:\n"
        f"- Health status: {health} (green=profitable/growing, amber=watch, red=critical)\n"
        "- SaaS benchmarks: MRR growth >10%/mo excellent; churn <2%/mo green; LTV:CAC >3x green\n\n"
        "Return a JSON object with:\n"
        "narrative (string, 2-4 sentences — lead with the single most impactful number, "
        "e.g. 'MRR of $58K grew 19.7% MoM...'; be direct, no consultant padding), "
        "recommendations (list of 3-5 specific actionable strings — each must reference a number from the metrics, "
        "e.g. 'With 2.1% churn, investigate why customers are leaving in months 4-6 before scaling past 300 customers')"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        parsed = json.loads(strip_json_fences(raw))
        narrative = parsed.get("narrative", raw[:600])
        recommendations = parsed.get("recommendations", [])
    except Exception:
        narrative = raw[:600]
        recommendations = []

    return FinancialAnalysisResponse(
        metrics=derived,
        health_indicator=health,
        narrative=narrative,
        recommendations=recommendations,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
        data_points_analyzed=total_points,
        confidence_level=confidence_level,
    )


@router.post("/compile-briefing", response_model=BriefingResponse, summary="Compile executive briefing")
async def compile_briefing(request: BriefingRequest) -> BriefingResponse:
    """Compile a cross-agent executive briefing."""
    if settings.MOCK_MODE:
        date = request.date or datetime.utcnow().strftime("%Y-%m-%d")
        return BriefingResponse(
            briefing={
                "date": date,
                "headline": "Strong week: MRR up 4.2%, 2 new enterprise leads, 3 content pieces published",
                "sections": {
                    "financial": {
                        "status": "green",
                        "summary": "MRR: $58,000 (+4.2% WoW). Burn on track. Runway: profitable.",
                        "key_actions": ["Review Q2 pricing strategy", "Approve enterprise contract terms"],
                    },
                    "marketing": {
                        "status": "green",
                        "summary": "3 LinkedIn posts published, best performing post: 847 impressions, 6.2% engagement",
                        "key_actions": ["Boost top-performing post with $200 budget", "Schedule 2 more posts this week"],
                    },
                    "operations": {
                        "status": "amber",
                        "summary": "12 unread emails, 2 require urgent reply. 3 meetings this week.",
                        "key_actions": ["Reply to investor inquiry (Sarah Chen) by EOD", "Prepare for Thursday board call"],
                    },
                },
                "generated_at": datetime.utcnow().isoformat(),
            }
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    context = f"Date: {request.date or datetime.utcnow().strftime('%Y-%m-%d')}\nMetrics: {json.dumps(request.all_metrics)}\nAgent summaries: {json.dumps(request.agent_summaries)}"
    prompt = (
        "Compile a concise executive briefing for a startup founder. Structure it clearly:\n"
        "1. HEADLINE: One sentence — the single most important thing this week\n"
        "2. FINANCIAL: MRR, runway, burn — what's the status? (green/amber/red)\n"
        "3. MARKETING: What content or campaigns are working?\n"
        "4. INTELLIGENCE: Any competitor or market moves to know?\n"
        "5. ACTIONS: 3 specific things the founder must do today\n\n"
        f"Context:\n{context}\n\n"
        "Return a JSON object with keys: date, headline, sections (dict with keys: financial, marketing, intelligence — "
        "each an object with status ('green'|'amber'|'red'), summary (string), key_actions (list of strings)), "
        "generated_at (ISO datetime)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        response_format={"type": "json_object"},
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        briefing_data = json.loads(strip_json_fences(raw))
    except Exception:
        briefing_data = {"narrative": raw, "generated_at": datetime.utcnow().isoformat()}
    return BriefingResponse(
        briefing=briefing_data,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


@router.post("/investor-update", response_model=InvestorUpdateResponse, summary="Generate investor update")
async def investor_update(request: InvestorUpdateRequest) -> InvestorUpdateResponse:
    """Generate a structured investor update with metrics, highlights, and asks."""
    if settings.MOCK_MODE:
        return InvestorUpdateResponse(
            subject_line=f"Veqiro AI — {request.period} Investor Update",
            executive_summary=(
                f"{request.period} was our strongest month to date: MRR hit $58K (up 19.7% MoM), "
                "we launched our enterprise tier, and initiated two Fortune 500 pilots. "
                "Churn remained below 2.5% and the business is now cash-flow positive."
            ),
            metrics_section=request.metrics or {
                "MRR": "$58,000 (+19.7% MoM)",
                "ARR": "$696,000",
                "Churn Rate": "2.1% (below 3% benchmark)",
                "Active Subscribers": "248 (+18 net new)",
                "Cash Position": "Profitable — $20K net income/month",
            },
            highlights_section=request.highlights or [
                "Crossed $58K MRR milestone",
                "Launched enterprise tier with custom SLAs",
                "Two Fortune 500 pilots initiated (details on request)",
                "Content team grew by 1 FTE",
            ],
            challenges_section=[
                "Enterprise sales cycle is longer than expected (60-90 days vs. 30)",
                "Onboarding friction identified at day-3 – UX fix in progress",
            ],
            asks_section=request.asks or [
                "Introductions to Series A firms with B2B SaaS focus",
                "Advice on enterprise pricing and packaging strategy",
            ],
            full_email_body=(
                f"Subject: Veqiro AI — {request.period} Investor Update\n\n"
                "Hi [Investor name],\n\nHope you're doing well! Here's our monthly update.\n\n"
                "**TL;DR:** $58K MRR (+19.7%), profitable, enterprise tier launched.\n\n"
                "**Metrics**\n- MRR: $58,000 (+19.7% MoM)\n- ARR: $696,000\n"
                "- Churn: 2.1%\n- Active Subscribers: 248\n\n"
                "**Highlights**\n- Crossed $58K MRR milestone\n"
                "- Launched enterprise tier with custom SLAs\n"
                "- Two Fortune 500 pilots underway\n\n"
                "**Challenges**\n- Enterprise sales cycle longer than expected\n"
                "- Onboarding friction at day-3 (fix shipping next week)\n\n"
                "**Where You Can Help**\n- Introductions to Series A firms\n"
                "- Enterprise pricing advice\n\nBest,\nFounder"
            ),
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    prompt = (
        f"Write a professional, direct investor update for {request.period}.\n\n"
        f"Metrics: {json.dumps(request.metrics)}\n"
        f"Highlights: {json.dumps(request.highlights)}\n"
        f"Asks: {json.dumps(request.asks)}\n\n"
        "Tone: confident, data-driven, concise (no fluffy language like 'excited to share'). "
        "Lead every section with numbers. Challenges should be honest — investors respect founders who know their risks.\n\n"
        "Return a JSON object with keys:\n"
        "subject_line (string — include the top metric, e.g. '$62K MRR — April 2026 Update'), "
        "executive_summary (string, 2-3 sentences — top metric + key win + one risk), "
        "metrics_section (dict with formatted strings, e.g. {'MRR': '$62,000 (+6.7% MoM)'}), "
        "highlights_section (list of strings), "
        "challenges_section (list of strings — be honest, 2-3 items), "
        "asks_section (list of strings), "
        "full_email_body (string — ready to send, proper email format with Subject, Hi [Name], body, Best/Founder)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        response_format={"type": "json_object"},
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = json.loads(strip_json_fences(raw))
        return InvestorUpdateResponse(**data, tokens_used=tokens_used, model_used=_agent.default_model)
    except Exception:
        return InvestorUpdateResponse(
            subject_line=f"Investor Update — {request.period}",
            executive_summary=raw[:400],
            metrics_section=request.metrics,
            highlights_section=request.highlights,
            challenges_section=[],
            asks_section=request.asks,
            full_email_body=raw,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )


@router.post("/runway", response_model=RunwayResponse, summary="Calculate cash runway with scenarios")
async def calculate_runway(request: RunwayRequest) -> RunwayResponse:
    """Calculate runway with base, optimistic, and pessimistic scenarios."""
    if settings.MOCK_MODE:
        return RunwayResponse(
            months_remaining=18.0,
            date_of_zero="2026-10-19",
            cash_on_hand=750000.0,
            monthly_burn=48000.0,
            monthly_revenue=62000.0,
            net_burn=-14000.0,
            scenarios=[
                {"name": "base", "months": 18, "date_of_zero": "2026-10-19", "assumption": "Current burn and 8% MoM revenue growth maintained"},
                {"name": "optimistic", "months": None, "date_of_zero": "profitable", "assumption": "Revenue growth accelerates to 18% MoM — profitable within 4 months"},
                {"name": "pessimistic", "months": 11, "date_of_zero": "2026-03-19", "assumption": "Burn increases 20% and revenue growth drops to 0% MoM"},
            ],
            verdict="green",
            recommendation="Healthy runway. Focus on growth milestones before your next raise.",
        )

    growth_rate = request.growth_rate_pct / 100.0
    result = compute_runway_scenarios(request.cash_on_hand, request.monthly_burn, request.monthly_revenue, growth_rate)
    asyncio.create_task(_agent.ingest_to_rag(
        user_id=request.user_id,
        text=json.dumps(result, default=str),
        source_id=f"rex-runway-{request.user_id}",
        metadata={"tool": "calculate_runway", "agent": "rex"},
    ))
    return RunwayResponse(**result)


@router.post("/unit-economics", response_model=UnitEconomicsResponse, summary="Compute CAC, LTV, and payback period")
async def unit_economics(request: UnitEconomicsRequest) -> UnitEconomicsResponse:
    """Calculate unit economics: CAC, LTV, LTV:CAC ratio, and payback period with benchmark context."""
    if settings.MOCK_MODE:
        return UnitEconomicsResponse(
            cac=340.28,
            ltv=4200.0,
            ltv_cac_ratio=12.34,
            payback_months=1.94,
            total_spend_analyzed=48000.0,
            total_new_customers_analyzed=141,
            arpu=175.0,
            lifetime_months=24.0,
            ltv_cac_health="green",
            payback_health="green",
            health="green",
            benchmark_context=(
                "LTV:CAC of 12.3x is exceptional (benchmark: >3x green). "
                "Payback period of 1.9 months is best-in-class (benchmark: <12 months green)."
            ),
            recommendations=[
                "LTV:CAC of 12.3x is strong — you can confidently scale acquisition spend",
                "Payback of 1.9 months is healthy — each acquired customer is in profit quickly",
                "Unit economics support aggressive growth — increase acquisition budget with confidence",
            ],
        )

    result = compute_unit_economics(
        request.marketing_spend,
        request.new_customers,
        request.avg_monthly_revenue_per_customer,
        request.avg_customer_lifetime_months,
    )
    if "error" in result:
        return UnitEconomicsResponse(
            cac=0, ltv=0, ltv_cac_ratio=0, payback_months=0,
            total_spend_analyzed=0, total_new_customers_analyzed=0,
            arpu=request.avg_monthly_revenue_per_customer,
            lifetime_months=request.avg_customer_lifetime_months,
            ltv_cac_health="red", payback_health="red", health="red",
            benchmark_context=result["error"], recommendations=[],
        )
    asyncio.create_task(_agent.ingest_to_rag(
        user_id=request.user_id,
        text=json.dumps(result, default=str),
        source_id=f"rex-unit-econ-{request.user_id}",
        metadata={"tool": "unit_economics", "agent": "rex"},
    ))
    return UnitEconomicsResponse(**result)


@router.post("/scenario", response_model=ScenarioResponse, summary="Model what-if financial scenarios")
async def scenario_model(request: ScenarioRequest) -> ScenarioResponse:
    """Model multiple what-if scenarios and compare each to the base case."""
    if settings.MOCK_MODE:
        return ScenarioResponse(
            base_case={"runway_months": 18, "date_of_zero": "2026-10-19", "arr_12mo": 1_526_400, "breakeven_month": None, "verdict": "green"},
            scenarios=[
                {"name": "Hire 2 engineers", "runway_months": 13, "date_of_zero": "2026-05-19", "arr_12mo": 1_526_400, "breakeven_month": None, "verdict": "amber", "vs_base": {"runway_delta": -5, "arr_delta": 0}},
                {"name": "Cut marketing 40%", "runway_months": 21, "date_of_zero": "2027-01-19", "arr_12mo": 1_128_300, "breakeven_month": None, "verdict": "green", "vs_base": {"runway_delta": 3, "arr_delta": -398100}},
            ],
            recommendation="Best scenario by runway: 'Cut marketing 40%' adds +3 months vs base case.",
        )

    base = request.base_metrics
    base_mrr = float(base.get("mrr", 0))
    base_burn = float(base.get("burn", 0))
    base_cash = float(base.get("cash", 0))
    base_growth = float(base.get("growth_rate", 0))

    def _arr_at_12mo(mrr_start: float, growth: float) -> float:
        m = mrr_start
        for _ in range(12):
            m *= (1 + growth)
        return round(m * 12, 2)

    def _breakeven_month(mrr_start: float, burn: float, growth: float):
        m = mrr_start
        for mo in range(1, 121):
            m *= (1 + growth)
            if m >= burn:
                return mo
        return None

    base_runway = compute_runway_scenarios(base_cash, base_burn, base_mrr, base_growth)
    base_runway_months = base_runway["months_remaining"] if base_runway["months_remaining"] is not None else 999
    base_arr_12 = _arr_at_12mo(base_mrr, base_growth)

    modeled = []
    for s in request.scenarios:
        changes = s.get("changes", {})
        s_burn = base_burn + float(changes.get("burn_delta", 0))
        s_mrr = base_mrr + float(changes.get("mrr_delta", 0))
        s_growth = float(changes.get("growth_rate_override", base_growth))
        s_runway = compute_runway_scenarios(base_cash, s_burn, s_mrr, s_growth)
        s_months = s_runway["months_remaining"] if s_runway["months_remaining"] is not None else 999
        s_arr_12 = _arr_at_12mo(s_mrr, s_growth)
        modeled.append({
            "name": s.get("name", "Unnamed"),
            "runway_months": s_runway["months_remaining"],
            "date_of_zero": s_runway["date_of_zero"],
            "arr_12mo": s_arr_12,
            "breakeven_month": _breakeven_month(s_mrr, s_burn, s_growth),
            "verdict": s_runway["verdict"],
            "vs_base": {
                "runway_delta": (s_months - base_runway_months) if s_months < 999 and base_runway_months < 999 else None,
                "arr_delta": round(s_arr_12 - base_arr_12, 2),
            },
        })

    best = max(modeled, key=lambda x: x["runway_months"] if x["runway_months"] is not None else 999, default=None)
    return ScenarioResponse(
        base_case={
            "runway_months": base_runway["months_remaining"],
            "date_of_zero": base_runway["date_of_zero"],
            "arr_12mo": base_arr_12,
            "breakeven_month": _breakeven_month(base_mrr, base_burn, base_growth),
            "verdict": base_runway["verdict"],
        },
        scenarios=modeled,
        recommendation=(
            f"Best scenario by runway: '{best['name']}' — "
            f"runway delta: {(best['vs_base'].get('runway_delta') or 0):+.0f} months."
            if best else "No scenarios provided."
        ),
    )


@router.post("/weekly-digest", response_model=WeeklyDigestResponse, summary="Generate Monday CFO digest")
async def weekly_digest(request: WeeklyDigestRequest) -> WeeklyDigestResponse:
    """Generate a structured weekly CFO digest with WoW changes, alerts, and 3 focus actions."""
    if settings.MOCK_MODE:
        return WeeklyDigestResponse(
            period="Week of Apr 14 2026",
            headline="MRR hit $62,000 — up 6.7% WoW, on track for $1M ARR by July",
            wow_changes=[
                {"metric": "MRR", "current": 62000, "previous": 58100, "change_pct": 6.71, "direction": "up"},
                {"metric": "Cash", "current": 750000, "previous": 798000, "change_pct": -6.02, "direction": "down"},
                {"metric": "New Customers", "current": 42, "previous": 38, "change_pct": 10.53, "direction": "up"},
                {"metric": "Churn Rate", "current": 2.1, "previous": 2.2, "change_pct": -4.55, "direction": "down"},
                {"metric": "CAC", "current": 340, "previous": 358, "change_pct": -5.03, "direction": "down"},
            ],
            alerts=[
                {"severity": "medium", "message": "Cash dropped $48K this week — review burn before authorising new spend"},
                {"severity": "low", "message": "Churn rate at 2.1% — monitor closely as you scale past 250 customers"},
            ],
            green_flags=[
                {"message": "CAC decreased 5% WoW — marketing efficiency improving"},
                {"message": "Churn rate fell to 2.1% — below 2.5% best-in-class threshold"},
                {"message": "10.5% WoW new customer growth with no burn increase"},
            ],
            focus_this_week=[
                "Audit the $48K cash draw — identify the largest single expense and evaluate if it recurs",
                "Double down on the top-performing acquisition channel before end of quarter",
                "Schedule 30-min churn retrospective to understand why churned customers left",
            ],
            generated_at=datetime.utcnow().isoformat(),
        )

    metrics_count = len(request.metrics)
    has_prev = bool(request.prev_week)
    confidence_level = "high" if metrics_count >= 6 and has_prev else "medium" if metrics_count >= 3 else "low"

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    period_str = datetime.utcnow().strftime("Week of %b %d %Y")
    prompt = (
        f"You are Rex, the CFO analyst. Generate a Monday morning digest for a startup founder.\n\n"
        f"Current metrics: {json.dumps(request.metrics, default=str)}\n"
        f"Previous period: {json.dumps(request.prev_week, default=str)}\n\n"
        "Rules:\n"
        "- Headline: single sentence with the #1 metric change this week (must include a number)\n"
        "- WoW changes: calculate change_pct as ((current-previous)/previous)*100; direction 'up'/'down'/'flat'\n"
        "- Alerts: severity 'high'/'medium'/'low'; flag if churn >3%, runway <6mo, cash dropped >15%, burn spike\n"
        "- Green flags: celebrate wins (MRR growth, churn drop, CAC improvement)\n"
        "- Focus: exactly 3 specific action items for this week — each must be concrete, with a verb and a number\n\n"
        "Return a JSON object with:\n"
        f"period (string, use '{period_str}'), "
        "headline (string), "
        "wow_changes (array of {metric, current, previous, change_pct, direction}), "
        "alerts (array of {severity, message}), "
        "green_flags (array of {message}), "
        "focus_this_week (array of exactly 3 action strings), "
        f"generated_at (string, use '{datetime.utcnow().isoformat()}')"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        response_format={"type": "json_object"},
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = safe_json_loads(raw)
    except Exception:
        data = {
            "period": period_str,
            "headline": raw[:200],
            "wow_changes": [],
            "alerts": [],
            "green_flags": [],
            "focus_this_week": ["Review metrics manually"],
            "generated_at": datetime.utcnow().isoformat(),
        }

    asyncio.create_task(_agent.ingest_to_rag(
        user_id=request.user_id,
        text=json.dumps(data, default=str),
        source_id=f"rex-weekly-digest-{request.user_id}",
        metadata={"tool": "weekly_digest", "agent": "rex", "priority": "high"},
    ))
    return WeeklyDigestResponse(
        **data,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
        confidence_level=confidence_level,
        metrics_count=metrics_count,
    )


# ── Variance (C9) ───────────────────────────────────────────────────────────

class VarianceRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    metric: str
    period: str = "monthly"
    actual_data: list[DataPoint]
    budget_data: list[DataPoint]


class VarianceRow(BaseModel):
    date: str
    actual: float
    budget: float
    variance: float
    variance_pct: float
    direction: str  # "over" | "under" | "on_track"


class VarianceResponse(BaseModel):
    metric: str
    period: str
    rows: list[VarianceRow]
    total_actual: float
    total_budget: float
    total_variance_pct: float
    headline: str
    narrative: str
    tokens_used: int = 0
    model_used: str = ""


@router.post("/variance", response_model=VarianceResponse, summary="Actual vs budget variance")
async def variance_analysis(request: VarianceRequest) -> VarianceResponse:
    """Compute monthly variance between actual and budget datasets, then have the LLM narrate."""
    by_date: dict[str, dict[str, float]] = {}
    for dp in request.actual_data:
        by_date.setdefault(dp.date, {})["actual"] = dp.value
    for dp in request.budget_data:
        by_date.setdefault(dp.date, {})["budget"] = dp.value

    rows: list[VarianceRow] = []
    total_actual = 0.0
    total_budget = 0.0
    for date in sorted(by_date.keys()):
        actual = float(by_date[date].get("actual", 0))
        budget = float(by_date[date].get("budget", 0))
        if budget == 0 and actual == 0:
            continue
        variance = actual - budget
        variance_pct = (variance / budget * 100) if budget != 0 else 0.0
        if abs(variance_pct) <= 10:
            direction = "on_track"
        elif variance_pct > 0:
            direction = "over"
        else:
            direction = "under"
        rows.append(VarianceRow(
            date=date, actual=round(actual, 2), budget=round(budget, 2),
            variance=round(variance, 2), variance_pct=round(variance_pct, 2),
            direction=direction,
        ))
        total_actual += actual
        total_budget += budget

    total_variance_pct = ((total_actual - total_budget) / total_budget * 100) if total_budget != 0 else 0.0

    if settings.MOCK_MODE:
        return VarianceResponse(
            metric=request.metric, period=request.period, rows=rows,
            total_actual=round(total_actual, 2), total_budget=round(total_budget, 2),
            total_variance_pct=round(total_variance_pct, 2),
            headline=f"{request.metric} came in {abs(total_variance_pct):.1f}% {'over' if total_variance_pct > 0 else 'under'} budget",
            narrative=f"Across {len(rows)} periods, {request.metric} totaled ${total_actual:,.0f} actual vs ${total_budget:,.0f} budgeted.",
        )

    # Build an LLM narrative
    notable = [r for r in rows if abs(r.variance_pct) > 10]
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    prompt = (
        f"You are Rex, the CFO. Generate a budget variance narrative for {request.metric} ({request.period}).\n\n"
        f"Total actual: ${total_actual:,.2f}\n"
        f"Total budget: ${total_budget:,.2f}\n"
        f"Total variance: {total_variance_pct:.1f}%\n\n"
        f"Notable monthly variances (>10%): {json.dumps([r.model_dump() for r in notable], default=str)}\n\n"
        "Return a JSON object with keys:\n"
        "headline (string — single sentence with a number, e.g. 'Marketing came in 12% over budget driven by Q2 campaign'), "
        "narrative (string — 2-4 sentences explaining the largest variances and their likely causes)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
        temperature=0.4, response_format={"type": "json_object"},
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        parsed = json.loads(strip_json_fences(raw))
        headline = parsed.get("headline", f"{request.metric} variance computed")
        narrative = parsed.get("narrative", raw[:600])
    except Exception:
        headline = f"{request.metric} variance computed"
        narrative = raw[:600]

    return VarianceResponse(
        metric=request.metric, period=request.period, rows=rows,
        total_actual=round(total_actual, 2), total_budget=round(total_budget, 2),
        total_variance_pct=round(total_variance_pct, 2),
        headline=headline, narrative=narrative,
        tokens_used=tokens_used, model_used=_agent.default_model,
    )


# ── Board deck (C5) ─────────────────────────────────────────────────────────

class BoardDeckRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    period: str
    metrics: dict = {}
    highlights: list[str] = []
    risks: list[str] = []
    ask: str = ""


class BoardDeckSections(BaseModel):
    company_overview: str
    financial_health: str
    metrics_analysis: str
    risks_mitigations: str
    key_ask: str


class BoardDeckResponse(BaseModel):
    period: str
    headline: str
    sections: BoardDeckSections
    html: str
    tokens_used: int = 0
    model_used: str = ""


def _render_board_html(period: str, headline: str, sections: BoardDeckSections, metrics: dict) -> str:
    metric_rows = "".join(
        f"<tr><td style='padding:6px 12px;border-bottom:1px solid #eee;font-weight:500;'>{k}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-family:monospace'>{v}</td></tr>"
        for k, v in (metrics or {}).items()
    )
    sec = lambda title, body: (
        f"<section style='margin:20px 0;page-break-inside:avoid;'>"
        f"<h2 style='font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#666;border-bottom:2px solid #111;padding-bottom:4px;margin:0 0 10px 0;'>{title}</h2>"
        f"<div style='font-size:14px;line-height:1.6;color:#222;white-space:pre-wrap;'>{body}</div>"
        f"</section>"
    )
    return (
        f"<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>Board Deck — {period}</title>"
        f"<style>@page{{margin:24mm}} body{{font-family:system-ui,-apple-system,sans-serif;color:#111;max-width:780px;margin:0 auto;padding:24px;}}"
        f"h1{{font-size:32px;margin:0 0 4px 0;}}@media print{{body{{padding:0;}}}}</style></head><body>"
        f"<header style='border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:24px;'>"
        f"<div style='font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#666;'>Board update — {period}</div>"
        f"<h1>{headline}</h1>"
        f"</header>"
        f"{sec('Company overview', sections.company_overview)}"
        f"{sec('Financial health', sections.financial_health)}"
        f"{('<section style=\"margin:20px 0;\"><h2 style=\"font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#666;border-bottom:2px solid #111;padding-bottom:4px;margin:0 0 10px 0;\">Metrics</h2><table style=\"width:100%;border-collapse:collapse;font-size:14px;\">' + metric_rows + '</table></section>') if metric_rows else ''}"
        f"{sec('Metrics analysis', sections.metrics_analysis)}"
        f"{sec('Risks & mitigations', sections.risks_mitigations)}"
        f"{sec('Key ask', sections.key_ask)}"
        f"<footer style='margin-top:32px;font-family:monospace;font-size:10px;color:#888;text-align:center;'>Generated by REX · {datetime.utcnow().strftime('%Y-%m-%d')}</footer>"
        f"</body></html>"
    )


@router.post("/board-deck", response_model=BoardDeckResponse, summary="Auto-generate board deck content")
async def board_deck(request: BoardDeckRequest) -> BoardDeckResponse:
    """Generate a structured board update with 5 sections + print-friendly HTML."""
    if settings.MOCK_MODE:
        sections = BoardDeckSections(
            company_overview=f"For {request.period}, the team continued executing on the core SaaS roadmap.",
            financial_health="MRR $62K (+6.7% MoM), runway 18 months, profitable.",
            metrics_analysis="Strong growth with healthy LTV:CAC of 12x, churn at 2.1% (below benchmark).",
            risks_mitigations="Enterprise sales cycle longer than expected — pipeline coverage 3x.",
            key_ask=request.ask or "Introductions to enterprise CISOs at the Fortune 500 level.",
        )
        headline = f"{request.period}: $62K MRR (+6.7%), 18mo runway, 2 enterprise pilots"
        html = _render_board_html(request.period, headline, sections, request.metrics)
        return BoardDeckResponse(period=request.period, headline=headline, sections=sections, html=html)

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    prompt = (
        f"Compose a structured board update for the period: {request.period}.\n\n"
        f"Metrics: {json.dumps(request.metrics, default=str)}\n"
        f"Highlights: {json.dumps(request.highlights)}\n"
        f"Risks: {json.dumps(request.risks)}\n"
        f"Ask: {request.ask}\n\n"
        "Tone: data-driven, honest, concise. Lead each section with the most important number or fact.\n"
        "Return a JSON object with keys:\n"
        "headline (string — one-sentence bullet with the top metric and outcome), "
        "company_overview (string, 2-3 sentences — what the company built/shipped/sold), "
        "financial_health (string, 2-3 sentences — MRR/burn/runway with numbers), "
        "metrics_analysis (string, 3-5 sentences — growth, churn, unit econ, what's working), "
        "risks_mitigations (string, 2-4 sentences — top 2 risks and what's being done), "
        "key_ask (string, 1-2 sentences — single specific ask)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
        temperature=0.4, response_format={"type": "json_object"},
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        parsed = json.loads(strip_json_fences(raw))
        headline = parsed.get("headline", f"Board update — {request.period}")
        sections = BoardDeckSections(
            company_overview=parsed.get("company_overview", ""),
            financial_health=parsed.get("financial_health", ""),
            metrics_analysis=parsed.get("metrics_analysis", ""),
            risks_mitigations=parsed.get("risks_mitigations", ""),
            key_ask=parsed.get("key_ask", request.ask),
        )
    except Exception:
        headline = f"Board update — {request.period}"
        sections = BoardDeckSections(
            company_overview=raw[:300], financial_health="", metrics_analysis="",
            risks_mitigations="", key_ask=request.ask,
        )

    html = _render_board_html(request.period, headline, sections, request.metrics)
    return BoardDeckResponse(
        period=request.period, headline=headline, sections=sections, html=html,
        tokens_used=tokens_used, model_used=_agent.default_model,
    )

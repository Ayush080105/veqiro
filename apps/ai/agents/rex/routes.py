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
from agents.rex.analytics import compute_anomalies, compute_health_indicator, compute_derived_metrics
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


class ForecastRequest(BaseModel):
    user_id: str
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


class FinancialAnalysisRequest(BaseModel):
    user_id: str
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


class BriefingRequest(BaseModel):
    user_id: str
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


class InvestorUpdateRequest(BaseModel):
    user_id: str
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

    all_anomalies = []
    charts = {}
    health_inputs: dict = {}

    for metric_name, data_points in request.metrics.items():
        anomalies = compute_anomalies(data_points)
        all_anomalies.extend(anomalies)
        charts[metric_name] = [{"date": dp.date, "value": dp.value} for dp in data_points]

        # Derive real health inputs from actual data
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

    health = compute_health_indicator({
        "churn_rate": health_inputs.get("churn_rate", 0.0),
        "growth_rate": health_inputs.get("growth_rate", 0.0),
    })

    system = await _agent.build_system_prompt(request.user_id)
    metrics_summary = json.dumps({k: [{"date": d.date, "value": d.value} for d in v] for k, v in request.metrics.items()})
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Analyze these metrics:\n{metrics_summary}"}],
    )
    return MetricsAnalysisResponse(
        analysis=AnalysisSummary(
            summary=raw[:500],
            trend="up",
            anomalies=all_anomalies,
            insights=[raw],
            health_indicator=health,
        ),
        charts_data=charts,
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
    system = await _agent.build_system_prompt(request.user_id)

    prompt = (
        f"Provide financial narrative and recommendations for these metrics:\n{json.dumps(derived, default=str)}\n\n"
        "Return ONLY a JSON object (no markdown fences) with keys: "
        "narrative (string, 2-4 sentences), recommendations (list of 3-5 specific actionable strings)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
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

    system = await _agent.build_system_prompt(request.user_id)
    context = f"Date: {request.date}\nMetrics: {json.dumps(request.all_metrics)}\nAgent summaries: {json.dumps(request.agent_summaries)}"
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Compile an executive briefing:\n{context}"}],
    )
    return BriefingResponse(briefing={"narrative": raw, "generated_at": datetime.utcnow().isoformat()})


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

    system = await _agent.build_system_prompt(request.user_id)
    prompt = (
        f"Write a professional investor update for {request.period}.\n\n"
        f"Metrics: {json.dumps(request.metrics)}\n"
        f"Highlights: {json.dumps(request.highlights)}\n"
        f"Asks: {json.dumps(request.asks)}\n\n"
        "Return ONLY a JSON object (no markdown fences) with keys: subject_line, executive_summary, "
        "metrics_section (dict), highlights_section (list), challenges_section (list), "
        "asks_section (list), full_email_body (string)"
    )
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system, messages=[{"role": "user", "content": prompt}],
    )
    try:
        data = json.loads(strip_json_fences(raw))
        return InvestorUpdateResponse(**data)
    except Exception:
        return InvestorUpdateResponse(
            subject_line=f"Investor Update — {request.period}",
            executive_summary=raw[:400],
            metrics_section=request.metrics,
            highlights_section=request.highlights,
            challenges_section=[],
            asks_section=request.asks,
            full_email_body=raw,
        )

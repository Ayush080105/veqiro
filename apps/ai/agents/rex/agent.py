import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.tools import ToolDefinition, ToolParameter


class RexAgent(BaseAgent):
    slug = "rex"
    name = "Rex"
    personality = (
        "Sharp, data-driven financial analyst and business intelligence expert. "
        "You transform raw metrics into clear insights and actionable recommendations. "
        "You love finding patterns in data, spotting anomalies, and building forecasts "
        "that founders can actually use to make better decisions. You communicate complex "
        "financial data in plain English without dumbing it down."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        base = await super().build_system_prompt(user_id, extra_context)
        rex_specific = (
            "\n\nAs Rex, you specialize in:\n"
            "- SaaS metrics: MRR, ARR, churn, LTV, CAC, NRR\n"
            "- Financial analysis: P&L, burn rate, runway, unit economics\n"
            "- Trend detection and anomaly identification\n"
            "- Revenue forecasting with confidence intervals\n"
            "- Weekly/monthly executive briefings\n\n"
            "Analysis principles:\n"
            "1. Lead with the headline number and trend direction\n"
            "2. Always contextualize against benchmarks\n"
            "3. Flag anomalies immediately with severity level\n"
            "4. End with 2-3 specific, actionable next steps\n"
            "5. Use RAG/amber/red health indicators\n"
        )
        return base + rex_specific

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="analyze_metrics",
                description="Analyze business metrics with anomaly detection and health indicators. Provide metric data as JSON and get back trends, anomalies, and actionable insights.",
                parameters=[
                    ToolParameter(name="metrics_json", type="string", description="JSON string of metrics data, e.g. {\"revenue\": [{\"date\": \"2025-01-01\", \"value\": 42000}]}", required=True),
                    ToolParameter(name="period", type="string", description="Analysis period (daily, weekly, monthly)", required=False, default="monthly"),
                ],
            ),
            ToolDefinition(
                name="forecast_metric",
                description="Forecast future values for a business metric using time-series analysis (Prophet or linear regression).",
                parameters=[
                    ToolParameter(name="metric_name", type="string", description="Name of the metric to forecast (e.g., mrr, revenue, subscribers)", required=True),
                    ToolParameter(name="historical_json", type="string", description="JSON array of historical data points [{\"date\": \"...\", \"value\": ...}]", required=True),
                    ToolParameter(name="horizon_days", type="integer", description="Number of days to forecast ahead", required=False, default=30),
                ],
            ),
            ToolDefinition(
                name="financial_analysis",
                description="Compute comprehensive financial health metrics (MRR, ARR, growth rate, churn, burn rate, runway) and generate narrative with recommendations.",
                parameters=[
                    ToolParameter(name="revenue_json", type="string", description="JSON array of revenue data points [{\"date\": \"...\", \"value\": ...}]", required=True),
                    ToolParameter(name="expenses_json", type="string", description="JSON array of expense data points", required=False, default="[]"),
                    ToolParameter(name="subscribers_json", type="string", description="JSON array of subscriber data points", required=False, default="[]"),
                ],
            ),
            ToolDefinition(
                name="compile_briefing",
                description="Compile a cross-agent executive briefing combining financial, marketing, and operational summaries.",
                parameters=[
                    ToolParameter(name="date", type="string", description="Date for the briefing (YYYY-MM-DD)", required=False),
                    ToolParameter(name="metrics_json", type="string", description="JSON of key metrics", required=False, default="{}"),
                    ToolParameter(name="agent_summaries_json", type="string", description="JSON of summaries from other agents", required=False, default="{}"),
                ],
            ),
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(self, name: str, arguments: dict, user_id: str) -> str:
        from agents.rex.analytics import compute_anomalies, compute_health_indicator, compute_derived_metrics
        from agents.rex.forecasting import forecast_metric
        from core.models import DataPoint

        system = await self.build_system_prompt(user_id)

        if name == "analyze_metrics":
            try:
                metrics_raw = json.loads(arguments.get("metrics_json", "{}"))
            except Exception:
                metrics_raw = {}
            period = arguments.get("period", "monthly")

            all_anomalies = []
            charts = {}
            for metric_name, data_points in metrics_raw.items():
                dps = [DataPoint(**dp) for dp in data_points]
                anomalies = compute_anomalies(dps)
                all_anomalies.extend(anomalies)
                charts[metric_name] = data_points

            health = compute_health_indicator({"churn_rate": 0.02, "growth_rate": 0.1})
            metrics_summary = json.dumps(metrics_raw)
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": f"Analyze these {period} metrics and provide insights:\n{metrics_summary}"}],
            )
            result = {
                "analysis": raw,
                "anomalies": all_anomalies,
                "health_indicator": health,
                "charts_data": charts,
            }
            return json.dumps(result, default=str)

        elif name == "forecast_metric":
            metric_name = arguments.get("metric_name", "mrr")
            horizon = arguments.get("horizon_days", 30)
            try:
                hist_raw = json.loads(arguments.get("historical_json", "[]"))
                historical = [DataPoint(**dp) for dp in hist_raw]
            except Exception:
                historical = []

            if historical:
                result = await forecast_metric(historical, horizon)
                return json.dumps(result, default=str)
            return json.dumps({"error": "No historical data provided for forecasting"})

        elif name == "financial_analysis":
            try:
                rev = json.loads(arguments.get("revenue_json", "[]"))
                exp = json.loads(arguments.get("expenses_json", "[]"))
                subs = json.loads(arguments.get("subscribers_json", "[]"))
            except Exception:
                rev, exp, subs = [], [], []

            revenue_data = [DataPoint(**dp) for dp in rev]
            expenses_data = [DataPoint(**dp) for dp in exp]
            subscribers_data = [DataPoint(**dp) for dp in subs]

            derived = compute_derived_metrics(revenue_data, expenses_data, subscribers_data)
            health = compute_health_indicator(derived)

            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": f"Provide financial narrative and recommendations for: {json.dumps(derived, default=str)}"}],
            )
            result = {
                "metrics": derived,
                "health_indicator": health,
                "narrative": raw,
            }
            return json.dumps(result, default=str)

        elif name == "compile_briefing":
            from datetime import datetime
            date = arguments.get("date", "") or datetime.utcnow().strftime("%Y-%m-%d")
            try:
                metrics = json.loads(arguments.get("metrics_json", "{}"))
                summaries = json.loads(arguments.get("agent_summaries_json", "{}"))
            except Exception:
                metrics, summaries = {}, {}

            context = f"Date: {date}\nMetrics: {json.dumps(metrics)}\nAgent summaries: {json.dumps(summaries)}"
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": f"Compile an executive briefing:\n{context}"}],
            )
            return raw

        raise ValueError(f"Unknown tool: {name}")

import asyncio
import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter
from core.utils import downsample_points


class RexAgent(BaseAgent):
    slug = "rex"
    name = "Rex"
    personality = (
        "the enthusiastic financial analyst on the team who genuinely loves what numbers reveal. "
        "You bring real energy and warmth to financial conversations — celebrating wins, tackling tough numbers "
        "with optimism, and making founders feel confident about their business. You're direct and clear, "
        "leading with the headline figure, but you're never cold or intimidating. "
        "You're the kind of CFO who gets excited when the metrics look good and rallies the team when they don't."
    )
    default_provider = "openai"
    default_model = "gpt-4.1-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    # ── Tool-use instructions ────────────────────────────────────────────

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## CRITICAL: No Fabrication Rule\n"
            "NEVER invent, assume, estimate, or hallucinate financial numbers. "
            "If the user has not explicitly provided data in this conversation, you do NOT have their numbers. "
            "Responding with made-up MRR, ARR, churn, or any metric is strictly forbidden — "
            "it is worse than saying 'I don't have that data yet.'\n\n"
            "## Tool Usage Rules\n"
            "Only call tools when the user has provided the actual data values in this conversation.\n"
            "- User provides revenue/MRR data as numbers or JSON → call `analyze_metrics` or `financial_analysis`\n"
            "- User provides historical data series → call `forecast_metric`\n"
            "- User provides cash + burn figures → call `calculate_runway`\n"
            "- User provides marketing spend + customer data → call `unit_economics`\n"
            "- User provides base metrics for modeling → call `scenario_model`\n"
            "- User provides current metrics for a digest → call `weekly_digest`\n"
            "- User asks for an investor update and provides metrics → call `generate_investor_update`\n"
            "- User asks for an executive briefing → call `compile_briefing`\n\n"
            "## When the user asks but provides NO data\n"
            "Ask them to share the numbers directly in chat (e.g., 'What was your MRR last month?', "
            "'Share your revenue data and I'll run the analysis.'). "
            "Do not call any tool with made-up values.\n\n"
            "## When to use ask_agent\n"
            "- User wants a social post about financial results → call `ask_agent` with maya (include the real numbers).\n"
            "- User needs an SEO article about their growth story → call `ask_agent` with sage.\n"
            "- User asks about compliance of a financial document → call `ask_agent` with lex.\n"
            "Note: `compile_briefing` already auto-fetches from maya and scout — use it for full executive briefings."
        )

    # ── System prompt ────────────────────────────────────────────────────

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
        use_brand_kit: bool = True,
        has_history: bool = False,
    ) -> str:
        base = await super().build_system_prompt(user_id, organization_id, extra_context, has_history=has_history)

        client_ctx = ""
        if use_brand_kit:
            from core.brand_kit import load_brand_kit, get_site_context_block
            brand_kit = await load_brand_kit(organization_id)
            client_ctx = "\n\n## Client Context\n"
            client_ctx += f"Company: **{brand_kit.company_name}**\n"
            if brand_kit.industry:
                client_ctx += f"Industry: {brand_kit.industry}\n"
            if brand_kit.value_proposition:
                client_ctx += f"Value Proposition: {brand_kit.value_proposition}\n"
            if brand_kit.website_url:
                client_ctx += f"Website: {brand_kit.website_url}\n"
            if brand_kit.competitors:
                client_ctx += f"Competitors: {', '.join(str(c) for c in brand_kit.competitors)}\n"
            site_block = get_site_context_block(brand_kit)
            if site_block:
                client_ctx += "\n" + site_block + "\n"

        rex_specific = (
            "\n\nAs Rex, you specialize in:\n"
            "- SaaS metrics: MRR, ARR, churn, LTV, CAC, NRR\n"
            "- Financial analysis: P&L, burn rate, runway, unit economics\n"
            "- Trend detection and anomaly identification\n"
            "- Revenue forecasting with confidence intervals\n"
            "- Weekly/monthly executive briefings\n\n"
            "Analysis principles (only apply when you have REAL data from the user):\n"
            "1. Lead with the headline number and trend direction — ONLY when you have verified data\n"
            "2. Contextualize against benchmarks\n"
            "3. Flag anomalies immediately with severity level\n"
            "4. End with 2-3 specific, actionable next steps\n"
            "5. Use green/amber/red health indicators\n\n"
            "ABSOLUTE RULE: Never invent financial figures under any circumstances.\n"
            "- Greetings, thanks, 'nice', 'got it', small talk → respond warmly in plain text, no tools.\n"
            "- If the user asks a general question → answer conversationally.\n"
            "- Only ask for data when the user asks a specific financial question and hasn't provided numbers yet.\n"
            "\n## Conversational Style\n"
            "You're a real finance partner who genuinely cares, not a calculator with a chat window. "
            "When someone says hi, thanks, 'nice', 'great', 'got it', or anything casual — "
            "respond warmly and briefly in plain text. No tools, no charts. Just a real, human reply.\n"
        )
        _greeting = (
            "When greeting at the start of a conversation: be warm and enthusiastic — you love numbers "
            "and love helping founders understand their business. "
            "Never say 'How can I assist you today?' — sound like a real teammate.\n"
            if not has_history else
            self._mid_conversation_ack_block()
        )
        rex_specific += _greeting + (
            "\n## Your Domain\n"
            "Financial analytics, MRR/ARR/churn/LTV/CAC, burn rate, runway, unit economics, "
            "revenue forecasting, scenario modeling, investor updates, weekly business digests.\n"
            "\n## When to Redirect — Never Guess Outside Your Lane\n"
            "- Social media posts, content drafting, image generation → "
            "'Maya handles content and social media. Head to Maya's chat.'\n"
            "- SEO, keyword research, blog writing → "
            "'Sage is your SEO and content strategist. Ask Sage.'\n"
            "- Competitive research, market analysis, company profiling → "
            "'Scout researches markets and competitors. Ask Scout.'\n"
            "- Contracts, legal compliance, regulatory questions → "
            "'Lex handles legal matters. Take that to Lex.'\n"
            "- Email management, calendar, scheduling → "
            "'Vega manages your inbox and calendar. That's Vega's domain.'\n"
        )
        return base + client_ctx + rex_specific

    # ── Chat override: RAG ingest for key analyses ───────────────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        response = await super().chat_sync(request)

        tool_calls = response.metadata.get("tool_calls", [])
        for tc in tool_calls:
            if tc["name"] in {
                "compile_briefing", "financial_analysis", "generate_investor_update",
                "calculate_runway", "unit_economics", "scenario_model", "weekly_digest",
            }:
                self._fire_rag_ingest(
                    user_id=request.user_id,
                    text=response.response,
                    source_id=f"rex-{tc['name']}-{request.conversation_id}",
                    metadata={"tool": tc["name"], "agent": "rex"},
                )

        return response

    # ── Tool Definitions ─────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="analyze_metrics",
                description="Analyze business metrics with anomaly detection and health indicators. Provide metric data as JSON and get back trends, anomalies, and actionable insights.",
                parameters=[
                    ToolParameter(name="metrics_json", type="string", description='JSON string of metrics from the user, e.g. {"revenue": [{"date": "YYYY-MM-DD", "value": <user_value>}]}. ONLY use values the user has provided.', required=True),
                    ToolParameter(name="period", type="string", description="Analysis period (daily, weekly, monthly)", required=False, default="monthly"),
                ],
            ),
            ToolDefinition(
                name="forecast_metric",
                description="Forecast future values for a business metric using time-series analysis (Prophet or linear regression).",
                parameters=[
                    ToolParameter(name="metric_name", type="string", description="Name of the metric to forecast (e.g., mrr, revenue, subscribers)", required=True),
                    ToolParameter(name="historical_json", type="string", description='JSON array of historical data points the user provided: [{"date": "YYYY-MM-DD", "value": <user_value>}]', required=True),
                    ToolParameter(name="horizon_days", type="integer", description="Number of days to forecast ahead", required=False, default=30),
                ],
            ),
            ToolDefinition(
                name="financial_analysis",
                description="Compute comprehensive financial health metrics (MRR, ARR, growth rate, churn, burn rate, runway) and generate narrative with recommendations.",
                parameters=[
                    ToolParameter(name="revenue_json", type="string", description='JSON array of revenue data points the user provided: [{"date": "YYYY-MM-DD", "value": <user_value>}]', required=True),
                    ToolParameter(name="expenses_json", type="string", description='JSON array of expense data points the user provided', required=False, default="[]"),
                    ToolParameter(name="subscribers_json", type="string", description='JSON array of subscriber data points the user provided', required=False, default="[]"),
                ],
            ),
            ToolDefinition(
                name="compile_briefing",
                description="Compile a cross-agent executive briefing combining financial, marketing, and operational summaries.",
                parameters=[
                    ToolParameter(name="date", type="string", description="Date for the briefing (YYYY-MM-DD)", required=False),
                    ToolParameter(name="metrics_json", type="string", description="JSON of key metrics the user has provided in this conversation", required=False, default="{}"),
                    ToolParameter(name="agent_summaries_json", type="string", description="JSON of summaries from other agents", required=False, default="{}"),
                ],
            ),
            ToolDefinition(
                name="generate_investor_update",
                description="Generate a structured investor update email/report with MRR, ARR, growth metrics, key milestones, and forward-looking narrative. Used for monthly or quarterly investor communications.",
                parameters=[
                    ToolParameter(name="period", type="string", description="Reporting period (e.g., 'March 2025', 'Q1 2025')", required=True),
                    ToolParameter(name="metrics_json", type="string", description="JSON of current period metrics the user has provided (mrr, arr, growth_rate, churn_rate, etc.)", required=False, default="{}"),
                    ToolParameter(name="highlights", type="array", description="Key wins and milestones to highlight", required=False, items_type="string"),
                    ToolParameter(name="asks", type="array", description="Specific asks or areas where investors can help", required=False, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="calculate_runway",
                description="Calculate cash runway with base, optimistic, and pessimistic scenarios. Returns months remaining, date of zero cash, and a green/amber/red verdict. Use when the founder asks about runway, cash, or 'how long do we have'.",
                parameters=[
                    ToolParameter(name="cash_on_hand", type="number", description="Current cash balance in dollars — must come from the user", required=True),
                    ToolParameter(name="monthly_burn", type="number", description="Total monthly cash outflows in dollars — must come from the user", required=True),
                    ToolParameter(name="monthly_revenue", type="number", description="Current MRR in dollars — must come from the user", required=False, default=0.0),
                    ToolParameter(name="growth_rate_pct", type="number", description="Monthly revenue growth rate as a percentage — must come from the user", required=False, default=0.0),
                ],
            ),
            ToolDefinition(
                name="unit_economics",
                description="Compute CAC, LTV, LTV:CAC ratio, and payback period from marketing spend and customer acquisition data. Benchmarks included: LTV:CAC >3x is green, payback <12 months is green. Use when founder asks about CAC, LTV, or customer acquisition profitability.",
                parameters=[
                    ToolParameter(name="marketing_spend_json", type="string", description='JSON array of monthly marketing spend the user provided: [{"date": "YYYY-MM-DD", "value": <user_value>}]', required=True),
                    ToolParameter(name="new_customers_json", type="string", description='JSON array of monthly new customer counts the user provided: [{"date": "YYYY-MM-DD", "value": <user_value>}]', required=True),
                    ToolParameter(name="avg_monthly_revenue_per_customer", type="number", description="Average monthly revenue per customer (ARPU) in dollars — must come from the user", required=True),
                    ToolParameter(name="avg_customer_lifetime_months", type="number", description="Expected customer lifetime in months — must come from the user", required=False, default=24.0),
                ],
            ),
            ToolDefinition(
                name="scenario_model",
                description="Model what-if scenarios: hiring, cutting spend, changing growth rate. Each scenario shows runway, ARR at 12 months, and breakeven month vs the base case. Use when founder asks 'what if I hire', 'what if I cut X', or 'what happens if...'",
                parameters=[
                    ToolParameter(name="base_metrics_json", type="string", description='JSON dict of base metrics the user has provided: {"mrr": <user_value>, "burn": <user_value>, "cash": <user_value>, "growth_rate": <user_value>}', required=True),
                    ToolParameter(name="scenarios_json", type="string", description='JSON array of scenarios to model: [{"name": "scenario name", "changes": {"burn_delta": <value>}}]', required=True),
                ],
            ),
            ToolDefinition(
                name="weekly_digest",
                description="Generate a Monday morning CFO report with headline number, WoW changes, alerts, green flags, and 3 focus actions for the week. Use when founder asks for weekly numbers, how they did this week, or wants a digest.",
                parameters=[
                    ToolParameter(name="metrics_json", type="string", description='JSON dict of current metrics the user has provided: {"mrr": <user_value>, "arr": <user_value>, "burn": <user_value>, "cash": <user_value>, "churn_rate": <user_value>, "growth_rate": <user_value>}', required=True),
                    ToolParameter(name="prev_week_json", type="string", description="JSON dict of same shape from the previous period — only if user provided it", required=False, default="{}"),
                ],
            ),
        ]

    # ── Tool Execution ────────────────────────────────────────────────────

    async def execute_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
    ) -> str:
        from agents.rex.analytics import compute_anomalies, compute_health_indicator, compute_derived_metrics
        from agents.rex.forecasting import forecast_metric
        from core.models import DataPoint

        # Brand kit is 5-min cached (already loaded by the chat turn), so including it here
        # is free — and the deliverable-generating calls need brand voice/industry/audience.
        system = await self.build_system_prompt(user_id, organization_id, use_brand_kit=True)

        if name == "analyze_metrics":
            try:
                metrics_raw = json.loads(arguments.get("metrics_json", "{}"))
            except Exception:
                metrics_raw = {}
            period = arguments.get("period", "monthly")

            all_anomalies = []
            charts = {}
            derived_health_inputs: dict = {}

            for metric_name, data_points in metrics_raw.items():
                dps = [DataPoint(**dp) for dp in data_points]
                anomalies = compute_anomalies(dps)
                all_anomalies.extend(anomalies)
                charts[metric_name] = data_points

                # Derive real health inputs from actual data (not hardcoded constants)
                if len(dps) >= 2:
                    sorted_dps = sorted(dps, key=lambda d: d.date)
                    prev_val = sorted_dps[-2].value
                    curr_val = sorted_dps[-1].value
                    if metric_name in ("revenue", "mrr") and prev_val:
                        derived_health_inputs["growth_rate"] = (curr_val - prev_val) / prev_val
                    elif metric_name == "churn_rate":
                        derived_health_inputs["churn_rate"] = curr_val
                    elif metric_name in ("subscribers", "users") and prev_val > 0:
                        churn = max(0.0, (prev_val - curr_val) / prev_val)
                        derived_health_inputs["churn_rate"] = churn

            health_inputs = {
                "churn_rate": derived_health_inputs.get("churn_rate", 0.0),
                "growth_rate": derived_health_inputs.get("growth_rate", 0.0),
            }
            health = compute_health_indicator(health_inputs)

            # Cap points per metric so a large CSV can't overflow the LLM context.
            metrics_summary = json.dumps({
                k: downsample_points(sorted(v, key=lambda p: p.get("date", "")), 200)
                if isinstance(v, list) else v
                for k, v in metrics_raw.items()
            })
            try:
                analysis = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Analyze these {period} metrics and provide insights:\n{metrics_summary}\n\n"
                        "Return ONLY a JSON object (no markdown fences) with keys:\n"
                        "summary (2-3 sentence narrative), "
                        "trend (up/down/flat — based on most recent data direction), "
                        "insights (array of 3-5 specific insight strings), "
                        f"health_indicator ({health}), "
                        "anomalies (array of {{date, metric, direction, severity: low/medium/high, root_cause_hypothesis}})"
                    )}],
                )
                # Merge algorithm-detected anomalies with LLM insights
                if all_anomalies and not analysis.get("anomalies"):
                    analysis["anomalies"] = all_anomalies
                analysis.setdefault("health_indicator", health)
            except Exception:
                analysis = {
                    "summary": "Metric analysis unavailable — the model returned unparseable output.",
                    "trend": "flat",
                    "insights": [],
                    "health_indicator": health,
                    "anomalies": all_anomalies,
                }
            result = {
                "analysis": analysis,
                "charts_data": charts,
                "data_points_analyzed": sum(len(v) for v in metrics_raw.values() if isinstance(v, list)),
                "confidence_level": "medium",
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

            prompt = (
                f"Provide financial narrative and recommendations for these metrics:\n"
                f"{json.dumps(derived, default=str)}\n\n"
                "Return ONLY a JSON object (no markdown fences) with keys:\n"
                "narrative (string, 2-4 sentences), "
                "recommendations (list of 3-5 specific actionable strings)"
            )
            try:
                parsed = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": prompt}],
                )
                narrative = parsed.get("narrative", "")
                recommendations = parsed.get("recommendations", [])
            except Exception:
                narrative = ""
                recommendations = []

            result = {
                "metrics": derived,
                "health_indicator": health,
                "narrative": narrative,
                "recommendations": recommendations,
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

            # If no summaries provided, fetch from peer agents concurrently
            if not summaries:
                async def _fetch_summary(slug: str, question: str) -> tuple:
                    try:
                        result = await self._execute_cross_agent_call(
                            {"agent_slug": slug, "question": question},
                            user_id,
                        )
                        return slug, result
                    except Exception:
                        return slug, ""

                fetch_tasks = [
                    _fetch_summary("maya", "Give me a 2-sentence summary of recent content performance and top post metrics."),
                    _fetch_summary("scout", "Give me a 1-sentence competitive intelligence update — any notable competitor moves recently?"),
                ]
                raw_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
                for item in raw_results:
                    if isinstance(item, tuple):
                        slug, summary = item
                        if summary:
                            summaries[slug] = summary

            context = f"Date: {date}\nMetrics: {json.dumps(metrics)}\nAgent summaries: {json.dumps(summaries)}"
            try:
                parsed = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Compile an executive briefing for {date}:\n{context}\n\n"
                        "Return ONLY a JSON object (no markdown fences) with keys:\n"
                        "headline (1 sentence — the single most important thing the founder must know today), "
                        "sections (object where each key is a section title and each value is a 2-4 sentence body string — "
                        "include: Financial Health, Content & Growth, Competitive Intelligence, Priority Actions), "
                        f"date ('{date}'), "
                        "generated_at (ISO datetime string)"
                    )}],
                )
                parsed.setdefault("date", date)
                from datetime import datetime as _dt
                parsed.setdefault("generated_at", _dt.utcnow().isoformat())
            except Exception:
                from datetime import datetime as _dt
                parsed = {
                    "headline": "Executive briefing compiled.",
                    "sections": {"Summary": "Briefing generation failed — please retry."},
                    "date": date,
                    "generated_at": _dt.utcnow().isoformat(),
                }
            result = {
                "briefing": parsed,
                "agent_summaries_used": list(summaries.keys()),
            }
            return json.dumps(result, default=str)

        elif name == "generate_investor_update":
            period = arguments.get("period", "this month")
            try:
                metrics = json.loads(arguments.get("metrics_json", "{}"))
            except Exception:
                metrics = {}
            highlights = arguments.get("highlights", [])
            asks = arguments.get("asks", [])

            prompt = (
                f"Write a professional investor update for {period}.\n\n"
                f"Metrics: {json.dumps(metrics, default=str)}\n"
                f"Highlights: {json.dumps(highlights)}\n"
                f"Asks: {json.dumps(asks)}\n\n"
                "Return ONLY a JSON object (no markdown fences) with keys:\n"
                "subject_line (string), "
                "executive_summary (string, 2-3 sentences), "
                "metrics_section (dict with formatted metric strings), "
                "highlights_section (list of strings), "
                "challenges_section (list of strings — be honest), "
                "asks_section (list of strings), "
                "full_email_body (string, ready to send)"
            )
            try:
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                )
            except Exception:
                data = {
                    "subject_line": f"Investor Update — {period}",
                    "executive_summary": "Update generation failed — please retry.",
                    "metrics_section": metrics,
                    "highlights_section": highlights,
                    "challenges_section": [],
                    "asks_section": asks,
                    "full_email_body": "",
                }
            return json.dumps(data, default=str)

        elif name == "calculate_runway":
            from agents.rex.analytics import compute_runway_scenarios
            cash = float(arguments.get("cash_on_hand", 0))
            burn = float(arguments.get("monthly_burn", 0))
            mrr = float(arguments.get("monthly_revenue", 0))
            growth_rate = float(arguments.get("growth_rate_pct", 0)) / 100.0

            result = compute_runway_scenarios(cash, burn, mrr, growth_rate)
            self._fire_rag_ingest(
                user_id=user_id,
                text=json.dumps(result, default=str),
                source_id=f"rex-runway-{user_id}",
                metadata={"tool": "calculate_runway", "agent": "rex"},
            )
            return json.dumps(result, default=str)

        elif name == "unit_economics":
            from agents.rex.analytics import compute_unit_economics
            from core.models import DataPoint as _DP
            try:
                spend_raw = json.loads(arguments.get("marketing_spend_json", "[]"))
                customers_raw = json.loads(arguments.get("new_customers_json", "[]"))
            except Exception:
                spend_raw, customers_raw = [], []

            marketing_data = [_DP(**dp) for dp in spend_raw]
            customers_data = [_DP(**dp) for dp in customers_raw]
            arpu = float(arguments.get("avg_monthly_revenue_per_customer", 0))
            lifetime = float(arguments.get("avg_customer_lifetime_months", 24.0))

            result = compute_unit_economics(marketing_data, customers_data, arpu, lifetime)
            self._fire_rag_ingest(
                user_id=user_id,
                text=json.dumps(result, default=str),
                source_id=f"rex-unit-econ-{user_id}",
                metadata={"tool": "unit_economics", "agent": "rex"},
            )
            return json.dumps(result, default=str)

        elif name == "scenario_model":
            from agents.rex.analytics import compute_runway_scenarios
            try:
                base = json.loads(arguments.get("base_metrics_json", "{}"))
                scenarios_list = json.loads(arguments.get("scenarios_json", "[]"))
            except Exception:
                base, scenarios_list = {}, []

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
            base_breakeven = _breakeven_month(base_mrr, base_burn, base_growth)

            modeled = []
            for s in scenarios_list:
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
            result = {
                "base_case": {
                    "runway_months": base_runway["months_remaining"],
                    "date_of_zero": base_runway["date_of_zero"],
                    "arr_12mo": base_arr_12,
                    "breakeven_month": base_breakeven,
                    "verdict": base_runway["verdict"],
                },
                "scenarios": modeled,
                "recommendation": (
                    f"Best scenario by runway: '{best['name']}' — "
                    f"runway delta: {(best['vs_base'].get('runway_delta') or 0):+.0f} months."
                    if best else "No scenarios provided."
                ),
            }
            return json.dumps(result, default=str)

        elif name == "weekly_digest":
            from datetime import datetime as _dt
            try:
                metrics = json.loads(arguments.get("metrics_json", "{}"))
                prev = json.loads(arguments.get("prev_week_json", "{}"))
            except Exception:
                metrics, prev = {}, {}

            prompt = (
                "You are a CFO generating a Monday morning digest for a startup founder.\n\n"
                f"Current period metrics: {json.dumps(metrics, default=str)}\n"
                f"Previous period metrics: {json.dumps(prev, default=str)}\n\n"
                "Return ONLY a JSON object (no markdown fences) with exactly these keys:\n"
                "period (string, e.g. 'Week of Apr 14 2025'), "
                "headline (string — the single most important number or trend), "
                "wow_changes (array of {metric, current, previous, change_pct, direction ('up'|'down'|'flat')}), "
                "alerts (array of {severity ('high'|'medium'|'low'), message}), "
                "green_flags (array of {message}), "
                "focus_this_week (array of exactly 3 action item strings), "
                "generated_at (ISO datetime string)"
            )
            try:
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": prompt}],
                )
            except Exception:
                data = {
                    "period": "This week",
                    "headline": "Weekly digest generation failed — please retry.",
                    "wow_changes": [],
                    "alerts": [],
                    "green_flags": [],
                    "focus_this_week": ["Review metrics manually"],
                    "generated_at": _dt.utcnow().isoformat(),
                }

            self._fire_rag_ingest(
                user_id=user_id,
                text=json.dumps(data, default=str),
                source_id=f"rex-weekly-digest-{user_id}",
                metadata={"tool": "weekly_digest", "agent": "rex", "priority": "high"},
            )
            return json.dumps(data, default=str)

        raise ValueError(f"Unknown tool: {name}")

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService


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

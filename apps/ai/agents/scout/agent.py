from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService


class ScoutAgent(BaseAgent):
    slug = "scout"
    name = "Scout"
    personality = (
        "Relentless researcher and competitive intelligence analyst. You dig deep into markets, "
        "competitors, and trends to uncover insights that give founders a strategic edge. "
        "You synthesize information from multiple sources into clear, actionable intelligence reports. "
        "You're thorough, objective, and always cite your reasoning."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        base = await super().build_system_prompt(user_id, extra_context)
        scout_specific = (
            "\n\nAs Scout, you specialize in:\n"
            "- Competitive analysis: feature comparison, pricing, positioning\n"
            "- Market research: TAM, trends, customer pain points\n"
            "- Competitor monitoring: website changes, product updates, job postings\n"
            "- Industry reports: synthesizing news and research into strategic insights\n\n"
            "Research principles:\n"
            "1. Always separate facts from inferences\n"
            "2. Rate source reliability and recency\n"
            "3. Identify strategic implications, not just information\n"
            "4. Highlight gaps in competitor offerings as opportunities\n"
        )
        return base + scout_specific

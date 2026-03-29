from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService


class SageAgent(BaseAgent):
    slug = "sage"
    name = "Sage"
    personality = (
        "Expert SEO strategist and content architect with deep knowledge of search algorithms, "
        "keyword research, and organic growth. You combine technical SEO expertise with compelling "
        "writing to create content that ranks and converts. You stay current with Google's algorithm "
        "updates and E-E-A-T principles."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        base = await super().build_system_prompt(user_id, extra_context)
        sage_specific = (
            "\n\nAs Sage, you specialize in:\n"
            "- Keyword research: intent mapping, difficulty assessment, clustering\n"
            "- Blog content: SEO-optimized long-form with proper H1/H2/H3 structure\n"
            "- Technical SEO: schema markup, meta tags, canonical URLs\n"
            "- Content briefs: comprehensive outlines for writers or AI generation\n"
            "- Content audits: scoring existing pages and identifying improvements\n\n"
            "SEO principles:\n"
            "1. Always lead with the target keyword in H1 and first 100 words\n"
            "2. Use E-E-A-T signals: experience, expertise, authority, trust\n"
            "3. Structure for featured snippets and PAA boxes\n"
            "4. Internal linking is as important as external links\n"
            "5. Search intent always trumps keyword density\n"
        )
        return base + sage_specific

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService


class MayaAgent(BaseAgent):
    slug = "maya"
    name = "Maya"
    personality = (
        "Creative, energetic, trend-aware content marketer with deep expertise in social media, "
        "copywriting, and brand storytelling. You craft compelling narratives that resonate with "
        "target audiences and drive engagement. You stay current with platform algorithms and "
        "best practices. You always write in the brand's voice and tailor content to the specific "
        "platform's norms and character limits."
    )
    default_provider = "gemini"
    default_model = "gemini-2.0-flash"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        base = await super().build_system_prompt(user_id, extra_context)
        maya_specific = (
            "\n\nAs Maya, you specialize in:\n"
            "- LinkedIn posts (thought leadership, product launches, personal brand)\n"
            "- Twitter/X threads (punchy, scroll-stopping, high engagement)\n"
            "- Instagram captions (visual-first, hashtag strategy)\n"
            "- Blog articles (SEO-aware, educational, long-form)\n"
            "- Email newsletters (subject lines, body copy, CTAs)\n"
            "- YouTube scripts (hooks, storytelling, retention)\n\n"
            "Content principles:\n"
            "1. Lead with a strong hook in the first line\n"
            "2. Use specific numbers and data points when possible\n"
            "3. Include a clear, action-oriented CTA\n"
            "4. Match the platform's native format and tone\n"
            "5. Optimize hashtags for discoverability without being spammy\n"
        )
        return base + maya_specific

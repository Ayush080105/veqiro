from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.tools import ToolDefinition, ToolParameter


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

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="generate_ideas",
                description="Generate creative content ideas for a given content type and topic. Returns ideas with hooks, predicted engagement, and hashtags.",
                parameters=[
                    ToolParameter(name="content_type", type="string", description="Type of content (e.g., linkedin_post, twitter_thread, blog_post, instagram_caption, email_newsletter, youtube_script)", required=False, default="linkedin_post"),
                    ToolParameter(name="topic_hint", type="string", description="Topic or theme to generate ideas about", required=True),
                    ToolParameter(name="count", type="integer", description="Number of ideas to generate (1-10)", required=False, default=3),
                ],
            ),
            ToolDefinition(
                name="draft_content",
                description="Draft a full content piece for a specific platform and topic. Returns a complete post with title, body, hashtags, CTA, and meta description.",
                parameters=[
                    ToolParameter(name="topic", type="string", description="The topic to write about", required=True),
                    ToolParameter(name="platform", type="string", description="Target platform (linkedin, twitter, instagram, blog, email, youtube)", required=False, default="linkedin"),
                    ToolParameter(name="tone", type="string", description="Tone override (e.g., professional, casual, inspirational)", required=False),
                    ToolParameter(name="word_count", type="integer", description="Target word count", required=False, default=250),
                ],
            ),
            ToolDefinition(
                name="generate_variants",
                description="Adapt existing content for multiple platforms. Takes content from one platform and creates optimized versions for other platforms.",
                parameters=[
                    ToolParameter(name="original_content", type="string", description="The original content to adapt", required=True),
                    ToolParameter(name="original_platform", type="string", description="Platform the original was written for", required=False, default="linkedin"),
                    ToolParameter(name="target_platforms", type="array", description="List of platforms to adapt to", required=True, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="revise_content",
                description="Revise and improve existing content based on feedback. Returns revised content with a list of changes made.",
                parameters=[
                    ToolParameter(name="original_content", type="string", description="The content to revise", required=True),
                    ToolParameter(name="feedback", type="string", description="Feedback or instructions for revision", required=True),
                    ToolParameter(name="specific_instructions", type="string", description="Additional specific instructions", required=False),
                ],
            ),
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(self, name: str, arguments: dict, user_id: str) -> str:
        system = await self.build_system_prompt(user_id)

        if name == "generate_ideas":
            count = arguments.get("count", 3)
            content_type = arguments.get("content_type", "linkedin_post")
            topic_hint = arguments.get("topic_hint", "")
            prompt = (
                f"Generate {count} content ideas for {content_type} about: {topic_hint}\n\n"
                "Return a JSON array of ideas. Each idea should have: title, content_type, platform, "
                "hook, predicted_engagement, reasoning, suggested_hashtags (array)."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        elif name == "draft_content":
            topic = arguments.get("topic", "")
            platform = arguments.get("platform", "linkedin")
            tone = arguments.get("tone", "")
            word_count = arguments.get("word_count", 250)
            from core.brand_kit import load_brand_kit, get_platform_tone
            brand_kit = await load_brand_kit(user_id)
            tone = tone or get_platform_tone(brand_kit, platform)
            prompt = (
                f"Write a {platform} post about: {topic}\n"
                f"Tone: {tone}\nTarget words: {word_count}\n\n"
                "Include a strong hook, body, relevant hashtags, and a CTA."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        elif name == "generate_variants":
            original = arguments.get("original_content", "")
            original_platform = arguments.get("original_platform", "linkedin")
            targets = arguments.get("target_platforms", [])
            results = []
            for platform in targets:
                prompt = (
                    f"Adapt this {original_platform} content for {platform}:\n\n"
                    f"{original}\n\n"
                    "Return the adapted content with title, body, hashtags, and character count."
                )
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                results.append(f"**{platform.upper()}:**\n{raw}")
            return "\n\n---\n\n".join(results)

        elif name == "revise_content":
            original = arguments.get("original_content", "")
            feedback = arguments.get("feedback", "")
            instructions = arguments.get("specific_instructions", "")
            prompt = (
                f"Revise this content based on feedback:\n\nOriginal:\n{original}\n\n"
                f"Feedback: {feedback}\n"
                f"Specific instructions: {instructions or 'None'}\n\n"
                "Return the revised content and list the changes you made."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        raise ValueError(f"Unknown tool: {name}")

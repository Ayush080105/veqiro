import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.tools import ToolDefinition, ToolParameter


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

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="keyword_research",
                description="Generate keyword research with intent mapping, difficulty scores, and clusters. Returns keywords with search intent, estimated difficulty, and content type suggestions.",
                parameters=[
                    ToolParameter(name="seed_topic", type="string", description="Seed topic or keyword to research", required=True),
                    ToolParameter(name="niche", type="string", description="Industry niche for context", required=False, default=""),
                    ToolParameter(name="count", type="integer", description="Number of keywords to generate", required=False, default=10),
                ],
            ),
            ToolDefinition(
                name="generate_blog",
                description="Generate a full SEO-optimized blog post with proper heading structure, meta tags, and keyword optimization.",
                parameters=[
                    ToolParameter(name="topic", type="string", description="Blog post topic", required=True),
                    ToolParameter(name="target_keyword", type="string", description="Primary SEO keyword to target", required=True),
                    ToolParameter(name="secondary_keywords", type="array", description="Additional keywords to include", required=False, items_type="string"),
                    ToolParameter(name="word_count", type="integer", description="Target word count", required=False, default=2000),
                    ToolParameter(name="output_format", type="string", description="Output format", required=False, default="markdown", enum=["markdown", "html", "wordpress", "wix"]),
                ],
            ),
            ToolDefinition(
                name="analyze_content",
                description="Analyze existing content for SEO quality. Returns an SEO score (0-100), issues found, improvement suggestions, missing keywords, and readability grade.",
                parameters=[
                    ToolParameter(name="content", type="string", description="The content to analyze", required=True),
                    ToolParameter(name="target_keyword", type="string", description="The keyword the content should target", required=True),
                    ToolParameter(name="url", type="string", description="URL of the content (if published)", required=False),
                ],
            ),
            ToolDefinition(
                name="content_brief",
                description="Generate a comprehensive SEO content brief with heading structure, must-include topics, questions to answer, and competitor gaps.",
                parameters=[
                    ToolParameter(name="topic", type="string", description="Topic for the content brief", required=True),
                    ToolParameter(name="target_keyword", type="string", description="Primary keyword", required=True),
                    ToolParameter(name="competitor_urls", type="array", description="Competitor URLs to analyze", required=False, items_type="string"),
                ],
            ),
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(self, name: str, arguments: dict, user_id: str) -> str:
        system = await self.build_system_prompt(user_id)

        if name == "keyword_research":
            seed = arguments.get("seed_topic", "")
            niche = arguments.get("niche", "")
            count = arguments.get("count", 10)
            prompt = (
                f"Generate {count} keywords for: {seed}"
                f"{f' in the {niche} niche' if niche else ''}.\n\n"
                "For each keyword provide: keyword, search_intent (informational/navigational/transactional/commercial), "
                "estimated_difficulty (1-100), relevance_score (0-1), suggested_content_type, related_keywords (list)."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        elif name == "generate_blog":
            topic = arguments.get("topic", "")
            keyword = arguments.get("target_keyword", "")
            secondary = arguments.get("secondary_keywords", [])
            word_count = arguments.get("word_count", 2000)
            output_format = arguments.get("output_format", "markdown")
            tone = "educational, authoritative"

            prompt = (
                f"Write a {word_count}-word SEO blog post.\n"
                f"Topic: {topic}\nTarget keyword: {keyword}\n"
                f"Secondary keywords: {', '.join(secondary) if secondary else 'None'}\n"
                f"Tone: {tone}\nFormat: {output_format}\n\n"
                "Include proper H1/H2/H3 structure, meta title, meta description, "
                "and optimize for the target keyword throughout."
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
                max_tokens=4096,
            )

            # Apply platform-specific formatting
            if output_format == "wordpress":
                from agents.sage.wordpress import format_for_wordpress
                wp = format_for_wordpress(topic, raw, tags=secondary)
                return f"{raw}\n\n---\nWordPress Format:\n{json.dumps(wp, indent=2)}"
            elif output_format == "wix":
                from agents.sage.wordpress import format_for_wix
                wix = format_for_wix(topic, raw, excerpt=f"Guide to {keyword}", tags=secondary)
                return f"{raw}\n\n---\nWix Format:\n{json.dumps(wix, indent=2)}"
            return raw

        elif name == "analyze_content":
            content = arguments.get("content", "")
            keyword = arguments.get("target_keyword", "")
            prompt = (
                f"Analyze this content for SEO quality:\n"
                f"Target keyword: {keyword}\n\n"
                f"Content:\n{content[:3000]}\n\n"
                "Provide: score (0-100), issues found, improvement suggestions, "
                "missing keywords, and readability grade."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        elif name == "content_brief":
            topic = arguments.get("topic", "")
            keyword = arguments.get("target_keyword", "")
            prompt = (
                f"Create a comprehensive SEO content brief for:\n"
                f"Topic: {topic}\nTarget keyword: {keyword}\n\n"
                "Include: search intent, recommended word count, H2 structure, "
                "must-include topics, questions to answer, internal linking opportunities, "
                "competitor gaps, CTA recommendation, and estimated traffic potential."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        raise ValueError(f"Unknown tool: {name}")

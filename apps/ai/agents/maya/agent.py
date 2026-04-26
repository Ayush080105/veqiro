from agents.base import BaseAgent
from core.llm import LLMClient
from core.models import ChatRequest, ChatSyncResponse
from core.rag import RAGService
from core.tools import ToolDefinition, ToolParameter

# Platform constraints for prompt injection
PLATFORM_RULES = {
    "linkedin": {
        "max_chars": 3000,
        "hashtag_count": "3-5",
        "tone": "professional, thought-leadership, insight-driven",
        "format": "paragraph breaks, bullet points, strong hook first line",
    },
    "twitter": {
        "max_chars": 280,
        "hashtag_count": "1-3",
        "tone": "casual, punchy, scroll-stopping",
        "format": "short, impactful, thread-friendly (use 🧵 for threads)",
    },
    "instagram": {
        "max_chars": 2200,
        "hashtag_count": "15-30",
        "tone": "visual-first, inspiring, relatable",
        "format": "short paragraphs, line breaks, emojis, CTA at end",
    },
}


class MayaAgent(BaseAgent):
    slug = "maya"
    name = "Maya"
    personality = (
        "the content and social media lead. You know what actually works on Instagram, LinkedIn, and X — "
        "not theory, just what gets engagement. You write in the brand's voice, give real opinions on "
        "creative direction, and always have a reason for every choice. Enthusiastic but not over the top."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
    ) -> str:
        from core.brand_kit import load_brand_kit, get_site_context_block
        brand_kit = await load_brand_kit(organization_id)

        prompt = (
            f"You are {self.name}, {self.personality}\n\n"
            f"Company: {brand_kit.company_name}\n"
            f"Description: {brand_kit.company_description}\n"
        )
        if brand_kit.value_proposition:
            prompt += f"Value Proposition: {brand_kit.value_proposition}\n"
        prompt += (
            f"Industry: {brand_kit.industry}\n"
            f"Target Audience: {brand_kit.target_audience}\n"
            f"Brand Voice: {brand_kit.brand_voice}\n"
            f"Key Differentiators: {brand_kit.key_differentiators}\n"
        )
        if brand_kit.website_url:
            prompt += f"Website: {brand_kit.website_url}\n"
        if brand_kit.competitors:
            prompt += f"Competitors: {', '.join(str(c) for c in brand_kit.competitors)}\n"
        if brand_kit.brand_colors:
            colors = ", ".join(f"{k}: {v}" for k, v in brand_kit.brand_colors.items())
            prompt += f"Brand Colors: {colors}\n"

        # Crawled site context (Jina Reader). Strong grounding signal — gives
        # Maya the actual marketing language to mirror. Empty string if the
        # org has no website or the crawl hasn't run yet.
        site_block = get_site_context_block(brand_kit)
        if site_block:
            prompt += "\n" + site_block + "\n"

        prompt += (
            "\n## Platform Rules\n"
            "You support 3 platforms: LinkedIn, Instagram, Twitter/X.\n\n"
            "**LinkedIn** (max 3000 chars): Professional, insight-driven. 3-5 hashtags. "
            "Lead with a strong hook. Short paragraphs — NO bullet points, NO bold headers.\n\n"
            "**Twitter/X** (max 280 chars per tweet): Casual, punchy, scroll-stopping. "
            "1-3 hashtags. For longer content, use threads (🧵).\n\n"
            "**Instagram** (max 2200 chars): Visual-first, inspiring, relatable. "
            "15-30 hashtags (in a separate block at the end). Short paragraphs, emojis, CTA.\n\n"
            "## Content Principles\n"
            "1. Every post starts with a scroll-stopping hook\n"
            "2. Include specific numbers and data when possible\n"
            "3. End with a clear CTA that drives engagement or traffic\n"
        )
        if brand_kit.website_url:
            prompt += f"4. Include the website link ({brand_kit.website_url}) in CTAs when relevant\n"
        prompt += (
            "5. Match the platform's native format and character limits exactly\n"
            "6. Hashtags must be platform-appropriate (count and style)\n"
            "7. Write in the brand voice — never generic\n"
        )
        prompt += (
            "\nHOW TO RESPOND:\n"
            "After draft_content: output the post AS-IS — nothing before, nothing after. No headers, no commentary.\n"
            "After generate_ideas: output the ideas exactly as returned — don't rewrite or summarise them.\n"
            "Never suggest or describe images — the image is generated automatically by the system.\n"
            "No filler: 'Certainly!', 'Great choice!', 'Here's your post:' — just deliver.\n"
        )
        if brand_kit.logo_url or brand_kit.mascot_url:
            has_logo = "Logo: available." if brand_kit.logo_url else "Logo: not configured."
            has_mascot = "Mascot: available." if brand_kit.mascot_url else "Mascot: not configured."
            prompt += (
                "\n## Image Generation Rules\n"
                f"Brand assets — {has_logo} {has_mascot}\n\n"
                "- use_logo defaults to FALSE. Set True ONLY if user explicitly says 'with logo', 'include logo', 'add our logo', etc.\n"
                "- use_mascot defaults to FALSE. Set True ONLY if user explicitly mentions the mascot.\n"
                "- 'Make a post' with no logo/mascot mention → both False.\n"
                "- 'Add logo to the image' after an image was generated → call modify_image, NOT draft_content.\n"
                "- 'Add mascot' after an image was generated → call modify_image (triggers re-generation with mascot).\n"
                "- Never assume the user wants logo or mascot just because brand kit has them.\n"
            )
        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        return prompt

    # ── Tool instructions ────────────────────────────────────────────────

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## Tool Rules\n"
            "- User asks for a post on a specific platform → call `draft_content` ONCE for that platform only.\n"
            "- Don't call `draft_content` for multiple platforms unless the user explicitly asks for all of them.\n"
            "- User asks for ideas or a content calendar → call `generate_ideas`.\n"
            "- User says 'adapt for X' or 'now make it for Instagram' → call `generate_variants`.\n"
            "- User gives feedback on existing content → call `revise_content`.\n"
            "- User says 'add logo' or 'add mascot' after an image was shown → call `modify_image`.\n"
            "After drafting, output the post text directly. Nothing else.\n\n"
            "## When to use ask_agent\n"
            "- User asks for trending topics, hot news, or what's popular right now → call `ask_agent` with scout FIRST "
            "(question: 'What are the top trending topics in [industry] right now?'), then use the result as input to `draft_content`.\n"
            "- User wants SEO-optimized content or asks what keywords to target → call `ask_agent` with sage first.\n"
            "- User asks a legal question about content (copyright, claims, disclaimers) → call `ask_agent` with lex.\n"
            "Always call ask_agent BEFORE drafting when external research is needed."
        )

    # ── Chat with auto image generation ─────────────────────────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        response = await super().chat_sync(request)
        if request.metadata.get("_cross_agent_call", False):
            return response

        tool_calls = response.metadata.get("tool_calls", [])

        # Branch A: new content was drafted/adapted/ideated — generate image
        content_call = next(
            (tc for tc in tool_calls if tc["name"] in {"draft_content", "generate_variants", "generate_ideas"}),
            None,
        )
        if content_call:
            try:
                from core.brand_kit import load_brand_kit
                from core.image_gen import generate_social_image
                args = content_call["arguments"]
                topic = args.get("topic", args.get("topic_hint", args.get("original_content", "content")))[:100]
                platform = args.get("platform", args.get("original_platform", "linkedin"))
                if isinstance(platform, list):
                    platform = platform[0] if platform else "linkedin"
                use_logo: bool = bool(args.get("use_logo", False))
                use_mascot: bool = bool(args.get("use_mascot", False))

                brand_kit = await load_brand_kit(request.organization_id)
                image_result = await generate_social_image(
                    topic, platform,
                    use_logo=use_logo, use_mascot=use_mascot,
                    user_id=request.user_id,
                    organization_id=request.organization_id,
                    brand_kit=brand_kit,
                )

                response.image = image_result
            except Exception as e:
                response.metadata["image_error"] = str(e)

        # Branch B: user wants to modify logo/mascot on the previously generated image
        modify_call = next(
            (tc for tc in tool_calls if tc["name"] == "modify_image"),
            None,
        )
        if modify_call:
            try:
                from core.brand_kit import load_brand_kit
                from core.image_gen import generate_social_image
                args = modify_call["arguments"]
                use_logo: bool = bool(args.get("use_logo", False))
                use_mascot: bool = bool(args.get("use_mascot", False))
                topic: str = args.get("topic", "content")
                platform: str = args.get("platform", "linkedin")
                aspect_ratio: str = args.get("aspect_ratio", "1:1")

                brand_kit = await load_brand_kit(request.organization_id)
                new_image = await generate_social_image(
                    topic, platform,
                    use_logo=use_logo, use_mascot=use_mascot,
                    aspect_ratio=aspect_ratio,
                    user_id=request.user_id,
                    organization_id=request.organization_id,
                    brand_kit=brand_kit,
                )
                response.image = new_image
            except Exception:
                pass  # image modification is best-effort

        return response

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="generate_ideas",
                description=(
                    "Generate creative, platform-specific content ideas for Instagram, LinkedIn, or Twitter/X. "
                    "Returns ideas with hooks, predicted engagement, and strategic hashtags. "
                    "Use when the user asks for post ideas, content calendar suggestions, or brainstorming."
                ),
                parameters=[
                    ToolParameter(name="platform", type="string", description="Target platform: linkedin, twitter, or instagram", required=True),
                    ToolParameter(name="topic_hint", type="string", description="Topic or theme to generate ideas about", required=True),
                    ToolParameter(name="count", type="integer", description="Number of ideas (1-10)", required=False, default=3),
                    ToolParameter(name="use_logo", type="boolean", description="Include brand logo on the generated image. Set true ONLY if user explicitly asks.", required=False, default=False),
                    ToolParameter(name="use_mascot", type="boolean", description="Include brand mascot in the generated image. Set true ONLY if user explicitly asks.", required=False, default=False),
                ],
            ),
            ToolDefinition(
                name="draft_content",
                description=(
                    "Draft a complete, ready-to-publish social media post for a specific platform. "
                    "Returns platform-native caption with hashtags, CTA, and formatting. "
                    "Use when the user wants to create a post, write content, or draft a caption."
                ),
                parameters=[
                    ToolParameter(name="topic", type="string", description="What the post is about", required=True),
                    ToolParameter(name="platform", type="string", description="Target platform: linkedin, twitter, or instagram", required=True),
                    ToolParameter(name="tone", type="string", description="Tone override (e.g., inspirational, educational, controversial)", required=False),
                    ToolParameter(name="word_count", type="integer", description="Approximate target word count", required=False, default=200),
                    ToolParameter(name="use_logo", type="boolean", description="Include brand logo on the generated image. Set true ONLY if user explicitly asks.", required=False, default=False),
                    ToolParameter(name="use_mascot", type="boolean", description="Include brand mascot in the generated image. Set true ONLY if user explicitly asks.", required=False, default=False),
                ],
            ),
            ToolDefinition(
                name="generate_variants",
                description=(
                    "Adapt existing content for other platforms. Takes a post written for one platform "
                    "and creates optimized versions for other platforms while preserving the core message. "
                    "Use when the user says 'now make this for Instagram' or 'adapt for Twitter'."
                ),
                parameters=[
                    ToolParameter(name="original_content", type="string", description="The original post content to adapt", required=True),
                    ToolParameter(name="original_platform", type="string", description="Platform the original was for", required=True),
                    ToolParameter(name="target_platforms", type="array", description="Platforms to adapt to", required=True, items_type="string"),
                    ToolParameter(name="use_logo", type="boolean", description="Include brand logo on the generated image. Set true ONLY if user explicitly asks.", required=False, default=False),
                    ToolParameter(name="use_mascot", type="boolean", description="Include brand mascot in the generated image. Set true ONLY if user explicitly asks.", required=False, default=False),
                ],
            ),
            ToolDefinition(
                name="modify_image",
                description=(
                    "Regenerate the image for a post already created in this conversation, with updated logo/mascot flags. "
                    "Use ONLY for follow-up requests like 'add the logo', 'remove the mascot', 'now add our logo to it'. "
                    "Do NOT use this if no image has been generated yet — use draft_content instead."
                ),
                parameters=[
                    ToolParameter(name="topic", type="string", description="Same topic used for the original post in this conversation", required=True),
                    ToolParameter(name="platform", type="string", description="Same platform used for the original post", required=True),
                    ToolParameter(name="aspect_ratio", type="string", description="Same aspect ratio used for the original image (e.g. 1:1, 16:9)", required=False, default="1:1"),
                    ToolParameter(name="use_logo", type="boolean", description="Whether the logo should appear on the final image", required=True),
                    ToolParameter(name="use_mascot", type="boolean", description="Whether the mascot should appear in the final image", required=True),
                ],
            ),
            ToolDefinition(
                name="revise_content",
                description=(
                    "Revise and improve existing content based on feedback. "
                    "Use when the user wants changes to a post — e.g., 'make it shorter', 'add more emojis', "
                    "'change the CTA', 'make it more professional'."
                ),
                parameters=[
                    ToolParameter(name="original_content", type="string", description="The content to revise", required=True),
                    ToolParameter(name="feedback", type="string", description="What to change or improve", required=True),
                    ToolParameter(name="platform", type="string", description="Target platform for formatting rules", required=False, default="linkedin"),
                ],
            ),
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
    ) -> str:
        system = await self.build_system_prompt(user_id, organization_id)

        if name == "generate_ideas":
            platform = arguments.get("platform", "linkedin")
            topic_hint = arguments.get("topic_hint", "")
            count = arguments.get("count", 3)
            rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
            prompt = (
                f"Generate {count} {platform} content ideas about: {topic_hint}\n\n"
                f"Tone: {rules['tone']}. {rules['hashtag_count']} hashtags per post.\n\n"
                f"Format each idea exactly like this (no JSON, no markdown headers):\n\n"
                "**Idea 1 — [title]**\n"
                "Hook: [opening line that stops the scroll]\n"
                "Why it works: [1 sentence]\n"
                "Format: [post type — single post, carousel, etc.]\n"
                "Hashtags: [3-5 hashtags]\n\n"
                "Repeat for each idea. Be specific to the topic — no generic filler."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        elif name == "draft_content":
            topic = arguments.get("topic", "")
            platform = arguments.get("platform", "linkedin")
            tone = arguments.get("tone", "")
            word_count = arguments.get("word_count", 200)
            from core.brand_kit import load_brand_kit, get_platform_tone
            brand_kit = await load_brand_kit(organization_id)
            tone = tone or get_platform_tone(brand_kit, platform)
            rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
            website_cta = ""
            if brand_kit.website_url:
                website_cta = f"\nInclude this link in the CTA where natural: {brand_kit.website_url}"
            platform_limits = {
                "linkedin": "Under 150 words. Short paragraphs, no bullet points, no headers.",
                "twitter": "Under 280 characters total. One punchy sentence or short thread opener.",
                "instagram": "Under 150 words. Short paragraphs, line breaks, emojis welcome, hashtags at the end.",
            }
            prompt = (
                f"Write a {platform} post about this topic: {topic}\n\n"
                f"Tone: {tone}\n"
                f"Max {rules['max_chars']} chars. {rules['hashtag_count']} hashtags at the end.\n"
                f"{website_cta}\n\n"
                "STRICT RULES:\n"
                f"- {platform_limits.get(platform, 'Keep it concise and platform-native.')}\n"
                "- Start with a specific fact, number, or bold statement — NOT with 'As a founder' or any generic opener.\n"
                "- Write about the BUSINESS VALUE and REAL IMPACT of the topic. Never mention mascots, characters, visuals, or image descriptions.\n"
                "- Sound like the founder typed it themselves — direct, confident, no filler.\n"
                "- NO generic phrases: 'whirlwind', 'imagine', 'journey', 'elusive', 'navigating', 'transform the chaos'.\n"
                "- CTA at the end: a direct question or action, not a vague 'share your thoughts'.\n\n"
                "Output ONLY the post. Nothing before it, nothing after it."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        elif name == "generate_variants":
            import asyncio
            original = arguments.get("original_content", "")
            original_platform = arguments.get("original_platform", "linkedin")
            targets = arguments.get("target_platforms", [])
            from core.brand_kit import load_brand_kit
            brand_kit = await load_brand_kit(organization_id)  # load once
            website_cta = f"\nInclude this link where natural: {brand_kit.website_url}" if brand_kit.website_url else ""

            async def _adapt(platform: str) -> str:
                rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
                prompt = (
                    f"Adapt this {original_platform} content for {platform}:\n\n"
                    f"{original}\n\n"
                    f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, "
                    f"tone: {rules['tone']}, format: {rules['format']}\n"
                    f"{website_cta}\n\n"
                    "Return the adapted post as plain text, ready to copy-paste and publish. "
                    "Preserve the core message but make it platform-native."
                )
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                return f"**{platform.upper()}:**\n{raw}"

            results = await asyncio.gather(*[_adapt(p) for p in targets])
            return "\n\n---\n\n".join(results)

        elif name == "revise_content":
            original = arguments.get("original_content", "")
            feedback = arguments.get("feedback", "")
            platform = arguments.get("platform", "linkedin")
            rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
            prompt = (
                f"Revise this {platform} post based on feedback:\n\n"
                f"Original:\n{original}\n\n"
                f"Feedback: {feedback}\n\n"
                f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags\n\n"
                "Return the revised post as plain text, ready to publish. "
                "Then on a new line write '---CHANGES---' followed by a bullet list of what you changed."
            )
            return await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )

        elif name == "modify_image":
            return "Image modification applied. The updated image will appear in the response."

        raise ValueError(f"Unknown tool: {name}")

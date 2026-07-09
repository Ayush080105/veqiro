import json
from datetime import datetime, timezone

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


def build_ideas_prompt(
    platform: str,
    count: int,
    rules: dict,
    topic_line: str,
    dedupe_block: str = "",
) -> str:
    """Shared ideation prompt body used by BOTH the chat `generate_ideas` tool and the
    /generate-ideas endpoint, so the two paths produce the same idea quality.

    Callers append their own return-shape instruction (both use a JSON object with an
    "ideas" array so provider JSON mode can be enforced).
    """
    return (
        f"{topic_line}\n\n"
        f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, tone: {rules['tone']}\n"
        f"{dedupe_block}\n"
        "IMPORTANT: Only generate ideas for static image posts (linkedin_post, instagram_post, tweet). "
        "Do NOT suggest videos, reels, infographics, carousels, threads, or blog posts.\n\n"
        f"IDEA DIVERSITY — the {count} ideas in THIS batch must each take a genuinely different angle from "
        "one another, not just a different topic wrapped around the same shape. Draw from distinct archetypes such "
        "as: a contrarian/unpopular take, a data- or result-led claim, a short anecdote or behind-the-scenes moment, "
        "a practical how-to, a bold opinion stated as fact, a customer-voice or testimonial angle, a trend-jack tied "
        "to something happening now, or a direct question that starts a real conversation. No two ideas in the batch "
        "should share the same hook shape or the same emotional register.\n"
        "Reject any idea that reads as generic — if it could be posted by any competitor with the brand name swapped "
        "out, it's not specific enough. Each idea must be traceable to something TRUE and SPECIFIC about this "
        "company: a differentiator, a real audience pain point, or an insight only this brand can credibly claim.\n\n"
        "HOOK CRAFT — the 'hook' is the single highest-leverage line of the post:\n"
        "- The first 8 words must either open a curiosity gap, state a concrete number/outcome, or make a claim "
        "the reader instinctively wants to argue with. A hook that merely introduces the topic is a failure.\n"
        "- Vary the hook's opening style across ideas (blunt fact, scene, direct address, opinion, question) — "
        "never default every hook to the same stat-led or question-led pattern.\n\n"
        "Field requirements per idea:\n"
        "- title: post headline\n"
        f"- platform: \"{platform}\"\n"
        "- content_type: one of linkedin_post, instagram_post, tweet\n"
        "- hook: opening line (per HOOK CRAFT above)\n"
        "- predicted_engagement: short engagement prediction\n"
        "- reasoning: name the specific engagement MECHANISM this idea triggers — saves, shares, comments, "
        "debate, or profile visits — and why THIS audience responds to it. 'It's relatable' is not a mechanism.\n"
        "- suggested_hashtags: array of hashtag strings\n"
        "- visual_description: a detailed image generation prompt describing exactly what the post image should "
        "look like — the specific scene, subject, environment, lighting, mood, composition, and any text overlay. "
        "This is fed directly to an image generator, so be concrete and vivid; never a vague mood statement.\n"
    )


DRAFT_PLATFORM_LIMITS = {
    "linkedin": "Under 150 words. Short paragraphs, no bullet points, no headers.",
    "twitter": "Under 280 characters total. One punchy sentence or short thread opener.",
    "instagram": "Under 150 words. Short paragraphs, line breaks, emojis welcome, hashtags at the end.",
}


def build_draft_rules(platform: str) -> str:
    """Canonical copywriting rules for drafting a post — shared by the chat
    `draft_content` tool and the /draft-content endpoint so both paths write
    at the same quality bar."""
    return (
        "STRICT RULES:\n"
        f"- {DRAFT_PLATFORM_LIMITS.get(platform, 'Keep it concise and platform-native.')}\n"
        "- Pick ONE opener style and commit to it — do not default to the same shape every time: "
        "a blunt fact or number, a counterintuitive claim, a one-line scene/story, a direct 'you' address, "
        "or a flat opinion stated as fact. NOT 'As a founder' or any generic opener.\n"
        "- SPECIFICITY GATE: every claim must carry a number, a named outcome, or a concrete scene. "
        "Reread each sentence — if it carries none of those and could sit in any competitor's post, "
        "delete or rewrite it.\n"
        "- RHYTHM: vary sentence length deliberately. One-word sentences are allowed. Never write three "
        "consecutive sentences of similar length — the post should read aloud with a pulse, not a drone.\n"
        "- Write about the BUSINESS VALUE and REAL IMPACT. Never mention mascots, characters, visuals, or image descriptions.\n"
        "- Sound like the founder typed it themselves — direct, confident, no filler. Let personality and humor show "
        "where the tone allows it — this should read like a specific person wrote it, not a template.\n"
        "- NO generic phrases: 'whirlwind', 'imagine', 'journey', 'elusive', 'navigating', 'transform the chaos'.\n"
        "- CTA: vary the form — a specific question, a direct action (try/click/reply), a mini-challenge, an opinion "
        "prompt, or no CTA at all if the post lands better without one. "
        "NEVER use the generic survey template '[stat/number] of people feel/do X — how do you feel? Let us know' "
        "or any close variant ('what about you?', 'do you agree?', 'share your thoughts below') — it reads as "
        "AI-generated engagement bait, not a real CTA.\n"
    )


class MayaAgent(BaseAgent):
    slug = "maya"
    name = "Maya"
    personality = (
        "the content and social media lead. You know what actually works on Instagram, LinkedIn, and X — "
        "not theory, just what gets engagement. You write in the brand's voice, give real opinions on "
        "creative direction, and always have a reason for every choice. Enthusiastic but not over the top."
    )
    default_provider = "openai"
    default_model = "gpt-4.1-mini"

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
        use_brand_kit: bool = True,
        has_history: bool = False,
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
        prompt += self._core_response_style_block()
        prompt += (
            "\n## Tool Output Rules\n"
            "After draft_content: output the post AS-IS — nothing before, nothing after. No headers, no commentary.\n"
            "After generate_ideas: output the ideas exactly as returned — don't rewrite or summarise them.\n"
            "Never suggest or describe images — the image is generated automatically by the system.\n"
            "No filler: 'Certainly!', 'Great choice!', 'Here's your post:' — just deliver.\n"
            "\n## Conversational Style\n"
            "You're a real creative partner, not a content vending machine. When someone says hi, thanks, "
            "'love it', 'perfect', 'nice', 'ok', or anything casual — respond in Maya's voice: "
            "punchy, warm, energetic. No tools, no cards. Just a real reply.\n"
        )
        prompt += (
            "When greeting at the start of a conversation: be punchy and creative — "
            "'Maya here — ready to make some noise. What are we creating?' "
            "/ 'Hey! Feed looking quiet? Let's fix that.' / 'What's the brief?' "
            "Never say 'How can I assist you today?' — that's for robots.\n"
            if not has_history else
            self._mid_conversation_ack_block()
        )
        prompt += (
            "\n## Your Domain\n"
            "Social media content (LinkedIn, Instagram, Twitter/X), post drafting, idea generation, "
            "content adaptation, image generation, social campaigns, brand voice writing.\n"
            "\n## When to Redirect — Never Guess Outside Your Lane\n"
            "- Business metrics, MRR, ARR, revenue, burn rate, forecasting → Rex handles analytics. "
            "'That's Rex's territory — he's the financial analyst. Head to Rex's chat.'\n"
            "- SEO strategy, keyword research, blog writing, SERP analysis → "
            "'Sage is your SEO expert for that.'\n"
            "- Competitive research, market analysis, trend data → "
            "'Scout researches markets and competitors. Ask Scout.'\n"
            "- Contracts, legal compliance, copyright, trademarks → "
            "'Lex handles legal matters. Take that to Lex.'\n"
            "- Email management, calendar, scheduling, meeting notes → "
            "'Vega manages your inbox and calendar. That's Vega's domain.'\n"
            "RULE: Never fabricate business metrics, legal advice, or financial figures — redirect instead.\n"
        )
        if brand_kit.logo_url or brand_kit.mascot_url:
            has_logo = "Logo: available." if brand_kit.logo_url else "Logo: not configured."
            has_mascot = "Mascot: available." if brand_kit.mascot_url else "Mascot: not configured."
            prompt += (
                "\n## Image Generation Rules\n"
                f"Brand assets — {has_logo} {has_mascot}\n\n"
                "- use_logo defaults to FALSE. Set True ONLY when user's message (anywhere in the conversation) "
                "contains phrases like: 'with logo', 'use logo', 'use my logo', 'add logo', 'include logo', "
                "'put logo', 'logo on it', 'logo in there', 'show logo', 'brand logo'.\n"
                "- use_mascot defaults to FALSE. Set True ONLY if user explicitly mentions the mascot.\n"
                "- 'Make a post' with no logo/mascot mention → both False.\n"
                "- CRITICAL: If the user ALREADY asked for logo earlier in the conversation and you paused to "
                "ask for a platform — when the user replies with a platform, you MUST still pass use_logo=True. "
                "Do not lose logo/mascot intent from earlier messages.\n"
                "- Any request to 'make it again', 'redo', 'regenerate' after an image was shown "
                "→ use modify_image (keep same topic/platform, apply new logo/mascot flags). "
                "Do NOT call draft_content for a redo — it produces duplicate content.\n"
                "- 'Add logo to the image', 'put our logo on it', 'add mascot' → call modify_image, NOT draft_content.\n"
                "- CRITICAL: Phrases about logo STYLING (e.g. 'make the logo with white background', "
                "'logo white background', 'change the logo color', 'make the logo bold', 'logo bigger', "
                "'logo smaller', 'logo in corner') → ALWAYS call modify_image. NEVER call draft_content. "
                "These are image edits, not new post requests.\n"
                "- Never assume the user wants logo or mascot just because brand kit has them.\n"
                "- IMPORTANT: When user requests ANY visual or style change (not just logo/mascot) — "
                "'make it more realistic', 'attention-grabbing', 'bolder', 'darker', etc. → call modify_image "
                "and capture their exact visual instructions in the style_changes parameter.\n"
                "- 'no transparent logo' / 'don't use transparent logo' means the logo was rendering incorrectly "
                "transparent — the user STILL WANTS the logo, just solid. → use_logo=True + "
                "style_changes='render logo fully opaque and solid, not transparent' plus any other instructions.\n"
                "- Only set use_logo=False if user explicitly says 'remove the logo', 'no logo at all', "
                "'without logo', or 'skip the logo'.\n"
            )
        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        return prompt

    # ── Tool instructions ────────────────────────────────────────────────

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## Tool Rules\n"
            "NEVER use tools for: greetings, thanks, 'great', 'love it', 'ok', small talk, "
            "or anything that is not a content creation request. Respond to those in Maya's voice — no tools.\n\n"
            "## HIGHEST PRIORITY — Image vs New Content disambiguation\n"
            "If an image was already generated in this conversation AND the user's message is about:\n"
            "  • the image, logo, or visual (e.g. 'make the logo with white background', 'add logo',\n"
            "    'change the logo', 'make it bolder', 'logo white background', 'update the image',\n"
            "    'redo the image', 'change the background', ANY logo/mascot/visual tweak)\n"
            "→ ALWAYS call `modify_image`. NEVER call `draft_content` for this — it generates new content\n"
            "  which is NOT what the user wants. The user wants the existing image changed.\n"
            "Only call `draft_content` when the user is explicitly asking for a BRAND NEW post on a new topic.\n\n"
            "- If the user asks for a NEW post but does NOT specify a platform → ask once: "
            "'Which platform — LinkedIn, Instagram, or Twitter/X?' "
            "When you ask, also note any logo/mascot flags from the same message so you don't lose them.\n"
            "- Do NOT ask for platform if the user is modifying/redoing an existing post — infer from context.\n"
            "- ONE deliverable per turn. Content tools are mutually exclusive: "
            "when the user's intent is to CREATE content, call exactly ONE of "
            "`draft_content`, `generate_variants`, `revise_content`, or `draft_carousel`. "
            "Never call `generate_ideas` in the same turn as any of these — it's wasted work and shows the wrong card.\n"
            "- When the user's intent is to EXPLORE ideas, call `generate_ideas` only — not draft_content.\n"
            "- Don't call `draft_content` for multiple platforms unless the user explicitly asks for all of them.\n"
            "- User says 'adapt for X' or 'now make it for Instagram' → call `generate_variants`.\n"
            "- User gives feedback on existing content text → call `revise_content`.\n"
            "- User says 'make it again', 'redo', 'regenerate', 'add logo', 'add mascot', "
            "'use my logo', 'put logo on it', 'make it more realistic', 'attention-grabbing', "
            "'no transparent logo', 'logo white background', 'make the logo...', 'change the logo', "
            "'bolder', 'darker', or ANY visual quality/style request "
            "after an image was shown → call `modify_image` with the correct use_logo/use_mascot flags "
            "AND pass the user's exact visual instructions in style_changes. "
            "Infer topic and platform from the previous draft in history.\n"
            "After any tool call the card is rendered automatically — output NOTHING extra.\n\n"
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
        # Skip Branch A entirely if modify_image was also called — the model
        # should never run draft_content alongside modify_image, but when it
        # does (mis-fire), the image-edit intent always takes priority.
        modify_also_called = any(tc["name"] == "modify_image" for tc in tool_calls)
        content_call = next(
            (tc for tc in tool_calls if tc["name"] in {"draft_content", "generate_variants", "generate_ideas"}),
            None,
        )
        if content_call and not modify_also_called:
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
                _tone = args.get("tone", "")
                # Build rich context from the actual draft/idea result so the
                # 5-component elaboration understands the post angle, hook, and audience.
                _ctx_parts = [_tone] if _tone else []
                if response.action_result:
                    draft = response.action_result.get("draft") or {}
                    if draft.get("hook"):
                        _ctx_parts.append(f"hook: {draft['hook']}")
                    if draft.get("body"):
                        _ctx_parts.append(f"post excerpt: {str(draft['body'])[:250]}")
                    ideas = response.action_result.get("ideas") or []
                    _visual_desc = ""
                    if ideas and isinstance(ideas, list):
                        idea = ideas[0]
                        if idea.get("hook"):
                            _ctx_parts.append(f"hook: {idea['hook']}")
                        _angle = idea.get("reasoning") or idea.get("rationale")
                        if _angle:
                            _ctx_parts.append(f"angle: {str(_angle)[:150]}")
                        _pred = idea.get("predicted_engagement") or idea.get("engagement_prediction")
                        if _pred:
                            _ctx_parts.append(f"audience note: {str(_pred)[:100]}")
                        # visual_description is authored specifically as an image prompt —
                        # feed it to the concept/elaboration steps instead of dropping it.
                        _visual_desc = str(idea.get("visual_description") or "")[:600]
                _ctx_parts.append(request.message)
                _ctx = "; ".join(filter(None, _ctx_parts))[:600]
                image_result = await generate_social_image(
                    topic, platform,
                    use_logo=use_logo, use_mascot=use_mascot,
                    user_id=request.user_id,
                    organization_id=request.organization_id,
                    brand_kit=brand_kit,
                    context_hints=_ctx,
                    concept_hint=_visual_desc,
                )

                response.image = image_result
                # Inject image into action_result at the top level (all card types use result.image)
                if response.action_result:
                    response.action_result["image"] = image_result.model_dump()
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
                from core.image_gen import _fetch_asset, generate_social_image
                from core.models import ImageResult
                args = modify_call["arguments"]
                use_logo: bool = bool(args.get("use_logo", False))
                use_mascot: bool = bool(args.get("use_mascot", False))
                topic: str = args.get("topic", "content")
                platform: str = args.get("platform", "linkedin")
                aspect_ratio: str = args.get("aspect_ratio", "1:1")
                style_changes: str = args.get("style_changes", "")
                _ctx = (style_changes or request.message or "")[:500]
                last_image_url: str = request.metadata.get("last_image_url", "")

                brand_kit = await load_brand_kit(request.organization_id)

                original_bytes = await _fetch_asset(last_image_url) if last_image_url else None

                if original_bytes:
                    edit_images: list[bytes] = [original_bytes]
                    asset_instructions: list[str] = []

                    # Only add logo/mascot as a NEW reference image if the user's message
                    # explicitly mentions the logo or brand. If they ask for other visual
                    # changes (colour, cartoons, etc.), the logo is already in ref image 1
                    # and adding it again causes repositioning/duplication.
                    user_text_lower = (style_changes + " " + request.message).lower()
                    logo_mentioned = any(kw in user_text_lower for kw in [
                        "logo", "brand", "mark", "icon", "badge",
                    ])
                    mascot_mentioned = any(kw in user_text_lower for kw in ["mascot", "character"])

                    if use_logo and logo_mentioned and brand_kit and brand_kit.logo_url:
                        logo_bytes = await _fetch_asset(brand_kit.logo_url)
                        if logo_bytes:
                            edit_images.append(logo_bytes)
                            asset_instructions.append(
                                f"Reference image {len(edit_images)} is the brand logo. "
                                "Composite it into reference image 1. Reproduce the logo exactly — "
                                "exact shape, colours, proportions. If the logo has a background colour, "
                                "ignore it and composite only the logo mark with no white box or border. "
                                "Place it in the bottom-right corner, occupying 8-12% of image width."
                            )

                    if use_mascot and mascot_mentioned and brand_kit and brand_kit.mascot_url:
                        mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
                        if mascot_bytes:
                            edit_images.append(mascot_bytes)
                            asset_instructions.append(
                                f"Reference image {len(edit_images)} is the brand mascot. "
                                "Add it to reference image 1 as a natural supporting element."
                            )

                    style_desc = style_changes.strip() if style_changes.strip() else request.message.strip()
                    changes_parts: list[str] = []
                    if style_desc:
                        changes_parts.append(style_desc)
                    for instr in asset_instructions:
                        changes_parts.append(instr)
                    if not changes_parts:
                        changes_parts.append("apply the requested change")

                    edit_prompt = (
                        "Based on reference image 1, produce an updated version that applies ALL of the following changes:\n"
                        + "\n".join(f"- {p}" for p in changes_parts)
                        + "\n\nPreserve the original composition, typography, colour palette, layout, and all other "
                        "existing visual elements. The output should look like reference image 1 with only these additions applied. "
                        "TEXT FIDELITY: any text present in reference image 1 that is not itself being changed must be "
                        "reproduced letter-for-letter — never re-typeset, respell, paraphrase, or drop it."
                    )
                    b64 = await self.llm.generate_image_with_image_bytes(edit_prompt, edit_images, aspect_ratio=aspect_ratio)
                    response.image = ImageResult(image_base64=b64, content_type="image/png", prompt_used=edit_prompt)
                    # Signal TypeScript to update the original draft card's image in-place.
                    # Also override the response text so any accidental draft_content output
                    # is replaced with a concise confirmation.
                    response.action_id = "maya:modify-image"
                    response.action_result = {"image": response.image.model_dump()}
                    _summary = (style_changes.strip() or request.message.strip())[:120]
                    response.response = f"Done — updated the image: {_summary}."
                else:
                    new_image = await generate_social_image(
                        topic, platform,
                        use_logo=use_logo, use_mascot=use_mascot,
                        aspect_ratio=aspect_ratio,
                        user_id=request.user_id,
                        organization_id=request.organization_id,
                        brand_kit=brand_kit,
                        context_hints=_ctx,
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
                    "Regenerate or modify the image for a post already created in this conversation. "
                    "Use for ANY image change request: logo/mascot flags, visual style changes, "
                    "'make it more realistic', 'attention-grabbing', 'no transparent logo', 'bolder', 'darker mood', etc. "
                    "Do NOT use if no image has been generated yet — use draft_content instead."
                ),
                parameters=[
                    ToolParameter(name="topic", type="string", description="Same topic used for the original post in this conversation", required=True),
                    ToolParameter(name="platform", type="string", description="Same platform used for the original post", required=True),
                    ToolParameter(name="aspect_ratio", type="string", description="Same aspect ratio used for the original image (e.g. 1:1, 16:9)", required=False, default="1:1"),
                    ToolParameter(name="use_logo", type="boolean", description="Whether the logo should appear on the final image", required=True),
                    ToolParameter(name="use_mascot", type="boolean", description="Whether the mascot should appear in the final image", required=True),
                    ToolParameter(
                        name="style_changes",
                        type="string",
                        description=(
                            "Any visual or style changes requested beyond logo/mascot flags — "
                            "e.g. 'make it photorealistic', 'more attention-grabbing', 'render logo solid not transparent', "
                            "'darker mood', 'bold and energetic'. Copy the user's exact visual instruction here."
                        ),
                        required=False,
                        default="",
                    ),
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
        system = await self.build_system_prompt(user_id, organization_id, use_brand_kit=False)

        if name == "generate_ideas":
            platform = arguments.get("platform", "linkedin")
            topic_hint = arguments.get("topic_hint", "")
            count = arguments.get("count", 3)
            rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
            now_iso = datetime.now(timezone.utc).isoformat()
            topic_line = f"Generate {count} high-performing content ideas for {platform} about: {topic_hint}"
            prompt = (
                build_ideas_prompt(platform, count, rules, topic_line)
                + '\nReturn ONLY a JSON object of the shape {"ideas": [ ... ]} with the fields above per idea.'
            )
            try:
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                )
                ideas = data.get("ideas", data if isinstance(data, list) else [])
                return json.dumps({"ideas": ideas, "generated_at": now_iso})
            except Exception:
                return json.dumps({"ideas": [], "generated_at": now_iso})

        elif name == "draft_content":
            topic = arguments.get("topic", "")
            platform = arguments.get("platform", "linkedin")
            tone = arguments.get("tone", "")
            from core.brand_kit import load_brand_kit, get_platform_tone
            brand_kit = await load_brand_kit(organization_id)
            tone = tone or get_platform_tone(brand_kit, platform)
            rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
            website_cta = ""
            if brand_kit.website_url:
                website_cta = f"\nInclude this link in the CTA where natural: {brand_kit.website_url}"
            prompt = (
                f"Write a {platform} post about this topic: {topic}\n\n"
                f"Tone: {tone}\n"
                f"Max {rules['max_chars']} chars. {rules['hashtag_count']} hashtags.\n"
                f"{website_cta}\n\n"
                f"{build_draft_rules(platform)}\n"
                "Return ONLY a JSON object (no markdown fences):\n"
                '{"draft": {"title": "short reference title", "body": "the full post body without hashtags", '
                '"hashtags": ["tag1", "tag2"], "cta": "the call-to-action text", '
                '"meta_description": "one sentence summary", '
                f'"word_count": 0, "platform": "{platform}", "tone_used": "{tone}", '
                '"meta_title": ""}}'
            )
            try:
                parsed = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                )
                # Ensure word_count is computed if LLM left it 0
                draft = parsed.get("draft", {})
                if not draft.get("word_count"):
                    draft["word_count"] = len(draft.get("body", "").split())
                parsed["draft"] = draft
                return json.dumps(parsed)
            except Exception:
                return json.dumps({"draft": {
                    "title": topic[:50], "body": "", "hashtags": [],
                    "cta": "", "meta_description": "", "meta_title": "",
                    "word_count": 0, "platform": platform, "tone_used": tone,
                }})

        elif name == "generate_variants":
            original = arguments.get("original_content", "")
            original_platform = arguments.get("original_platform", "linkedin")
            targets = arguments.get("target_platforms", [])
            from core.brand_kit import load_brand_kit
            brand_kit = await load_brand_kit(organization_id)
            website_cta = f"\nInclude this link where natural: {brand_kit.website_url}" if brand_kit.website_url else ""

            async def _adapt(platform: str) -> dict:
                rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
                prompt = (
                    f"Re-imagine this {original_platform} content as a NATIVE {platform} post:\n\n"
                    f"{original}\n\n"
                    f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags, "
                    f"tone: {rules['tone']}\n"
                    f"{website_cta}\n\n"
                    "RE-IMAGINE, DON'T SHORTEN: keep the core insight and any exact numbers, but rebuild the post "
                    "the way a native creator on that platform would write it — never just compress or truncate. "
                    "The hook must be rebuilt natively for the platform, never reused verbatim.\n\n"
                    "Return ONLY a JSON object (no markdown fences):\n"
                    '{"platform": "' + platform + '", "body": "adapted post body without hashtags", '
                    '"hashtags": ["tag1"], "char_count": 0, "title": ""}'
                )
                try:
                    obj = await self.llm.complete_json(
                        provider=self.default_provider, model=self.default_model,
                        system=system, messages=[{"role": "user", "content": prompt}],
                        temperature=0.7,
                    )
                    obj["char_count"] = len(obj.get("body", ""))
                    return obj
                except Exception:
                    return {"platform": platform, "body": "", "hashtags": [], "char_count": 0, "title": ""}

            import asyncio as _asyncio
            variant_dicts = await _asyncio.gather(*[_adapt(p) for p in targets])
            return json.dumps({"variants": list(variant_dicts)})

        elif name == "revise_content":
            original = arguments.get("original_content", "")
            feedback = arguments.get("feedback", "")
            platform = arguments.get("platform", "linkedin")
            rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
            prompt = (
                f"Revise this {platform} post based on feedback.\n\n"
                f"Original:\n{original}\n\n"
                f"Feedback: {feedback}\n\n"
                f"Platform rules — max {rules['max_chars']} chars, {rules['hashtag_count']} hashtags\n\n"
                "SURGICAL REVISION: change ONLY what the feedback requires — preserve every phrase, hook, and "
                "structural choice that already works. Each changes_made entry must quote the actual edit as a "
                "before → after fragment, never a vague description.\n\n"
                "Return ONLY a JSON object (no markdown fences):\n"
                '{"revised": {"body": "revised post body without hashtags", '
                '"hashtags": ["tag1"], "cta": "call to action", '
                f'"platform": "{platform}", "title": ""}}, '
                '"changes_made": ["change 1", "change 2"]}'
            )
            try:
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                    temperature=0.6,
                )
                return json.dumps(data)
            except Exception:
                return json.dumps({
                    "revised": {"body": original, "hashtags": [], "cta": "", "platform": platform, "title": ""},
                    "changes_made": [],
                })

        elif name == "modify_image":
            return "Image modification applied. The updated image will appear in the response."

        raise ValueError(f"Unknown tool: {name}")

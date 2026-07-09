import asyncio
import json
import logging
import re

from agents.base import BaseAgent
from core.config import settings
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter

_log = logging.getLogger(__name__)


class SageAgent(BaseAgent):
    slug = "sage"
    name = "Sage"
    personality = (
        "a senior SEO strategist and mentor who has ranked hundreds of websites and loves passing that knowledge on. "
        "You don't just run tasks — you teach the *why* behind every move so founders build real SEO intuition. "
        "After every action you give a concise '💡 What This Means' and a '➡️ Your Next Move' — making every interaction a learning moment. "
        "You're direct, confident, and specific. You name real frameworks (E-E-A-T, Topic Clusters, Hub-and-Spoke, TOFU/MOFU/BOFU) "
        "and explain them briefly when relevant. You treat founders as capable learners, not beginners. "
        "You celebrate wins with genuine enthusiasm, flag risks honestly, and always leave them with one clear action to take next."
    )
    default_provider = "openai"
    default_model = settings.SAGE_MODEL

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

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
            f"You are Sage — {self.personality}\n\n"
            f"## Client Context\n"
            f"Company: **{brand_kit.company_name}**\n"
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
            prompt += f"Competitors to outrank: {', '.join(str(c) for c in brand_kit.competitors)}\n"

        # Crawled site context — Sage uses this to write blog intros that
        # actually sound like the client and reference their real positioning.
        site_block = get_site_context_block(brand_kit)
        if site_block:
            prompt += "\n" + site_block + "\n"

        prompt += (
            "\n## Research Standards\n"
            "- Lead every response with the BLUF (Bottom Line Up Front): the single most important thing to do right now.\n"
            "- Label every claim: [FACT] for verified data, [INFERRED] for logical deductions, [ESTIMATED] for approximations.\n"
            "- Cite source URLs inline whenever you reference search results, competitor pages, or external data.\n"
            "- Use markdown tables for keyword comparisons, difficulty scores, or any structured comparison.\n"
            "- Never pad responses. If you don't have real data, say so explicitly.\n"
            "\n## SEO Standards\n"
            "- Identify search intent FIRST before any recommendation: informational / commercial / navigational / transactional.\n"
            "- Distinguish 'keyword' (specific query) from 'topic' (content cluster). Flag keyword cannibalization risks.\n"
            "- E-E-A-T signals are non-negotiable: first-hand experience, expert framing, specific data points, trust indicators.\n"
            "- Featured snippet structures win clicks: definition blocks, numbered steps, comparison tables.\n"
            "- Internal linking strategy matters as much as external. Every piece needs 2-3 internal link targets.\n"
            "- Every recommendation must connect to the client's business goal, not just traffic.\n"
            "\n## Tool Usage\n"
            "Use tools proactively — never answer SEO questions from memory alone:\n"
            "- keyword_research: any question about what to rank for, keyword strategy, content ideas\n"
            "- generate_blog: writing a blog post, article, or long-form content\n"
            "- analyze_content: auditing PASTED text or existing content the user shares directly — NOT for URLs\n"
            "- page_seo_audit: audit/review/analyse a specific page or domain — ALWAYS use this, NEVER write a text report\n"
            "- site_audit: ONLY when user explicitly says 'audit my whole site' or 'crawl all pages' — never for 'top N pages' requests\n"
            "- content_brief: planning before writing, briefing a writer, content strategy\n"
            "- web_search: SERP research, competitor analysis, finding real examples and data\n"
            "- serp_analysis: deep-dive a keyword's SERP features, PAA questions, and content format to beat\n"
            "- topical_map: build a full hub-and-spoke content cluster strategy for a topic area\n"
            "- meta_optimizer: write or rewrite meta title and description for maximum CTR\n"
        )
        prompt += (
            "\n## Mentor Posture — Always Do This\n"
            "After every tool result or analysis, include:\n"
            "  💡 **What This Means:** 1-2 sentences translating data into plain business impact.\n"
            "  ➡️ **Your Next Move:** the single highest-ROI action to take right now.\n"
            "This is non-negotiable. Every response ends with a clear next step.\n"
            "\n## SEO Frameworks to Use by Name\n"
            "- **Topic Clusters / Hub-and-Spoke** — pillar page + cluster pages for topical authority\n"
            "- **TOFU/MOFU/BOFU** — content mapped to top, middle, and bottom of funnel\n"
            "- **E-E-A-T** — Experience, Expertise, Authoritativeness, Trustworthiness signals\n"
            "- **Search Intent** — informational / navigational / commercial / transactional\n"
            "- **Content Velocity** — how frequently and consistently to publish\n"
            "- **Quick Wins vs Long-term Bets** — always flag which category a keyword falls into\n"
            "\n## Honest Mentor Standards\n"
            "- If a keyword is too competitive for their domain authority, say so directly and offer winnable alternatives.\n"
            "- If content is thin or poorly structured, say so — then give the specific fix.\n"
            "- Never hype a strategy that won't work at their stage. Calibrate advice to their actual domain authority level.\n"
            "- After keyword research: name the 3 keywords to target first and explain WHY (difficulty + volume + business fit).\n"
            "- After blog generation: give a 5-point pre-publish checklist.\n"
            "- After content audit: give a 30/60/90 day priority fix plan.\n"
            "\n## Conversational Style\n"
            "You're a real teammate who happens to love SEO — not a report generator. "
            "When someone says hi, thanks, 'great', 'perfect', 'got it', or anything casual — "
            "respond warmly and briefly in plain text. No tools, no reports. Just a genuine reply.\n"
        )
        prompt += self._core_response_style_block()
        _greeting = (
            "When greeting at the start of a conversation: be warm and enthusiastic — "
            "you love rankings and you're excited for every new challenge. "
            "Never say 'How can I assist you today?' — sound like a passionate teammate, not a bot.\n"
            if not has_history else
            self._mid_conversation_ack_block()
        )
        prompt += _greeting + (
            "\n## Your Domain\n"
            "SEO strategy, keyword research, content briefs, blog writing, content audits, "
            "SERP analysis, on-page optimization, content planning.\n"
            "\n## When to Redirect — Never Guess Outside Your Lane\n"
            "- Business metrics, MRR, ARR, burn rate, financial forecasting → "
            "'Rex is your analytics expert for that. Head to Rex's chat.'\n"
            "- Social media posts, Instagram/LinkedIn/Twitter content → "
            "'Maya handles social media content. Take that to Maya.'\n"
            "- Competitive intelligence, company profiling, market sizing → "
            "'Scout researches markets and competitors. Ask Scout.'\n"
            "- Contracts, legal compliance, IP, trademarks → "
            "'Lex handles legal matters.'\n"
            "- Email, calendar, meeting scheduling → "
            "'Vega manages inbox and scheduling. That's Vega's domain.'\n"
            "RULE: Never fabricate keyword volumes or traffic numbers as facts — label as [ESTIMATED]. "
            "Never give financial or legal advice — redirect to Rex or Lex.\n"
        )
        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        return prompt

    def get_tool_instructions(self) -> str:
        return (
            "\n\nNEVER use tools for: greetings, thanks, 'perfect', 'got it', 'ok', small talk, "
            "or anything that is not an SEO task. Respond to those warmly in plain text — no tools.\n\n"
            "Use your tools proactively for actual SEO work. NEVER write a raw text SEO report — always call the right tool and let the UI render it.\n\n"
            "## Tool routing\n"
            "- Keyword strategy → `keyword_research`\n"
            "- SERP landscape for a specific keyword → `serp_analysis`\n"
            "- Full topic cluster / content map → `topical_map`\n"
            "- Writing a blog post → `generate_blog`\n"
            "- Auditing pasted text → `analyze_content`\n"
            "- Content planning / writer brief → `content_brief`\n"
            "- Meta title / description → `meta_optimizer`\n"
            "- Ad-hoc SERP research → `web_search`\n"
            "- User gives a full URL (http/https) and asks for audit/report/analysis → `page_seo_audit`\n"
            "- User gives a domain only (e.g. 'veqiro.com') → prepend https:// and call `page_seo_audit`\n"
            "- User says 'audit my top N pages', 'audit my main pages', 'audit my key pages' without providing URLs "
            "→ ask: 'Which pages should I audit? Share the URLs and I'll run a full SEO audit on each.' "
            "Do NOT call `site_audit` for this — the user wants specific page reports, not a crawl.\n"
            "- User explicitly says 'audit my WHOLE site', 'crawl my entire site', 'audit ALL pages' → `site_audit`\n\n"
            "## CRITICAL rules for page_seo_audit\n"
            "1. NEVER write a text SEO report. Any request to audit/review/analyse a page = call `page_seo_audit`. No exceptions.\n"
            "2. If the user gives a domain without a path (e.g. 'veqiro.com' or 'https://veqiro.com'), pass it as-is — the tool handles homepages.\n"
            "3. `target_keyword` is REQUIRED. If the user does not provide one, ask: 'What keyword should this page rank for?' — then call the tool once they answer. Do not guess or skip it.\n"
            "4. If the user provides a URL and a keyword in the same message, call `page_seo_audit` immediately — no clarifying question needed.\n"
            "5. NEVER call `site_audit` for a single URL or 'top N pages' requests. `site_audit` is ONLY for explicit whole-site crawl requests.\n\n"
            "## When to use ask_agent\n"
            "- User wants social posts to promote the blog or content you wrote → call `ask_agent` with maya (include the content).\n"
            "- User wants competitive research or trending topics before writing → call `ask_agent` with scout first.\n"
            "- User asks about legal compliance of content (GDPR, copyright, claims) → call `ask_agent` with lex."
        )

    # ── Chat with RAG ingest of generated blog content ──────────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        response = await super().chat_sync(request)

        tool_calls = response.metadata.get("tool_calls", [])
        for tc in tool_calls:
            if tc["name"] == "generate_blog":
                try:
                    keyword = tc["arguments"].get("target_keyword", "blog")
                    await self.ingest_to_rag(
                        user_id=request.user_id,
                        text=response.response,
                        source_id=f"sage-blog-{request.conversation_id}",
                        metadata={"tool": "generate_blog", "keyword": keyword, "agent": "sage"},
                    )
                except Exception as e:
                    _log.warning("RAG ingest failed for sage blog: %s", e)

        return response

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="web_search",
                description=(
                    "Search Google for real SERP data, competitor blog posts, keyword competition, "
                    "and content gaps. Use BEFORE generating content or briefs to gather real-world "
                    "intelligence on what's ranking, what competitors are publishing, and what "
                    "questions people are asking.\n"
                    "Use when: you need real search data, want to see what's ranking for a keyword, "
                    "or want to find content gaps. Returns: search results with title, URL, snippet."
                ),
                parameters=[
                    ToolParameter(name="query", type="string", description="Search query — e.g. 'best AI tools for founders site:medium.com' or 'how to rank for AI productivity'", required=True),
                    ToolParameter(name="search_type", type="string", description="'search' for organic results, 'news' for recent articles", required=False, default="search", enum=["search", "news"]),
                ],
            ),
            ToolDefinition(
                name="keyword_research",
                description=(
                    "Generate a data-enriched keyword research report with intent mapping, difficulty "
                    "scores, and topic clusters. Combines real SERP competition data with LLM analysis.\n"
                    "Use when: the founder asks about keywords, what to rank for, content strategy, "
                    "SEO opportunities, or what topics to write about. "
                    "Returns: keywords with search intent, difficulty, relevance score, content type suggestion, and clusters."
                ),
                parameters=[
                    ToolParameter(name="seed_topic", type="string", description="Seed topic or keyword to research", required=True),
                    ToolParameter(name="niche", type="string", description="Industry niche for context (e.g. 'SaaS', 'fintech')", required=False, default=""),
                    ToolParameter(name="count", type="integer", description="Number of keywords to generate (default 10)", required=False, default=10),
                ],
            ),
            ToolDefinition(
                name="generate_blog",
                description=(
                    "Generate a full SEO-optimized blog post with proper heading structure (H1/H2/H3), "
                    "meta title, meta description, and keyword optimization throughout. Content is "
                    "tailored to the founder's brand voice and target audience.\n"
                    "Use when: the founder asks to write a blog post, article, or long-form content. "
                    "Returns: complete blog post ready to publish, with meta tags and headings."
                ),
                parameters=[
                    ToolParameter(name="topic", type="string", description="Blog post topic", required=True),
                    ToolParameter(name="target_keyword", type="string", description="Primary SEO keyword to rank for", required=True),
                    ToolParameter(name="secondary_keywords", type="array", description="Additional keywords to weave in naturally", required=False, items_type="string"),
                    ToolParameter(name="word_count", type="integer", description="Target word count (default 2000)", required=False, default=2000),
                    ToolParameter(name="output_format", type="string", description="Output format: markdown, html, wordpress, or wix", required=False, default="markdown", enum=["markdown", "html", "wordpress", "wix"]),
                ],
            ),
            ToolDefinition(
                name="analyze_content",
                description=(
                    "Audit existing content for SEO quality. Checks keyword usage, structure, readability, "
                    "and completeness. If a URL is provided, scrapes the live page for analysis.\n"
                    "Use when: the founder shares existing content and wants SEO feedback, wants to know "
                    "why a page isn't ranking, or wants an improvement plan. "
                    "Returns: SEO score (0-100), specific issues, actionable improvements, missing keywords, readability grade."
                ),
                parameters=[
                    ToolParameter(name="content", type="string", description="The content to analyze (or paste the text here if no URL)", required=True),
                    ToolParameter(name="target_keyword", type="string", description="The keyword this content should rank for", required=True),
                    ToolParameter(name="url", type="string", description="URL of the published page (optional — Sage will scrape it for richer analysis)", required=False),
                ],
            ),
            ToolDefinition(
                name="content_brief",
                description=(
                    "Generate a comprehensive SEO content brief — a detailed plan for writing a piece "
                    "that will rank. Includes heading structure, must-cover topics, competitor gaps, "
                    "and questions to answer. Scrapes competitor URLs if provided for real gap analysis.\n"
                    "Use when: the founder wants a content plan before writing, needs a brief for a writer, "
                    "or wants to understand what it takes to rank for a keyword. "
                    "Returns: structured brief with H2 outline, must-answer questions, competitor gaps, CTA."
                ),
                parameters=[
                    ToolParameter(name="topic", type="string", description="Topic for the content brief", required=True),
                    ToolParameter(name="target_keyword", type="string", description="Primary keyword to target", required=True),
                    ToolParameter(name="competitor_urls", type="array", description="URLs of competitor pages to analyze for gap insights (optional)", required=False, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="serp_analysis",
                description=(
                    "Deep-dive a keyword's SERP landscape. Surfaces real SERP features (featured snippet, "
                    "People Also Ask questions, image pack, video carousel), the content formats of the top "
                    "10 results, and a clear recommendation on the content angle and format needed to rank.\n"
                    "Use when: the founder asks if a keyword is winnable, what format to use, "
                    "how to capture a featured snippet, or what PAA questions to answer. "
                    "Returns: SERP features, PAA questions, recommended format, word-count range, featured snippet tip."
                ),
                parameters=[
                    ToolParameter(name="keyword", type="string", description="The exact keyword to analyse", required=True),
                ],
            ),
            ToolDefinition(
                name="topical_map",
                description=(
                    "Build a complete hub-and-spoke topic cluster map. Given a pillar topic, generates the "
                    "pillar page concept plus all cluster pages needed to build topical authority — each with "
                    "a target keyword, content type, funnel stage (TOFU/MOFU/BOFU), and priority order.\n"
                    "Use when: the founder wants a content strategy, asks what pages to build, wants to dominate "
                    "a topic area, or asks about topical authority. "
                    "Returns: pillar page, cluster pages with priorities, quick-win pick, estimated weeks to authority."
                ),
                parameters=[
                    ToolParameter(name="main_topic", type="string", description="The pillar topic to map (e.g. 'email marketing for SaaS')", required=True),
                    ToolParameter(name="site_stage", type="string", description="Domain stage: 'new', 'growing', or 'established' — adjusts keyword difficulty targets", required=False, default="new", enum=["new", "growing", "established"]),
                    ToolParameter(name="cluster_count", type="integer", description="Number of cluster pages to generate (default 8)", required=False, default=8),
                ],
            ),
            ToolDefinition(
                name="page_seo_audit",
                description=(
                    "Run a comprehensive deep-dive SEO audit of a single web page. Covers 7 dimensions: "
                    "URL analysis, technical SEO (title/meta/H1/schema), page speed signals from HTML, "
                    "image SEO, on-page content (keyword placement, density, LSI, PAA), E-E-A-T signals, "
                    "and competitive intelligence (competitor word counts, content gaps, SERP features). "
                    "Returns a rich visual card with overall score, critical issues, quick wins, and a 30/60/90-day action plan.\n"
                    "Use when: user asks for an SEO audit, report, review, analysis, or 'what's wrong' with any URL.\n"
                    "IMPORTANT: You MUST have both url AND target_keyword before calling this tool. "
                    "If target_keyword is missing, ask the user for it first — do not guess or skip it."
                ),
                parameters=[
                    ToolParameter(name="url", type="string", description="Full URL of the page to audit (must include https://)", required=True),
                    ToolParameter(name="target_keyword", type="string", description="The primary keyword this page should rank for in Google. REQUIRED — always ask the user if not provided.", required=True),
                ],
            ),
            ToolDefinition(
                name="site_audit",
                description=(
                    "Run a full-site SEO health check across ALL pages of a domain via sitemap crawl. "
                    "Use ONLY when the user explicitly asks to audit their whole website / all pages / entire site. "
                    "Do NOT use for a single URL — use page_seo_audit for that.\n"
                    "Use when: user says 'audit my whole site', 'check all my pages', 'site-wide SEO check'."
                ),
                parameters=[
                    ToolParameter(name="domain", type="string", description="Domain to audit, e.g. 'example.com' — no https:// needed", required=True),
                    ToolParameter(name="max_pages", type="integer", description="Max pages to analyze (default 10, max 20)", required=False, default=10),
                ],
            ),
            ToolDefinition(
                name="meta_optimizer",
                description=(
                    "Optimise or generate a meta title (≤60 chars) and meta description (≤160 chars) "
                    "for maximum click-through rate. Uses power words, matches search intent, and includes "
                    "the target keyword naturally. Provides 2 alternative variations.\n"
                    "Use when: the founder wants to improve CTR, has a page not getting clicks despite ranking, "
                    "or needs meta tags for a new page. "
                    "Returns: optimised title, description, character counts, 2 alternatives, and CTR tips."
                ),
                parameters=[
                    ToolParameter(name="target_keyword", type="string", description="Primary keyword for the page", required=True),
                    ToolParameter(name="page_topic", type="string", description="What the page is about", required=True),
                    ToolParameter(name="existing_title", type="string", description="Current meta title to improve (optional)", required=False),
                    ToolParameter(name="existing_description", type="string", description="Current meta description to improve (optional)", required=False),
                    ToolParameter(name="brand_name", type="string", description="Brand name to append to title, e.g. '| BrandName' (optional)", required=False),
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
        from agents.scout.scraper import serper_search, scrape_url, serper_search_rich

        # page_seo_audit and site_audit delegate to their own endpoints — skip
        # the expensive brand-kit fetch for those. Other LLM-based tools need it.
        if name in ("page_seo_audit", "site_audit"):
            return await self._execute_audit_tool(name, arguments, user_id, organization_id)

        # Brand kit is 5-min cached (already loaded by the chat turn), so including it here
        # is free — and the deliverable-generating calls need brand voice/industry/audience.
        system = await self.build_system_prompt(user_id, organization_id, use_brand_kit=True)

        if name == "web_search":
            try:
                query = arguments.get("query", "")
                search_type = arguments.get("search_type", "search")
                results = await serper_search(query, search_type)
                if not results:
                    return json.dumps({"results": [], "note": "No results found or search unavailable."})
                return json.dumps({"results": results, "query": query}, default=str)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "keyword_research":
            try:
                seed = arguments.get("seed_topic", "")
                niche = arguments.get("niche", "")
                count = arguments.get("count", 10)

                search_results = await serper_search(seed)
                serp_context = ""
                if search_results:
                    serp_context = "\n\nReal SERP competition (what's currently ranking):\n" + "\n".join(
                        f"- {r['title']}: {r['snippet']}" for r in search_results[:6]
                    )

                prompt = (
                    f"Generate {count} SEO keywords for: '{seed}'"
                    f"{f' in the {niche} niche' if niche else ''}."
                    f"{serp_context}\n\n"
                    "For each keyword provide: keyword, search_intent (informational/navigational/"
                    "transactional/commercial), estimated_difficulty (1-100), relevance_score (0.0-1.0), "
                    "suggested_content_type, related_keywords (list of 3). "
                    "Also provide keyword_clusters (array of objects with cluster_name, keywords list, primary_intent). "
                    "Return as JSON with keys: 'keywords' (array) and 'clusters' (array). "
                    "Return ONLY the JSON, no markdown fences."
                )
                try:
                    parsed = await self.llm.complete_json(
                        provider=self.default_provider, model=self.default_model,
                        system=system, messages=[{"role": "user", "content": prompt}],
                    )
                    return json.dumps(parsed)
                except Exception:
                    return json.dumps({"keywords": [], "clusters": []})
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "generate_blog":
            try:
                from core.brand_kit import load_brand_kit
                brand_kit = await load_brand_kit(organization_id)

                topic = arguments.get("topic", "")
                keyword = arguments.get("target_keyword", "")
                secondary = arguments.get("secondary_keywords", [])
                word_count = arguments.get("word_count", 2000)
                output_format = arguments.get("output_format", "markdown")

                website_cta = f"\nInclude this link naturally in CTAs: {brand_kit.website_url}" if brand_kit.website_url else ""

                prompt = (
                    f"Write a {word_count}-word SEO-optimized blog post for {brand_kit.company_name}.\n"
                    f"Topic: {topic}\n"
                    f"Primary keyword: {keyword}\n"
                    f"Secondary keywords: {', '.join(secondary) if secondary else 'None'}\n"
                    f"Brand voice: {brand_kit.brand_voice}\n"
                    f"Target audience: {brand_kit.target_audience}\n"
                    f"Format: {output_format}\n"
                    f"{website_cta}\n\n"
                    "Requirements:\n"
                    "- Start with: 'Meta Title: <title under 60 chars>' then 'Meta Description: <under 160 chars>'\n"
                    "- Then the full blog post beginning with a H1 heading\n"
                    "- Include keyword in H1, first paragraph, and naturally throughout\n"
                    "- Use H2/H3 subheadings for structure\n"
                    "- Structure for featured snippets (use definition blocks, numbered lists, tables)\n"
                    "- End with a strong CTA\n"
                    "- Apply E-E-A-T: include specific data points, examples, or expert framing\n"
                )
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=4096,
                )

                # Extract meta fields from first lines
                meta_title = f"{keyword} | Guide"
                meta_description = f"Complete guide to {keyword}."
                content_lines = raw.splitlines()
                body_start = 0
                for i, line in enumerate(content_lines[:6]):
                    stripped = line.strip()
                    if stripped.lower().startswith("meta title:"):
                        meta_title = stripped.split(":", 1)[1].strip()[:60]
                        body_start = i + 1
                    elif stripped.lower().startswith("meta description:"):
                        meta_description = stripped.split(":", 1)[1].strip()[:160]
                        body_start = i + 1

                blog_content = "\n".join(content_lines[body_start:]).strip()
                headings = re.findall(r"^#{1,3}\s+(.+)$", blog_content, re.MULTILINE)
                h1 = headings[0] if headings else topic
                slug = re.sub(r"[^a-z0-9-]", "", keyword.lower().replace(" ", "-"))

                wp_format = None
                wix_format = None
                if output_format in ("wordpress", "wix"):
                    from agents.sage.wordpress import format_for_wordpress, format_for_wix
                    if output_format == "wordpress":
                        wp_format = format_for_wordpress(topic, blog_content, tags=secondary)
                    else:
                        wix_format = format_for_wix(topic, blog_content, excerpt=f"Guide to {keyword}", tags=secondary)

                result = {
                    "blog": {
                        "title": h1,
                        "meta_title": meta_title,
                        "meta_description": meta_description,
                        "slug": slug,
                        "content": blog_content,
                        "word_count": len(blog_content.split()),
                        "headings": headings[:10],
                        "target_keyword": keyword,
                        "secondary_keywords": secondary or [],
                        "wordpress_format": wp_format,
                        "wix_format": wix_format,
                    },
                    "seo_score": 70,
                    "seo_suggestions": [
                        "Add more LSI keywords throughout",
                        "Include a table of contents",
                        "Add 2+ internal links to related posts",
                    ],
                }
                return json.dumps(result)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "analyze_content":
            try:
                content = arguments.get("content", "")
                keyword = arguments.get("target_keyword", "")
                url = arguments.get("url", "")

                if url:
                    try:
                        scraped = await scrape_url(url)
                        if scraped and len(scraped) > len(content):
                            content = scraped
                    except Exception:
                        pass  # Fall back to provided content

                prompt = (
                    f"Perform a detailed SEO audit on this content.\n"
                    f"Target keyword: {keyword}\n"
                    f"{'URL: ' + url if url else ''}\n\n"
                    f"Content:\n{content[:3500]}\n\n"
                    "Provide a JSON response with:\n"
                    "- score: overall SEO score 0-100\n"
                    "- issues: list of specific problems found\n"
                    "- improvements: list of actionable fixes with priority (high/medium/low)\n"
                    "- missing_keywords: important related keywords that should be included\n"
                    "- readability_grade: Flesch-Kincaid grade level\n"
                    "- word_count: approximate word count\n"
                    "- keyword_density: estimated keyword density %\n"
                    "Return ONLY the JSON, no markdown fences."
                )
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                return json.dumps(data)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "content_brief":
            try:
                topic = arguments.get("topic", "")
                keyword = arguments.get("target_keyword", "")
                competitor_urls = arguments.get("competitor_urls", []) or []

                competitor_summaries = []
                for comp_url in competitor_urls[:3]:
                    try:
                        text = await scrape_url(comp_url)
                        competitor_summaries.append(f"URL: {comp_url}\nContent preview:\n{text[:1000]}")
                    except Exception:
                        pass

                competitor_context = ""
                if competitor_summaries:
                    competitor_context = "\n\nCompetitor content analysis:\n" + "\n\n---\n".join(competitor_summaries)
                else:
                    # Use Serper to find what's ranking
                    serp = await serper_search(keyword)
                    if serp:
                        competitor_context = "\n\nCurrently ranking pages:\n" + "\n".join(
                            f"- {r['title']}: {r['snippet']}" for r in serp[:5]
                        )

                prompt = (
                    f"Create a comprehensive SEO content brief.\n"
                    f"Topic: {topic}\n"
                    f"Target keyword: {keyword}\n"
                    f"{competitor_context}\n\n"
                    "Include in the brief:\n"
                    "- search_intent: primary intent of this keyword\n"
                    "- recommended_word_count: based on competitor benchmarks\n"
                    "- content_type: format that will rank best\n"
                    "- title_options: 3 compelling title variations\n"
                    "- h2_structure: ordered list of H2 headings\n"
                    "- must_include_topics: topics that must be covered\n"
                    "- must_answer_questions: specific questions the content must answer\n"
                    "- competitor_gaps: what competitors are missing that we can own\n"
                    "- internal_linking_opportunities: related content to link to\n"
                    "- cta_recommendation: what action the reader should take\n"
                    "- estimated_traffic_potential: realistic monthly traffic estimate\n"
                    "Return as structured JSON. Return ONLY the JSON, no markdown fences."
                )
                raw_data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                wrapped = raw_data if "brief" in raw_data else {"brief": raw_data}
                return json.dumps(wrapped)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "serp_analysis":
            try:
                keyword = arguments.get("keyword", "")
                rich = await serper_search_rich(keyword)
                organic = rich.get("organic", [])
                paa = rich.get("paa", [])
                features = rich.get("serp_features", [])
                related = rich.get("related_searches", [])
                featured = rich.get("featured_snippet")

                context = f"Keyword: {keyword}\n"
                context += f"SERP features detected: {', '.join(features) if features else 'none'}\n"
                if featured:
                    context += f"Featured snippet box: {json.dumps(featured)[:300]}\n"
                if paa:
                    context += f"People Also Ask: {'; '.join(paa[:6])}\n"
                if related:
                    context += f"Related searches: {', '.join(related[:8])}\n"
                if organic:
                    context += "Top results:\n" + "\n".join(f"- {r['title']}: {r.get('snippet','')}" for r in organic[:8])

                prompt = (
                    f"{context}\n\n"
                    "Based on this real SERP data, provide a JSON analysis with:\n"
                    "- keyword: the keyword analysed\n"
                    "- serp_features: list of detected features\n"
                    "- paa_questions: People Also Ask questions (use the real ones above)\n"
                    "- top_result_formats: content formats appearing in top results (e.g. 'listicle', 'ultimate guide', 'tool', 'comparison')\n"
                    "- recommended_format: the exact format to use to compete\n"
                    "- recommended_word_count_range: e.g. '2,000–3,500 words'\n"
                    "- featured_snippet_opportunity: true/false\n"
                    "- featured_snippet_tip: how to capture it if opportunity exists\n"
                    "- competition_assessment: honest 1-sentence difficulty verdict\n"
                    "- content_angle: a distinctive angle to differentiate from what's ranking\n"
                    "Return ONLY JSON, no markdown fences."
                )
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                return json.dumps(data)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "topical_map":
            try:
                main_topic = arguments.get("main_topic", "")
                site_stage = arguments.get("site_stage", "new")
                cluster_count = arguments.get("cluster_count", 8)

                rich = await serper_search_rich(main_topic)
                organic = rich.get("organic", [])
                paa = rich.get("paa", [])
                related = rich.get("related_searches", [])

                difficulty_guidance = {
                    "new": "max difficulty 35 — target low-competition, long-tail keywords",
                    "growing": "difficulty up to 55 — mix of mid-competition keywords",
                    "established": "difficulty up to 75 — can target competitive head terms",
                }.get(site_stage, "max difficulty 35")

                context = f"Main topic: {main_topic}\nSite stage: {site_stage} ({difficulty_guidance})\n"
                if paa:
                    context += f"Questions people ask: {'; '.join(paa[:6])}\n"
                if related:
                    context += f"Related searches: {', '.join(related[:8])}\n"
                if organic:
                    context += "What's currently ranking:\n" + "\n".join(f"- {r['title']}" for r in organic[:6])

                prompt = (
                    f"{context}\n\n"
                    f"Create a hub-and-spoke topic cluster map with 1 pillar page and {cluster_count} cluster pages.\n"
                    "Each page needs: title, target_keyword, content_type (e.g. 'How-to guide', 'Listicle', 'Comparison', 'Tool/Calculator', 'Case study'), "
                    "funnel_stage (TOFU/MOFU/BOFU), search_intent (informational/commercial/transactional/navigational), "
                    "estimated_difficulty (int 1-100 respecting the site stage guidance above), priority (int, 1=write first).\n\n"
                    "Return JSON with:\n"
                    "- pillar_topic: string\n"
                    "- pillar_page: page object\n"
                    "- cluster_pages: array of page objects\n"
                    "- strategy_summary: 2-3 sentence explanation\n"
                    "- estimated_weeks_to_authority: e.g. '12-16 weeks at 2 posts/week'\n"
                    "- quick_win_page: the single cluster page to write first for fastest results (full page object)\n"
                    "Return ONLY JSON, no markdown fences."
                )
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                    max_tokens=3000,
                )
                return json.dumps(data)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "meta_optimizer":
            try:
                from core.brand_kit import load_brand_kit
                brand_kit = await load_brand_kit(organization_id)

                keyword = arguments.get("target_keyword", "")
                page_topic = arguments.get("page_topic", "")
                existing_title = arguments.get("existing_title", "")
                existing_desc = arguments.get("existing_description", "")
                brand_name = arguments.get("brand_name", "") or brand_kit.company_name or ""

                existing_ctx = ""
                if existing_title:
                    existing_ctx += f"Current title ({len(existing_title)} chars): {existing_title}\n"
                if existing_desc:
                    existing_ctx += f"Current description ({len(existing_desc)} chars): {existing_desc}\n"

                prompt = (
                    f"Optimise meta tags for maximum CTR.\n"
                    f"Target keyword: {keyword}\n"
                    f"Page topic: {page_topic}\n"
                    f"Brand name: {brand_name}\n"
                    f"{existing_ctx}\n"
                    "Rules:\n"
                    "- Meta title: MUST be ≤60 characters. Include keyword naturally. Use a power word. Optionally append '| Brand' if it fits.\n"
                    "- Meta description: MUST be ≤160 characters. Include keyword. State the clear benefit. End with a subtle CTA.\n"
                    "- Provide 2 alternative title+description pairs.\n"
                    "- Explain 3 specific reasons these will improve CTR.\n\n"
                    "Return JSON with:\n"
                    "- meta_title: string (≤60 chars)\n"
                    "- meta_title_chars: int\n"
                    "- meta_description: string (≤160 chars)\n"
                    "- meta_description_chars: int\n"
                    "- alternatives: array of 2 objects each with meta_title and meta_description\n"
                    "- ctr_tips: array of 3 strings\n"
                    "Return ONLY JSON, no markdown fences."
                )
                data = await self.llm.complete_json(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                return json.dumps(data)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        raise ValueError(f"Unknown tool: {name}")

    async def _execute_audit_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str,
    ) -> str:
        try:
            import httpx
            from core.config import settings as _cfg
            _hdrs = {"X-Internal-Api-Key": _cfg.INTERNAL_API_KEY}
            if name == "page_seo_audit":
                async with httpx.AsyncClient(timeout=90) as client:
                    resp = await client.post(
                        "http://127.0.0.1:8000/ai/sage/page-audit",
                        headers=_hdrs,
                        json={
                            "url": arguments.get("url", ""),
                            "target_keyword": arguments.get("target_keyword", ""),
                            "user_id": user_id,
                            "organization_id": organization_id,
                        },
                    )
                    return json.dumps(resp.json(), default=str)
            else:
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(
                        "http://127.0.0.1:8000/ai/sage/site-audit",
                        headers=_hdrs,
                        json={
                            "domain": arguments.get("domain", ""),
                            "max_pages": arguments.get("max_pages", 10),
                            "user_id": user_id,
                            "organization_id": organization_id,
                        },
                    )
                    return json.dumps(resp.json(), default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "tool": name})

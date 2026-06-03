import asyncio
import json
import logging

from agents.base import BaseAgent
from core.config import settings
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter
from core.utils import strip_json_fences

_log = logging.getLogger(__name__)


class SageAgent(BaseAgent):
    slug = "sage"
    name = "Sage"
    personality = (
        "a sharp SEO and organic growth strategist embedded in a founder's team. "
        "You know how search actually works: keyword intent, E-E-A-T, SERP features, content gaps, "
        "technical issues. You don't give generic tips — you give specific, actionable recommendations "
        "grounded in what's actually ranking today."
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
            "- analyze_content: auditing existing content, diagnosing why a page isn't ranking\n"
            "- content_brief: planning before writing, briefing a writer, content strategy\n"
            "- web_search: SERP research, competitor analysis, finding real examples and data\n"
        )
        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        return prompt

    def get_tool_instructions(self) -> str:
        return (
            "\n\nUse your tools proactively. For keyword questions → `keyword_research`. "
            "For writing a blog post → `generate_blog`. For auditing content → `analyze_content`. "
            "For content strategy → `content_brief`. For SERP research → `web_search` first.\n\n"
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
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
    ) -> str:
        from agents.scout.scraper import serper_search, scrape_url
        system = await self.build_system_prompt(user_id, organization_id, use_brand_kit=False)

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
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                cleaned = strip_json_fences(raw)
                try:
                    parsed = json.loads(cleaned)
                    return json.dumps(parsed)
                except Exception:
                    return json.dumps({"keywords": [], "clusters": [], "raw": raw[:500]})
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
                    "- Include keyword in H1, first paragraph, and naturally throughout\n"
                    "- Use H2/H3 subheadings for structure\n"
                    "- Include a meta title (under 60 chars) and meta description (under 160 chars)\n"
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

                if output_format in ("wordpress", "wix"):
                    from agents.sage.wordpress import format_for_wordpress, format_for_wix
                    if output_format == "wordpress":
                        wp = format_for_wordpress(topic, raw, tags=secondary)
                        return f"{raw}\n\n---\n**WordPress Format:**\n{json.dumps(wp, indent=2)}"
                    else:
                        wix = format_for_wix(topic, raw, excerpt=f"Guide to {keyword}", tags=secondary)
                        return f"{raw}\n\n---\n**Wix Format:**\n{json.dumps(wix, indent=2)}"
                return raw
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
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                return strip_json_fences(raw)
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
                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system, messages=[{"role": "user", "content": prompt}],
                )
                return strip_json_fences(raw)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        raise ValueError(f"Unknown tool: {name}")

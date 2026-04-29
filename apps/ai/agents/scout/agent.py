import asyncio
import json
import logging
from datetime import datetime, timezone

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter
from core.config import settings

logger = logging.getLogger(__name__)


class ScoutAgent(BaseAgent):
    slug = "scout"
    name = "Scout"
    personality = (
        "the research and competitive intel person on the team. You dig into markets, competitors, "
        "and trends and give the founder the actual picture — not a sanitised summary. "
        "You separate what's confirmed from what's your read on it, and you skip the padding. "
        "Think sharp analyst, not consultant deck."
    )
    default_provider = "openai"
    default_model = settings.SCOUT_MODEL

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## MANDATORY Tool Usage Rules\n"
            "You MUST use tools for any competitive, market, or company research question — "
            "even follow-up questions that build on conversation history. "
            "NEVER answer competitive intelligence questions from memory alone.\n\n"
            "**Tool selection guide:**\n"
            "- Any question about a specific company → call `research_company` for that company\n"
            "- Comparative question ('which has better X?') → call `research_company` for EACH company, then synthesize in a table\n"
            "- Trends, market data, recent events → call `web_search` (quick lookup) or `research_topic` (full report)\n"
            "- 'Who are my competitors?' or 'find competitors for X' → call `discover_competitors`\n"
            "- Industry trends and content angles → call `trending_topics`\n\n"
            "After gathering real data with tools, synthesize it using the output format below.\n\n"
            "## When to use ask_agent\n"
            "- Research done, user wants a social post → call `ask_agent` with maya (pass full research context).\n"
            "- User wants an SEO blog from the research → call `ask_agent` with sage.\n"
            "- Legal compliance question → call `ask_agent` with lex.\n"
            "Call research tools FIRST, then delegate content creation."
        )

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
        use_brand_kit: bool = True,
    ) -> str:
        today = datetime.now(timezone.utc).strftime("%B %d, %Y")

        company_name = "your client"
        prompt = (
            "You are Scout — a sharp market intelligence analyst embedded in a founder's team. "
            "You deliver the actual competitive picture: specific, sourced, and strategically actionable. "
            "No consultant fluff, no sanitised summaries. "
            "Think ex-strategy analyst who has seen the real numbers — not a search engine regurgitating headlines.\n\n"
            f"**Today's date: {today}**\n"
        )

        if use_brand_kit:
            from core.brand_kit import load_brand_kit, get_site_context_block
            brand_kit = await load_brand_kit(organization_id)
            company_name = brand_kit.company_name
            prompt += (
                f"**You are researching on behalf of: {brand_kit.company_name}**\n"
                f"Industry: {brand_kit.industry}\n"
                f"Target Audience: {brand_kit.target_audience}\n"
            )
            if brand_kit.value_proposition:
                prompt += f"Value Proposition: {brand_kit.value_proposition}\n"
            prompt += f"Key Differentiators: {brand_kit.key_differentiators}\n"
            if brand_kit.competitors:
                prompt += f"Known Competitors: {', '.join(str(c) for c in brand_kit.competitors)}\n"
            if brand_kit.website_url:
                prompt += f"Founder's Website: {brand_kit.website_url}\n"
            site_block = get_site_context_block(brand_kit)
            if site_block:
                prompt += "\n" + site_block + "\n"

        prompt += (
            "\n## Research Standards\n"
            "1. **BLUF first** — open every response with a 1-2 sentence bottom line. Evidence follows.\n"
            "2. **Label every claim**: [FACT] for verified data, [INFERRED] for logical conclusions, [ESTIMATED] for approximations.\n"
            "3. **Cite inline** — link source URLs directly after any claim that came from the web.\n"
            "4. **Use tables** for any comparison of 2+ companies or data points.\n"
            f"5. **Strategic implications** — end every competitive analysis with a 'So what for {company_name}?' block.\n"
            "6. **Highlight gaps** — competitor weaknesses are the founder's opportunities; call them out explicitly.\n"
            f"7. **Recency matters** — today is {today}. Flag data older than 6 months. Always prefer the most recent sources.\n\n"
            "## Output Format\n"
            "For competitive analyses:\n"
            "  - Bottom line (1-2 sentences)\n"
            "  - Comparison table (if multiple companies)\n"
            "  - Key findings with [FACT/INFERRED/ESTIMATED] labels and source links\n"
            f"  - Strategic implications for {company_name}\n\n"
            "For market research:\n"
            "  - Bottom line\n"
            "  - Market size & trajectory (with source)\n"
            "  - Key players & positioning\n"
            "  - Opportunities and threats\n"
            "  - Recommended actions\n\n"
            "For trend reports:\n"
            "  - Bottom line\n"
            "  - Ranked trends with momentum signal\n"
            "  - Content/product angle for each\n\n"
            "## Tool Usage\n"
            "Always use tools — never answer from memory alone. "
            "Use research_company for companies, research_topic for markets, "
            "web_search for live data, discover_competitors to find who's competing, "
            "trending_topics for market signals.\n"
        )

        if extra_context:
            prompt += f"\nAdditional Context:\n{extra_context}\n"
        return prompt

    # ── Chat with RAG ingest of research results ────────────────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        response = await super().chat_sync(request)

        tool_calls = response.metadata.get("tool_calls", [])
        for tc in tool_calls:
            if tc["name"] in {"research_topic", "research_company"}:
                try:
                    topic = (
                        tc["arguments"].get("topic")
                        or tc["arguments"].get("company_name", "research")
                    )
                    await self.ingest_to_rag(
                        user_id=request.user_id,
                        text=response.response,
                        source_id=f"scout-{tc['name']}-{request.conversation_id}",
                        metadata={"tool": tc["name"], "topic": topic, "agent": "scout"},
                    )
                except Exception as rag_err:
                    logger.warning("RAG ingest failed for %s (conv %s): %s", tc["name"], request.conversation_id, rag_err)

        return response

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="web_search",
                description=(
                    "Search Google for real-time information. Use for any live lookup — competitor news, "
                    "recent product launches, pricing changes, funding rounds, job postings, or any "
                    "question that needs current data. Returns titles, URLs, and snippets from Google.\n"
                    "Use when: the user asks about recent events, wants to look something up, or you need "
                    "fresh data before answering. Returns: list of search results with title, link, snippet."
                ),
                parameters=[
                    ToolParameter(name="query", type="string", description="Search query to run on Google", required=True),
                    ToolParameter(name="search_type", type="string", description="'search' for organic results, 'news' for recent news articles", required=False, default="search", enum=["search", "news"]),
                ],
            ),
            ToolDefinition(
                name="research_topic",
                description=(
                    "Deep research on any market, technology, or business topic. Combines web search results "
                    "with LLM synthesis to produce a comprehensive intelligence report.\n"
                    "Use when: the user wants research on a topic, market analysis, understanding a technology, "
                    "or broad competitive landscape. Returns: findings report, key insights, related keywords."
                ),
                parameters=[
                    ToolParameter(name="topic", type="string", description="The topic or market to research in depth", required=True),
                    ToolParameter(name="depth", type="string", description="'quick' (overview), 'standard' (detailed), 'deep' (exhaustive)", required=False, default="standard", enum=["quick", "standard", "deep"]),
                    ToolParameter(name="sources_hint", type="array", description="Specific URLs to include as research sources", required=False, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="research_company",
                description=(
                    "Build a comprehensive intelligence profile on any company — competitor, partner, investor, "
                    "or acquisition target. Uses web search + scraping to gather real data.\n"
                    "Use when: the user asks about a specific company, wants competitor analysis, wants to "
                    "understand a player in their market. Returns: company profile with features, pricing, "
                    "strengths, weaknesses, recent news, and strategic implications."
                ),
                parameters=[
                    ToolParameter(name="company_name", type="string", description="Name of the company to research", required=True),
                    ToolParameter(name="company_url", type="string", description="Company website URL (optional — Scout will find it if not provided)", required=False),
                ],
            ),
            ToolDefinition(
                name="trending_topics",
                description=(
                    "Discover what's trending in a given industry — rising topics, content opportunities, "
                    "emerging conversations. Uses real-time news search for current signals.\n"
                    "Use when: the user asks about trends, what's hot in their industry, content ideas "
                    "based on market momentum, or wants to spot emerging opportunities. "
                    "Returns: trending topics with momentum, relevance score, and content angle."
                ),
                parameters=[
                    ToolParameter(name="industry", type="string", description="Industry or niche to find trends in (e.g. 'SaaS', 'fintech', 'AI productivity')", required=True),
                    ToolParameter(name="count", type="integer", description="Number of trending topics to return (default 5)", required=False, default=5),
                ],
            ),
            ToolDefinition(
                name="discover_competitors",
                description=(
                    "Find competitors for a business using live web research. Returns a structured list of "
                    "competitor companies with URLs, why they compete, and their pricing model.\n"
                    "Use when: the user asks 'who are my competitors?', 'find alternatives to X', "
                    "'what tools compete with my product?', or wants to build a competitor watchlist. "
                    "Returns: list of competitors with name, URL, why_competitive, pricing_model."
                ),
                parameters=[
                    ToolParameter(name="description", type="string", description="Brief description of the product/business to find competitors for", required=True),
                    ToolParameter(name="industry", type="string", description="Industry or category (e.g. 'AI productivity SaaS', 'fintech', 'developer tools')", required=True),
                    ToolParameter(name="count", type="integer", description="Number of competitors to return (default 8)", required=False, default=8),
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
        from agents.scout.scraper import scrape_url, google_autocomplete, serper_search

        today = datetime.now(timezone.utc).strftime("%B %d, %Y")
        year = datetime.now(timezone.utc).year
        system = await self.build_system_prompt(user_id, organization_id)

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

        elif name == "research_topic":
            try:
                topic = arguments.get("topic", "")
                sources = arguments.get("sources_hint", []) or []

                keywords, search_results, news_results = await asyncio.gather(
                    google_autocomplete(topic),
                    serper_search(f"{topic} {year}"),
                    serper_search(f"{topic} news {year}", search_type="news"),
                )

                async def _safe_scrape(url: str) -> str | None:
                    try:
                        return (await scrape_url(url))[:2000]
                    except Exception:
                        return None

                scraped_texts = [t for t in await asyncio.gather(*[_safe_scrape(u) for u in sources[:3]]) if t]

                context = f"Topic: {topic}\nToday: {today}\nRelated keywords: {keywords[:10]}"
                if search_results:
                    context += "\n\nWeb search results:\n" + "\n".join(
                        f"- {r['title']}: {r['snippet']} ({r['link']})" for r in search_results[:8]
                    )
                if news_results:
                    context += "\n\nRecent news:\n" + "\n".join(
                        f"- {r['title']}: {r['snippet']} ({r['link']})" for r in news_results[:6]
                    )
                if scraped_texts:
                    context += "\n\nScraped sources:\n" + "\n\n---\n\n".join(scraped_texts)

                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Today is {today}. Research and synthesize a comprehensive intelligence report on:\n{context}\n\n"
                        "Structure: Key Findings, Market Size & Trends, Key Players, Strategic Opportunities, Risks. "
                        "Identify specific implications for the founder. Use [FACT/INFERRED/ESTIMATED] labels."
                    )}],
                )
                return json.dumps({
                    "findings": raw,
                    "keywords_found": keywords[:10],
                    "sources_scraped": sources[:3],
                    "web_results_count": len(search_results),
                }, default=str)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "research_company":
            try:
                company_name = arguments.get("company_name", "")
                url = arguments.get("company_url") or f"https://{company_name.lower().replace(' ', '')}.com"

                # 6 parallel searches + homepage scrape
                (
                    results_features,
                    results_funding,
                    results_reviews,
                    results_news,
                    results_jobs,
                    results_vs,
                    scraped_content,
                ) = await asyncio.gather(
                    serper_search(f"{company_name} features pricing plans {year}"),
                    serper_search(f"{company_name} funding raised investors {year}"),
                    serper_search(f"{company_name} reviews complaints reddit g2 trustpilot"),
                    serper_search(f"{company_name} news announcement launch {year}", search_type="news"),
                    serper_search(f"{company_name} hiring jobs team size {year}"),
                    serper_search(f"{company_name} vs alternatives competitors"),
                    scrape_url(url),
                )

                def _fmt(results: list, label: str, n: int = 5) -> str:
                    if not results:
                        return ""
                    lines = "\n".join(f"- {r['title']}: {r['snippet']} ({r['link']})" for r in results[:n])
                    return f"\n\n### {label}\n{lines}"

                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Today is {today}. Build the most comprehensive competitive intelligence profile possible for: **{company_name}**\n\n"
                        f"Homepage content:\n{scraped_content[:3000]}"
                        f"{_fmt(results_features, 'Features & Pricing')}"
                        f"{_fmt(results_funding, 'Funding & Investors')}"
                        f"{_fmt(results_news, 'Latest News & Announcements')}"
                        f"{_fmt(results_reviews, 'Customer Reviews & Sentiment')}"
                        f"{_fmt(results_jobs, 'Hiring & Team Growth Signals')}"
                        f"{_fmt(results_vs, 'Competitor Positioning')}\n\n"
                        "Produce a structured profile with these sections:\n"
                        "1. **Overview** — what they do, founding year, HQ, team size [FACT/ESTIMATED]\n"
                        "2. **Product & Features** — key capabilities, recent launches, roadmap signals\n"
                        "3. **Pricing** — tiers, price points, free tier details [FACT/INFERRED]\n"
                        "4. **Business Metrics** — ARR/MRR estimates, funding total, latest round, investors [FACT/ESTIMATED]\n"
                        "5. **Target Market** — ICP, use cases, segments they own vs. ignore\n"
                        "6. **Strengths** — what they do well [FACT/INFERRED]\n"
                        "7. **Weaknesses & Gaps** — where they fall short, customer complaints [FACT/INFERRED]\n"
                        "8. **Recent Moves** — last 90 days: product launches, hires, partnerships, PR\n"
                        "9. **Customer Sentiment** — what users love, what frustrates them, notable reviews\n"
                        "10. **So what?** — strategic implications for a competing founder: where to attack, what to avoid, how to position against them\n\n"
                        "Label every claim [FACT], [INFERRED], or [ESTIMATED]. Cite source URLs inline."
                    )}],
                )
                all_sources = [url] + [r["link"] for r in (results_features + results_funding + results_news)[:6]]
                return json.dumps({
                    "company": company_name,
                    "profile": raw,
                    "sources": list(dict.fromkeys(all_sources)),
                }, default=str)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "trending_topics":
            try:
                industry = arguments.get("industry", "")
                count = arguments.get("count", 5)

                keywords, news_results = await asyncio.gather(
                    google_autocomplete(industry),
                    serper_search(f"{industry} trends {year}", search_type="news"),
                )

                news_context = ""
                if news_results:
                    news_context = "\n\nRecent news signals:\n" + "\n".join(
                        f"- {r['title']}: {r['snippet']}" for r in news_results[:8]
                    )

                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Today is {today}. Identify {count} trending topics in {industry} based on real signals.\n"
                        f"Related keywords: {keywords[:10]}"
                        f"{news_context}\n\n"
                        "For each topic: topic name, momentum (rising/stable/declining), "
                        "relevance_score (0.0-1.0), content_angle, estimated search volume. "
                        "Focus on what a founder can act on now."
                    )}],
                )
                return raw
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "discover_competitors":
            try:
                description = arguments.get("description", "")
                industry = arguments.get("industry", "")
                count = arguments.get("count", 8)

                results_alternatives, results_best = await asyncio.gather(
                    serper_search(f"{industry} tools alternatives {year}"),
                    serper_search(f"best {industry} software {year}"),
                )

                all_results = results_alternatives[:6] + results_best[:6]
                search_context = "\n\nSearch results:\n" + "\n".join(
                    f"- {r['title']}: {r['snippet']} ({r['link']})" for r in all_results
                ) if all_results else ""

                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Today is {today}. Find {count} real competitors for: \"{description}\" in the {industry} space.\n"
                        f"{search_context}\n\n"
                        f"Return a JSON array of {count} competitors. Each object: "
                        "name (string), url (real URL), why_competitive (1 sentence), pricing_model (string). "
                        "Only real, verifiable companies. Return ONLY the JSON array."
                    )}],
                )
                return json.dumps({"competitors": raw, "industry": industry}, default=str)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        raise ValueError(f"Unknown tool: {name}")

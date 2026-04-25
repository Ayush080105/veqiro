import asyncio
import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter


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
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## MANDATORY Tool Usage Rules\n"
            "You MUST use tools for any competitive, market, or company research question — "
            "even follow-up questions that build on conversation history. "
            "NEVER answer competitive intelligence questions from memory alone.\n"
            "- Any question about a specific company → call `research_company` for that company\n"
            "- Any comparative question (e.g. 'which has the weakest X?') → call `research_company` "
            "for EACH company being compared, then synthesize\n"
            "- Any question about trends, market data, or recent events → call `web_search` or `research_topic`\n"
            "After gathering real data with tools, synthesize it into a clear, founder-focused analysis.\n\n"
            "## When to use ask_agent\n"
            "- Research is done and user wants a social post or caption written from your findings → call `ask_agent` with maya "
            "(include the research findings in the question so Maya has full context).\n"
            "- User wants an SEO blog article written from the research → call `ask_agent` with sage.\n"
            "- User asks about legal compliance of a company or contract you researched → call `ask_agent` with lex.\n"
            "Call your own research tools FIRST, then delegate content creation."
        )

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
    ) -> str:
        from core.brand_kit import load_brand_kit
        brand_kit = await load_brand_kit(organization_id)

        prompt = (
            f"You are Scout, {self.personality}\n\n"
            f"You are researching on behalf of: **{brand_kit.company_name}**\n"
            f"Industry: {brand_kit.industry}\n"
            f"Target Audience: {brand_kit.target_audience}\n"
            f"Key Differentiators: {brand_kit.key_differentiators}\n"
        )
        if brand_kit.competitors:
            prompt += f"Known Competitors: {', '.join(str(c) for c in brand_kit.competitors)}\n"
        if brand_kit.website_url:
            prompt += f"Founder's Website: {brand_kit.website_url}\n"

        prompt += (
            "\n## Research Principles\n"
            "1. Always separate facts (verified) from inferences (likely) from speculation (possible)\n"
            "2. Rate source reliability and recency\n"
            "3. Identify strategic implications for the founder's specific business, not just raw information\n"
            "4. Highlight competitor weaknesses as opportunities\n"
            "5. Be concise but thorough — give the founder what they need to make decisions\n"
            "6. When you have real web data, cite it; when synthesizing, say so\n\n"
            "## Tool Usage\n"
            "Use your tools proactively. Don't just answer from memory — search for fresh data. "
            "For competitor questions, use research_company. For general topics, use research_topic. "
            "For live news/prices/recent events, use web_search. "
            "For market trends, use trending_topics. "
            "For monitoring known competitors, use scan_competitors.\n"
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
                except Exception:
                    pass  # RAG ingest is best-effort

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
                name="scan_competitors",
                description=(
                    "Scan competitor websites to detect recent changes — pricing updates, new features, "
                    "messaging shifts, new pages. Uses content hashing to identify what changed.\n"
                    "Use when: the user wants to monitor competitors for changes, check if a competitor "
                    "has updated anything recently, or wants a competitive pulse check. "
                    "Returns: change detected (yes/no), summary of what changed, significance level."
                ),
                parameters=[
                    ToolParameter(
                        name="competitors",
                        type="array",
                        description="List of competitor names or website URLs to scan (e.g. ['Notion', 'https://clickup.com'])",
                        required=True,
                        items_type="string",
                    ),
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
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
    ) -> str:
        from agents.scout.scraper import scrape_url, google_autocomplete, hash_content, serper_search

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

                keywords, search_results = await asyncio.gather(
                    google_autocomplete(topic),
                    serper_search(topic),
                )

                async def _safe_scrape(url: str) -> str | None:
                    try:
                        return (await scrape_url(url))[:2000]
                    except Exception:
                        return None

                scrape_outcomes = await asyncio.gather(
                    *[_safe_scrape(u) for u in sources[:3]],
                )
                scraped_texts = [t for t in scrape_outcomes if t is not None]

                context = f"Topic: {topic}\nRelated keywords: {keywords[:10]}"
                if search_results:
                    search_summary = "\n".join(
                        f"- {r['title']}: {r['snippet']} ({r['link']})"
                        for r in search_results[:8]
                    )
                    context += f"\n\nWeb search results:\n{search_summary}"
                if scraped_texts:
                    context += "\n\nScraped sources:\n" + "\n\n---\n\n".join(scraped_texts)

                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Research and synthesize a comprehensive intelligence report on:\n{context}\n\n"
                        "Structure your response with: Key Findings, Market Size & Trends, "
                        "Key Players, Strategic Opportunities, and Risks. "
                        "Identify specific implications for the founder."
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

                search_results, scraped_content = await asyncio.gather(
                    serper_search(f"{company_name} company overview features pricing 2025"),
                    scrape_url(url),
                )

                search_context = ""
                if search_results:
                    search_context = "\n\nWeb search results:\n" + "\n".join(
                        f"- {r['title']}: {r['snippet']}" for r in search_results[:6]
                    )

                raw = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": (
                        f"Build a comprehensive competitive intelligence profile for: {company_name}\n"
                        f"Website content:\n{scraped_content[:2500]}"
                        f"{search_context}\n\n"
                        "Return a structured profile covering: description, founding/team size, funding, "
                        "key features, pricing tiers, target market, strengths, weaknesses, "
                        "recent news/moves, and strategic implications for a competing founder."
                    )}],
                )
                return json.dumps({
                    "company": company_name,
                    "profile": raw,
                    "sources": [url] + [r["link"] for r in search_results[:3]],
                }, default=str)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "scan_competitors":
            try:
                competitors_raw = arguments.get("competitors", [])

                async def _scan_one(item: str) -> dict:
                    if item.startswith("http"):
                        comp_url = item
                        comp_name = item.split("//")[-1].split("/")[0].replace("www.", "")
                    else:
                        comp_name = item
                        comp_url = f"https://{item.lower().replace(' ', '')}.com"

                    try:
                        content = await scrape_url(comp_url)
                        new_hash = hash_content(content)
                        snippet = content[:500] if content else ""
                        return {
                            "competitor": comp_name,
                            "url": comp_url,
                            "current_hash": new_hash,
                            "content_preview": snippet,
                            "status": "scanned",
                        }
                    except Exception as scrape_err:
                        return {
                            "competitor": comp_name,
                            "url": comp_url,
                            "status": "error",
                            "error": str(scrape_err),
                        }

                scan_results = await asyncio.gather(*[_scan_one(c) for c in competitors_raw[:5]])

                # Ask LLM to summarize changes/signals
                summary_prompt = (
                    f"Analyze these competitor scan results and provide a brief intelligence summary "
                    f"for each competitor. Identify any notable content, messaging shifts, or signals:\n\n"
                    f"{json.dumps(list(scan_results), default=str)}"
                )
                summary = await self.llm.complete(
                    provider=self.default_provider, model=self.default_model,
                    system=system,
                    messages=[{"role": "user", "content": summary_prompt}],
                )
                return json.dumps({
                    "scan_results": list(scan_results),
                    "intelligence_summary": summary,
                }, default=str)
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        elif name == "trending_topics":
            try:
                industry = arguments.get("industry", "")
                count = arguments.get("count", 5)

                keywords, news_results = await asyncio.gather(
                    google_autocomplete(industry),
                    serper_search(f"{industry} trends news 2025", search_type="news"),
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
                        f"Identify {count} trending topics in {industry} based on real signals.\n"
                        f"Related keywords: {keywords[:10]}"
                        f"{news_context}\n\n"
                        f"For each topic provide: topic name, momentum (rising/stable/declining), "
                        f"relevance_score (0.0-1.0), content_angle (how a founder could use this), "
                        f"and estimated search volume. Focus on opportunities for the founder."
                    )}],
                )
                return raw
            except Exception as e:
                return json.dumps({"error": str(e), "tool": name})

        raise ValueError(f"Unknown tool: {name}")

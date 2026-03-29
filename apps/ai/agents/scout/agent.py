import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.tools import ToolDefinition, ToolParameter


class ScoutAgent(BaseAgent):
    slug = "scout"
    name = "Scout"
    personality = (
        "Relentless researcher and competitive intelligence analyst. You dig deep into markets, "
        "competitors, and trends to uncover insights that give founders a strategic edge. "
        "You synthesize information from multiple sources into clear, actionable intelligence reports. "
        "You're thorough, objective, and always cite your reasoning."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        base = await super().build_system_prompt(user_id, extra_context)
        scout_specific = (
            "\n\nAs Scout, you specialize in:\n"
            "- Competitive analysis: feature comparison, pricing, positioning\n"
            "- Market research: TAM, trends, customer pain points\n"
            "- Competitor monitoring: website changes, product updates, job postings\n"
            "- Industry reports: synthesizing news and research into strategic insights\n\n"
            "Research principles:\n"
            "1. Always separate facts from inferences\n"
            "2. Rate source reliability and recency\n"
            "3. Identify strategic implications, not just information\n"
            "4. Highlight gaps in competitor offerings as opportunities\n"
        )
        return base + scout_specific

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="research_topic",
                description="Deep research on any topic using web scraping and LLM synthesis. Returns findings, synthesis, sources, and related keywords.",
                parameters=[
                    ToolParameter(name="topic", type="string", description="The topic to research", required=True),
                    ToolParameter(name="depth", type="string", description="Research depth: quick, standard, or deep", required=False, default="standard", enum=["quick", "standard", "deep"]),
                    ToolParameter(name="sources_hint", type="array", description="URLs to scrape for additional context", required=False, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="research_company",
                description="Build a comprehensive company profile through web research. Returns company info, key features, pricing, strengths, weaknesses, and recent news.",
                parameters=[
                    ToolParameter(name="company_name", type="string", description="Name of the company to research", required=True),
                    ToolParameter(name="company_url", type="string", description="Company website URL", required=False),
                ],
            ),
            ToolDefinition(
                name="scan_competitors",
                description="Monitor competitor websites for significant changes. Compares current content against previous scans using content hashing.",
                parameters=[
                    ToolParameter(name="competitors_json", type="string", description="JSON array of competitors: [{\"name\": \"...\", \"url\": \"...\", \"last_scan_hash\": null}]", required=True),
                ],
            ),
            ToolDefinition(
                name="trending_topics",
                description="Discover trending topics and content opportunities in a given industry. Returns topics with momentum, relevance scores, and content angles.",
                parameters=[
                    ToolParameter(name="industry", type="string", description="Industry or niche to find trends in", required=True),
                    ToolParameter(name="count", type="integer", description="Number of trending topics to find", required=False, default=5),
                ],
            ),
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(self, name: str, arguments: dict, user_id: str) -> str:
        from agents.scout.scraper import scrape_url, google_autocomplete, hash_content

        system = await self.build_system_prompt(user_id)

        if name == "research_topic":
            topic = arguments.get("topic", "")
            sources = arguments.get("sources_hint", []) or []

            keywords = await google_autocomplete(topic)
            scraped_texts = []
            for url in sources[:3]:
                text = await scrape_url(url)
                scraped_texts.append(text[:2000])

            context = f"Topic: {topic}\nKeywords found: {keywords[:10]}"
            if scraped_texts:
                context += f"\n\nScraped content:\n" + "\n\n---\n\n".join(scraped_texts)

            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": f"Research and synthesize findings on:\n{context}"}],
            )
            result = {
                "findings": raw,
                "keywords_found": keywords[:10],
                "sources_scraped": sources[:3],
            }
            return json.dumps(result, default=str)

        elif name == "research_company":
            company_name = arguments.get("company_name", "")
            url = arguments.get("company_url", "") or f"https://{company_name.lower().replace(' ', '')}.com"

            content = await scrape_url(url)
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": f"Build a comprehensive company profile for {company_name}. Website content:\n{content[:3000]}"}],
            )
            return raw

        elif name == "scan_competitors":
            try:
                competitors = json.loads(arguments.get("competitors_json", "[]"))
            except Exception:
                competitors = []

            results = []
            for comp in competitors:
                comp_name = comp.get("name", "Unknown")
                comp_url = comp.get("url", "")
                last_hash = comp.get("last_scan_hash")

                content = await scrape_url(comp_url)
                new_hash = hash_content(content)
                has_changes = last_hash is not None and last_hash != new_hash

                results.append({
                    "competitor": comp_name,
                    "url": comp_url,
                    "has_changes": has_changes,
                    "new_hash": new_hash,
                    "summary": f"Changes detected for {comp_name}" if has_changes else f"No changes for {comp_name}",
                })
            return json.dumps(results, default=str)

        elif name == "trending_topics":
            industry = arguments.get("industry", "")
            count = arguments.get("count", 5)

            keywords = await google_autocomplete(industry)
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system,
                messages=[{"role": "user", "content": f"Identify {count} trending topics in {industry}. Related keywords: {keywords}. For each topic provide: topic name, momentum (rising/stable/declining), relevance score, content angle, and estimated search volume."}],
            )
            return raw

        raise ValueError(f"Unknown tool: {name}")

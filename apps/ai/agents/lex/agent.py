import asyncio
import json
import logging

from agents.base import BaseAgent
from agents.lex import services as lex_services
from agents.lex.contract_analysis import analyze_contract_text
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter

logger = logging.getLogger("lex")


class LexAgent(BaseAgent):
    slug = "lex"
    name = "Lex"
    personality = (
        "a warm, sharp legal advisor who genuinely loves protecting founders. "
        "You're like the brilliant lawyer friend everyone wishes they had — you give direct, honest analysis "
        "with energy and care, not cold formality. You get excited about spotting a bad clause before it causes damage, "
        "you explain complex legal concepts with enthusiasm and clarity, and you make founders feel supported, "
        "not scared. Precise and sharp, yes — but always warm, encouraging, and on their side."
    )
    default_provider = "openai"
    default_model = "gpt-5.6-luna"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    # ── Tool-use instructions ────────────────────────────────────────────

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## Tool Usage Rules\n"
            "NEVER use tools for: greetings, thanks, acknowledgments, small talk.\n\n"
            "For EVERYTHING else that has any legal, regulatory, procedural, or government angle — use a tool. "
            "When in doubt, default to `legal_research`. It is better to research and answer than to refuse.\n\n"
            "Tool routing:\n"
            "- Contract or document to review → `analyze_contract`\n"
            "- ANY legal question in ANY language or jurisdiction: how-to, procedures, company formation, "
            "conversions (LLP→Pvt Ltd, etc.), government schemes/subsidies/grants, rights, obligations, "
            "regulations, licensing, compliance, employment, IP, taxes with legal angle → `legal_research`\n"
            "- Compliance check (DPDP Act, IT Rules, consumer protection, GDPR where relevant) → `compliance_check`\n"
            "- Draft a legal document → `draft_document`\n"
            "- Explain a legal clause or passage → `explain_legal`\n"
            "RULE: Never say a legal question is outside your expertise without first calling `legal_research`. "
            "If `legal_research` returns something, synthesize it and answer. "
            "Only after research can you say 'I couldn't find enough to advise confidently — verify with local counsel.'\n\n"
            "## Connected document sources (e.g. Google Drive)\n"
            "If the user references a specific document you don't already have via `list_documents` "
            "(a file in their Drive, not something previously uploaded to Lex), look for an available "
            "tool whose name contains 'drive' — use a find/search-shaped one to locate the file, then a "
            "download/read-shaped one to fetch its content, then answer using that content directly "
            "(e.g. via `explain_legal` or by reasoning over it yourself). If no such tool is available, "
            "fall back to asking the user to upload the document instead.\n\n"
            "## When to use ask_agent\n"
            "- User wants background research on a company as part of due diligence → `ask_agent` with scout.\n"
            "- User wants financial metrics analyzed alongside a legal document → `ask_agent` with rex."
        )

    # ── System prompt ────────────────────────────────────────────────────

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
        use_brand_kit: bool = True,
        has_history: bool = False,
    ) -> str:
        base = await super().build_system_prompt(user_id, organization_id, extra_context, has_history=has_history)

        client_ctx = ""
        if use_brand_kit:
            from core.brand_kit import load_brand_kit, get_site_context_block
            brand_kit = await load_brand_kit(organization_id)
            client_ctx = "\n\n## Client Context\n"
            client_ctx += f"Company: **{brand_kit.company_name}**\n"
            if brand_kit.industry:
                client_ctx += f"Industry: {brand_kit.industry}\n"
            if brand_kit.value_proposition:
                client_ctx += f"Value Proposition: {brand_kit.value_proposition}\n"
            if brand_kit.website_url:
                client_ctx += f"Website: {brand_kit.website_url}\n"
            site_block = get_site_context_block(brand_kit)
            if site_block:
                client_ctx += "\n" + site_block + "\n"

        lex_specific = (
            "\n\nAs Lex, you specialize in:\n"
            "- Contract review: NDAs, SaaS agreements, employment contracts, vendor agreements\n"
            "- Startup legal: incorporation, equity, IP assignment, founder agreements\n"
            "- Company structure & conversions: LLP → Pvt Ltd, sole proprietorship → LLP, OPC conversions, "
            "winding up, mergers — any change in corporate form is your job\n"
            "- Compliance: India first — DPDP Act 2023, IT Rules, consumer protection, GST and FSSAI where relevant; "
            "GDPR/CCPA when the business serves those users; terms of service and privacy policies\n"
            "- Document drafting: letters, agreements, policies (non-binding templates)\n"
            "- Government schemes, subsidies, and grants: the legal eligibility criteria, "
            "application process, compliance obligations, and regulatory requirements for any "
            "government scheme — this is legal research, not finance\n\n"
            "Legal principles:\n"
            "1. Identify and explain ALL risks, not just obvious ones\n"
            "2. Explain legal jargon in plain English (or the user's language)\n"
            "3. Suggest specific clauses or modifications when appropriate\n"
            "4. Always note the applicable governing law when relevant\n"
            "5. Always recommend consulting a qualified attorney before signing binding documents.\n"
            "\n## Language\n"
            "Always reply in the same language the user wrote in. If they write in Hindi, reply in Hindi. "
            "If they mix Hindi and English (Hinglish), match that tone. Never switch to English "
            "unprompted when the user is writing in another language.\n"
            "\n## Conversational Style\n"
            "You're a real lawyer friend, not a legal database. When someone says hi, thanks, "
            "'great', 'perfect', 'got it', 'nice one', or anything casual — respond warmly and "
            "briefly in plain text. No tools, no analysis cards. Just a genuine human reply.\n"
        )
        _greeting = (
            "When greeting at the start of a conversation: be warm, witty, and genuinely excited to help. "
            "Never say 'How can I assist you today?' — sound like the brilliant lawyer friend "
            "they're lucky to have, not a chatbot.\n"
            if not has_history else
            self._mid_conversation_ack_block()
        )
        lex_specific += _greeting + (
            "\n## Your Domain — When in Doubt, Answer\n"
            "Contract analysis, legal document drafting, compliance, legal research, "
            "startup legal structures, company formation and conversions, IP, privacy law, "
            "business registration, licensing, employment law, government schemes and subsidies, "
            "and any general legal how-to question in ANY jurisdiction.\n"
            "You cover ALL jurisdictions — India, UK, EU, Singapore, and beyond.\n"
            "If a question has ANY legal or regulatory angle — company structure, government scheme "
            "eligibility, compliance requirements, procedural steps — it is YOUR lane. "
            "Use `legal_research` and answer it. Do not redirect legal questions to other agents.\n"
            "IMPORTANT: Government subsidies, grants, and schemes (e.g. MP Govt schemes, MSME schemes, "
            "Startup India) are NOT Rex's territory. Rex only handles MRR, burn rate, and financial "
            "metrics. The legal eligibility and process side of any government scheme is yours.\n"
            "\n## Connected Tools\n"
            "You may have MCP tools beyond the six listed above for connected document/knowledge "
            "sources — each one's LLM-facing name is prefixed `mcp_<slug>_`. Only use a tool if it's "
            "actually present in your tool list this turn — never assume one exists just because it's "
            "listed here.\n"
            "**File storage** — `mcp_google-drive_*`, `mcp_dropbox_*`, `mcp_box_*`, "
            "`mcp_onedrive-sharepoint_*` — use find/search + download/read actions to locate and read a "
            "specific contract or document the user references.\n"
            "**Knowledge bases** — `mcp_notion_*`, `mcp_confluence_*` — search + read a page for company "
            "policy, process, or context relevant to the question.\n"
            "**Structured records** — `mcp_airtable_*` — read contract/deal metadata (parties, dates, "
            "status) when the user references a tracked deal or contract by name.\n"
            "**Drafting** — `mcp_google-docs_*` — this one IS write-capable: read an existing draft, or "
            "write/update one, when the user explicitly asks you to draft or revise a document there "
            "(not just discuss it).\n"
            "For every source above except Google Docs: read-only. Never use a connected source's "
            "create, edit, delete, or sharing/permission tools unless the user explicitly asks you to "
            "change or share something — your job is to read and analyze, not modify their files.\n"
            "\n## When to Redirect — Only Pure Non-Legal Topics\n"
            "Only redirect when there is zero legal angle. Never redirect company law, corporate "
            "structure, government schemes, or procedural questions to another agent.\n"
            "- Maya → content creation and social media only\n"
            "- Rex → business metrics: MRR, ARR, burn rate, runway, forecasting (numbers only, not law)\n"
            "- Scout → market research, competitive intelligence\n"
            "- Sage → SEO and blog content\n"
            "- Vega → email and calendar management\n"
            "RULE: Never give medical or investment advice. "
            "For any jurisdiction, use `legal_research` and add 'verify with local counsel before acting.' "
            "Never fabricate case law or statutes.\n"
        )
        return base + client_ctx + lex_specific

    # ── Chat override: RAG ingest ────────────────────────────────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        response = await super().chat_sync(request)

        tool_calls = response.metadata.get("tool_calls", [])
        for tc in tool_calls:
            if tc["name"] in {"analyze_contract", "legal_research", "compliance_check"}:
                self._fire_rag_ingest(
                    user_id=request.user_id,
                    text=response.response,
                    source_id=f"lex-{tc['name']}-{request.conversation_id}",
                    metadata={"tool": tc["name"], "agent": "lex"},
                )

        return response

    # ── Tool Definitions ─────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="list_documents",
                description="List the documents the user has previously uploaded to Lex. Returns each document's source_id, name, type, and upload time. Use this when the user asks 'which documents do I have?' or before calling analyze_contract / query_document if no source_id was given.",
                parameters=[],
            ),
            ToolDefinition(
                name="analyze_contract",
                description="Review a previously uploaded contract: a sign/negotiate verdict, key facts, the issues to push back on with replacement wording, and the dates the user must act on.",
                parameters=[
                    ToolParameter(name="source_id", type="string", description="ID returned by ingest-document for the contract to analyze", required=True),
                    ToolParameter(name="perspective", type="string", description="Which party the user is (e.g. 'the service provider', 'the employee'), if the conversation makes it clear. Leave empty to infer.", required=False, default=""),
                ],
            ),
            ToolDefinition(
                name="draft_document",
                description="Draft a legal document template based on requirements. Always includes review notes.",
                parameters=[
                    ToolParameter(name="document_type", type="string", description="Type of document (e.g., mutual_nda, employment_agreement, terms_of_service, privacy_policy, saas_agreement)", required=True),
                    ToolParameter(name="requirements", type="string", description="Specific requirements and context for the document", required=True),
                    ToolParameter(name="jurisdiction", type="string", description="Jurisdiction, if the user named one. Leave empty to use the organisation's location (India by default).", required=False, default=""),
                    ToolParameter(name="additional_clauses", type="array", description="Additional clauses to include", required=False, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="explain_legal",
                description="Explain legal text in plain English with practical implications. Breaks down jargon, identifies key terms, and explains what it means in practice.",
                parameters=[
                    ToolParameter(name="text", type="string", description="The legal text to explain", required=True),
                    ToolParameter(name="context", type="string", description="Context about where this text appears (e.g., 'from an NDA with a potential investor')", required=False),
                ],
            ),
            ToolDefinition(
                name="legal_research",
                description=(
                    "The default tool for ANY legal question in any language or jurisdiction. "
                    "Use this for: how-to legal procedures, company formation/registration/conversion "
                    "(LLP, Pvt Ltd, OPC, Partnership, sole proprietorship, etc.), government schemes, "
                    "subsidies, grants and their eligibility, startup law, employment law, IP, contracts, "
                    "compliance, regulations, licensing, rights and obligations, case law, or any question "
                    "where the answer requires knowing what the law says. When in doubt, call this tool."
                ),
                parameters=[
                    ToolParameter(name="query", type="string", description="The full legal question exactly as asked (e.g., 'How to convert LLP to Private Limited company in India?', 'MP government subsidies for startups')", required=True),
                    ToolParameter(name="jurisdiction", type="string", description="Jurisdiction inferred from context (e.g., 'India', 'Madhya Pradesh, India', 'United Kingdom', 'EU'). Infer from conversation — do not default to United States unless clearly relevant.", required=False, default=""),
                    ToolParameter(name="legal_areas", type="array", description="Legal areas to focus on (e.g., corporate_law, startup_law, government_schemes, employment, ip, data_privacy)", required=False, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="compliance_check",
                description="Check whether a practice, policy or business process complies with the laws that apply to the user — India first (DPDP Act 2023, IT Rules, consumer protection, sector rules), GDPR/CCPA etc. when they serve those users. Returns status, gaps and remediation steps.",
                parameters=[
                    ToolParameter(name="description", type="string", description="Description of the practice, policy, or document to evaluate", required=True),
                    ToolParameter(name="frameworks", type="array", description="Laws or frameworks the user named. Leave empty to let Lex pick the ones that apply.", required=False, items_type="string"),
                    ToolParameter(name="business_context", type="string", description="Business type and context (e.g., 'B2B SaaS handling EU customer data')", required=False, default=""),
                ],
            ),
        ]

    # ── Tool Execution ────────────────────────────────────────────────────

    async def execute_tool(
        self,
        name: str,
        arguments: dict,
        user_id: str,
        organization_id: str = "",
    ) -> str:
        # Brand kit is 5-min cached (already loaded by the chat turn), so including it here
        # is free — and the deliverable-generating calls need brand voice/industry/audience.
        system = await self.build_system_prompt(user_id, organization_id, use_brand_kit=True)

        if name == "list_documents":
            sources = await self.rag.list_sources(user_id, source_agent="lex")
            simplified = [
                {
                    "source_id": s["source_id"],
                    "name": (s.get("metadata") or {}).get("document_name", ""),
                    "type": (s.get("metadata") or {}).get("document_type", s.get("source_type", "")),
                    "uploaded_at": s.get("created_at", ""),
                }
                for s in sources
            ]
            return json.dumps({"documents": simplified, "count": len(simplified)}, default=str)

        if name == "analyze_contract":
            source_id = arguments.get("source_id", "")
            full_text = await self.rag.source_text(user_id, source_id)
            if not full_text:
                return json.dumps({"error": f"No document found for source_id '{source_id}'"})
            data = await analyze_contract_text(
                self.llm, provider=self.default_provider, model=self.default_model,
                system=system, full_text=full_text,
                perspective=arguments.get("perspective", "") or "",
                company_name=await lex_services.org_company_name(organization_id),
            )
            return json.dumps({"analysis": data}, default=str)

        if name == "draft_document":
            location = await lex_services.org_location(organization_id)
            jurisdiction = lex_services.resolve_jurisdiction(arguments.get("jurisdiction"), location)
            doc_type = arguments.get("document_type", "")
            try:
                document = await lex_services.draft_document(
                    self.llm, provider=self.default_provider, model=self.default_model, system=system,
                    document_type=doc_type, requirements=arguments.get("requirements", ""),
                    jurisdiction=jurisdiction, additional_clauses=arguments.get("additional_clauses") or [],
                )
            except Exception as exc:
                logger.error("draft_document tool failed | type=%s | %s", doc_type, exc)
                return json.dumps({"error": "Lex couldn't finish this draft. Ask the user to try again."})
            from agents.lex.routes import _get_draft_review_notes
            return json.dumps({
                "document": document, "document_type": doc_type, "jurisdiction": jurisdiction,
                "review_notes": _get_draft_review_notes(doc_type, jurisdiction, arguments.get("additional_clauses") or []),
            }, default=str)

        if name == "explain_legal":
            data = await lex_services.explain_text(
                self.llm, provider=self.default_provider, model=self.default_model, system=system,
                text=arguments.get("text", ""), context=arguments.get("context"),
            )
            return json.dumps(data, default=str)

        if name == "legal_research":
            location = await lex_services.org_location(organization_id)
            data = await lex_services.research(
                self.llm, provider=self.default_provider, model=self.default_model, system=system,
                query=arguments.get("query", ""),
                jurisdiction=lex_services.resolve_jurisdiction(arguments.get("jurisdiction"), location),
                legal_areas=arguments.get("legal_areas") or [],
            )
            return json.dumps(data, default=str)

        if name == "compliance_check":
            location = await lex_services.org_location(organization_id)
            data = await lex_services.compliance(
                self.llm, provider=self.default_provider, model=self.default_model, system=system,
                description=arguments.get("description", ""), frameworks=arguments.get("frameworks") or [],
                business_context=arguments.get("business_context", "") or "",
                jurisdiction=lex_services.resolve_jurisdiction(None, location),
            )
            return json.dumps(data, default=str)

        raise ValueError(f"Unknown tool: {name}")

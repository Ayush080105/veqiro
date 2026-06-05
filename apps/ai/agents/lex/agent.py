import asyncio
import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.tools import ToolDefinition, ToolParameter
from core.utils import strip_json_fences, safe_json_loads

class LexAgent(BaseAgent):
    slug = "lex"
    name = "Lex"
    personality = (
        "a senior legal counsel who gives founders the direct, unhedged analysis a paid attorney would give in a private meeting. "
        "You say exactly what a clause means, whether it's a problem, and what to do about it. "
        "You speak plainly, flag what matters, and skip what doesn't."
    )
    default_provider = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    # ── Tool-use instructions ────────────────────────────────────────────

    def get_tool_instructions(self) -> str:
        return (
            "\n\n## MANDATORY Tool Usage Rules\n"
            "You MUST use tools for ANY contract, legal, compliance, or regulatory question — "
            "even simple follow-up questions that seem conversational.\n"
            "- Any request to review a contract or document → call `analyze_contract`\n"
            "- Any question about laws, regulations, or case precedents → call `legal_research`\n"
            "- Any compliance question (GDPR, CCPA, SOC2, HIPAA, PCI-DSS, etc.) → call `compliance_check`\n"
            "- Any request to draft a legal document → call `draft_document`\n"
            "- Any request to explain legal text → call `explain_legal`\n"
            "After using tools, synthesize results into a direct, concrete response.\n\n"
            "## When to use ask_agent\n"
            "- User wants background research on a company as part of due diligence → call `ask_agent` with scout.\n"
            "- User wants financial metrics analyzed alongside a legal document → call `ask_agent` with rex."
        )

    # ── System prompt ────────────────────────────────────────────────────

    async def build_system_prompt(
        self,
        user_id: str,
        organization_id: str = "",
        extra_context: str | None = None,
        use_brand_kit: bool = True,
    ) -> str:
        base = await super().build_system_prompt(user_id, organization_id, extra_context)

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
            "- Compliance: GDPR, CCPA, SOC 2, terms of service, privacy policies\n"
            "- Document drafting: letters, agreements, policies (non-binding templates)\n\n"
            "Legal principles:\n"
            "1. Identify and explain ALL risks, not just obvious ones\n"
            "2. Explain legal jargon in plain English\n"
            "3. Suggest specific clauses or modifications when appropriate\n"
            "4. Always note the applicable governing law when relevant\n"
            "5. Always recommend consulting a qualified attorney before signing binding documents.\n"
            "\n## Greeting Style\n"
            "When someone says hi or checks in — respond in Lex's voice: precise, dry, zero-fluff. "
            "Don't say 'How can I assist you today?' — that's generic. "
            "Generate an original greeting that matches this tone: dry attorney energy, "
            "sharp and direct, not a syllable wasted. Reference what Lex actually does — "
            "contracts, clauses, compliance, legal docs. Never copy a fixed template.\n"
            "\n## Your Domain\n"
            "Contract analysis, legal document drafting, compliance checking, legal research, "
            "explaining legal clauses, startup legal structures, IP, privacy law.\n"
            "Regulatory and compliance questions are IN your lane — including how laws, statutes, "
            "industry standards (e.g. building codes, environmental, safety, or sector-specific "
            "standards) apply as legal/compliance requirements. Treat these as legal research, not "
            "as topics to redirect. When a question mixes a technical subject with a legal/regulatory "
            "angle, answer the legal/regulatory part via `legal_research`.\n"
            "\n## When to Redirect — Never Guess Outside Your Lane\n"
            "Only redirect to an agent whose domain BELOW actually covers the request. Each agent's "
            "real domain is fixed — never invent or expand a capability an agent does not have "
            "(e.g. Rex does NOT handle construction, engineering, or safety regulations — he is "
            "finance only). The available agents and their ONLY domains are:\n"
            "- Maya → content creation and social media. "
            "'Maya handles content and social media. Take that to Maya.'\n"
            "- Rex → business metrics, financial analysis, MRR, forecasting (finance ONLY). "
            "'Rex handles business analytics. Head to Rex.'\n"
            "- Scout → market research, competitive intelligence. "
            "'Scout researches markets and competitors. Ask Scout.'\n"
            "- Sage → SEO and blog content. 'Sage is the SEO and content expert.'\n"
            "- Vega → email and calendar management. 'Vega manages inbox and scheduling.'\n"
            "If a request fits NONE of the domains above (yours included), say so plainly — e.g. "
            "'That's outside what this team covers — none of us own that.' NEVER fabricate a handoff "
            "to an agent that doesn't actually handle the topic.\n"
            "RULE: Never give medical, investment, or tax advice. "
            "For jurisdictions outside your training data, say 'I'd recommend verifying with local counsel.' "
            "Never fabricate case law, statutes, or regulatory requirements — say what you know and flag uncertainty.\n"
        )
        return base + client_ctx + lex_specific

    # ── Chat override: RAG ingest ────────────────────────────────────────

    async def chat_sync(self, request: ChatRequest) -> ChatSyncResponse:
        response = await super().chat_sync(request)

        tool_calls = response.metadata.get("tool_calls", [])
        for tc in tool_calls:
            if tc["name"] in {"analyze_contract", "legal_research", "compliance_check"}:
                try:
                    asyncio.create_task(self.ingest_to_rag(
                        user_id=request.user_id,
                        text=response.response,
                        source_id=f"lex-{tc['name']}-{request.conversation_id}",
                        metadata={"tool": tc["name"], "agent": "lex"},
                    ))
                except Exception:
                    pass  # best-effort

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
                description="Perform a full structured analysis of a previously ingested contract. Fetches all document chunks by source_id and returns detailed risk assessment, clause breakdown, obligations, and negotiation guidance.",
                parameters=[
                    ToolParameter(name="source_id", type="string", description="ID returned by ingest-document for the contract to analyze", required=True),
                ],
            ),
            ToolDefinition(
                name="draft_document",
                description="Draft a legal document template based on requirements. Always includes review notes.",
                parameters=[
                    ToolParameter(name="document_type", type="string", description="Type of document (e.g., mutual_nda, employment_agreement, terms_of_service, privacy_policy, saas_agreement)", required=True),
                    ToolParameter(name="requirements", type="string", description="Specific requirements and context for the document", required=True),
                    ToolParameter(name="jurisdiction", type="string", description="Legal jurisdiction", required=False, default="United States (Delaware)"),
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
                description="Research laws, regulations, case precedents, and statutory requirements relevant to a legal question. Use for questions about specific laws, regulatory requirements, or legal standards.",
                parameters=[
                    ToolParameter(name="query", type="string", description="The legal question or research topic (e.g., 'GDPR consent requirements for SaaS companies')", required=True),
                    ToolParameter(name="jurisdiction", type="string", description="Relevant jurisdiction(s) (e.g., 'United States', 'EU', 'California')", required=False, default="United States"),
                    ToolParameter(name="legal_areas", type="array", description="Specific legal areas to focus on (e.g., contract_law, data_privacy, employment, ip)", required=False, items_type="string"),
                ],
            ),
            ToolDefinition(
                name="compliance_check",
                description="Evaluate whether a practice, document, or business process meets regulatory compliance requirements (GDPR, CCPA, SOC2, HIPAA, PCI-DSS, etc.). Returns compliance status, gaps, and remediation steps.",
                parameters=[
                    ToolParameter(name="description", type="string", description="Description of the practice, policy, or document to evaluate", required=True),
                    ToolParameter(name="frameworks", type="array", description="Compliance frameworks to check against (e.g., GDPR, CCPA, SOC2, HIPAA)", required=True, items_type="string"),
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
        system = await self.build_system_prompt(user_id, organization_id, use_brand_kit=False)

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

            chunks = await self.rag.retrieve_by_source(user_id, source_id)
            if not chunks:
                return json.dumps({"error": f"No document found for source_id '{source_id}'"})

            full_text = "\n\n".join(c.get("content", "") for c in chunks)

            prompt = (
                f"Perform a complete, detailed legal analysis of this contract:\n\n{full_text}\n\n"
                "Return ONLY a JSON object (no markdown fences) with exactly these keys:\n"
                "document_type (string), "
                "parties (list of strings — 'Name (Role)'), "
                "effective_date (string), "
                "governing_law (string), "
                "jurisdiction (string), "
                "executive_summary (string — 2–3 sentences plain English), "
                "risk_level (low/medium/high/critical), "
                "risk_score (integer 1–10), "
                "risks (list of {clause, risk, severity: low/medium/high/critical, recommendation}), "
                "unusual_clauses (list of strings), "
                "missing_protections (list of strings), "
                "clause_breakdown (list of {section, title, summary, risk_level, notes}), "
                "key_terms (dict of string->string), "
                "obligations (dict of party_name -> list of obligation strings), "
                "negotiation_points (list of {priority: high/medium/low, clause, issue, suggested_change}), "
                "overall_assessment (string), "
                "recommended_action (sign/negotiate/reject/legal_review_required)"
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
                max_tokens=4096,
            )
            try:
                data = safe_json_loads(raw)
            except Exception:
                data = {
                    "document_type": "Unknown", "parties": [], "effective_date": "",
                    "governing_law": "", "jurisdiction": "",
                    "executive_summary": raw[:500],
                    "risk_level": "unknown", "risk_score": 0,
                    "risks": [], "unusual_clauses": [], "missing_protections": [],
                    "clause_breakdown": [], "key_terms": {}, "obligations": {},
                    "negotiation_points": [],
                    "overall_assessment": "Manual review recommended.",
                    "recommended_action": "legal_review_required",
                }
            return json.dumps({"analysis": data}, default=str)

        elif name == "draft_document":
            doc_type = arguments.get("document_type", "")
            requirements = arguments.get("requirements", "")
            jurisdiction = arguments.get("jurisdiction", "United States (Delaware)")
            additional = arguments.get("additional_clauses", [])

            prompt = (
                f"Draft a {doc_type} with these requirements:\n{requirements}\n"
                f"Jurisdiction: {jurisdiction}\n"
                f"Additional clauses: {', '.join(additional) if additional else 'None'}\n\n"
                "Include all standard sections. Mark areas needing customization with [BRACKETS]."
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
                max_tokens=4096,
            )
            result = {
                "document": raw,
                "document_type": doc_type,
                "jurisdiction": jurisdiction,
                "review_notes": [
                    "TEMPLATE ONLY — requires customization before use",
                ],
            }
            return json.dumps(result, default=str)

        elif name == "explain_legal":
            text = arguments.get("text", "")
            context = arguments.get("context", "")

            prompt = (
                f"Explain this legal text in plain English:\n\n{text}\n\n"
                f"Context: {context or 'Not provided'}\n\n"
                "Return ONLY a JSON object (no markdown fences) with keys: "
                "explanation (string), key_terms (dict of string->string), "
                "related_concepts (list of strings), practical_implications (list of strings)"
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )
            try:
                data = safe_json_loads(raw)
            except Exception:
                data = {
                    "explanation": raw,
                    "key_terms": {},
                    "related_concepts": [],
                    "practical_implications": [],
                }
            return json.dumps(data, default=str)

        elif name == "legal_research":
            query = arguments.get("query", "")
            jurisdiction = arguments.get("jurisdiction", "United States")
            legal_areas = arguments.get("legal_areas", [])

            prompt = (
                f"Research this legal question:\n{query}\n\n"
                f"Jurisdiction: {jurisdiction}\n"
                f"Legal areas: {', '.join(legal_areas) if legal_areas else 'general'}\n\n"
                "Return ONLY a JSON object (no markdown fences) with these keys — be concise:\n"
                "summary (2-3 sentences), "
                "applicable_laws (list of strings, max 6), "
                "key_requirements (list of strings, max 6), "
                "relevant_cases (list of strings, max 4), "
                "practical_guidance (list of strings, max 5), "
                "jurisdiction_notes (1 sentence), "
                "confidence_level (exactly one word: high, medium, or low)"
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
                max_tokens=1200,
            )
            try:
                data = safe_json_loads(raw)
                # Guard: if summary itself looks like JSON (LLM nested the response), re-parse it
                if isinstance(data.get("summary"), str) and data["summary"].strip().startswith("{"):
                    try:
                        inner = safe_json_loads(data["summary"])
                        if isinstance(inner, dict) and "summary" in inner:
                            data = inner
                    except Exception:
                        pass
            except Exception:
                data = {
                    "summary": "Legal research completed. See details below.",
                    "applicable_laws": [],
                    "key_requirements": [],
                    "relevant_cases": [],
                    "practical_guidance": [raw[:400]] if raw else [],
                    "jurisdiction_notes": jurisdiction,
                    "confidence_level": "medium",
                }
            # Normalise confidence_level to a single word (LLM sometimes adds explanation)
            cl = str(data.get("confidence_level", "medium")).lower().split()[0]
            data["confidence_level"] = cl if cl in ("high", "medium", "low") else "medium"
            return json.dumps(data, default=str)

        elif name == "compliance_check":
            description = arguments.get("description", "")
            frameworks = arguments.get("frameworks", [])
            context = arguments.get("business_context", "")

            prompt = (
                f"Evaluate the regulatory compliance of this practice or document:\n{description}\n\n"
                f"Business context: {context or 'Not provided'}\n"
                f"Check against: {', '.join(frameworks)}\n\n"
                "Return ONLY a JSON object (no markdown fences) with keys:\n"
                "overall_status (compliant/partial/non_compliant), "
                "framework_results (list of {framework, status, gaps, requirements}), "
                "critical_gaps (list of strings), "
                "remediation_steps (list of {priority: high/medium/low, action: string}), "
                "estimated_effort (string)"
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )
            try:
                data = safe_json_loads(raw)
            except Exception:
                data = {
                    "overall_status": "unknown",
                    "framework_results": [],
                    "critical_gaps": [],
                    "remediation_steps": [],
                    "estimated_effort": "Manual review required",
                }
            return json.dumps(data, default=str)

        raise ValueError(f"Unknown tool: {name}")

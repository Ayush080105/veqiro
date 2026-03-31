import json

from agents.base import BaseAgent
from core.llm import LLMClient
from core.rag import RAGService
from core.tools import ToolDefinition, ToolParameter

LEGAL_DISCLAIMER = (
    "This is AI-generated information for educational purposes only. "
    "Consult a qualified attorney for specific legal advice."
)


class LexAgent(BaseAgent):
    slug = "lex"
    name = "Lex"
    personality = (
        "Knowledgeable legal assistant with expertise in startup law, contracts, compliance, "
        "and business legal matters. You explain complex legal concepts in plain English, "
        "identify risks and opportunities in documents, and help founders understand their "
        "legal obligations. You always include appropriate disclaimers."
    )
    default_provider = "gemini"
    default_model = "gemini-2.0-flash"

    def __init__(self, llm_client: LLMClient, rag_service: RAGService):
        super().__init__(llm_client, rag_service)

    async def build_system_prompt(self, user_id: str, extra_context: str | None = None) -> str:
        base = await super().build_system_prompt(user_id, extra_context)
        lex_specific = (
            "\n\nAs Lex, you specialize in:\n"
            "- Contract review: NDAs, SaaS agreements, employment contracts, vendor agreements\n"
            "- Startup legal: incorporation, equity, IP assignment, founder agreements\n"
            "- Compliance: GDPR, CCPA, SOC 2, terms of service, privacy policies\n"
            "- Document drafting: letters, agreements, policies (non-binding templates)\n\n"
            "Legal principles:\n"
            "1. ALWAYS include the disclaimer: '" + LEGAL_DISCLAIMER + "'\n"
            "2. Identify and explain ALL risks, not just obvious ones\n"
            "3. Explain legal jargon in plain English\n"
            "4. Suggest specific clauses or modifications when appropriate\n"
            "5. Never provide jurisdiction-specific advice without noting applicable law\n"
        )
        return base + lex_specific

    # ── Tool Definitions ────────────────────────────────────────────────

    def get_tools(self) -> list[ToolDefinition]:
        return [
            ToolDefinition(
                name="analyze_contract",
                description="Perform comprehensive risk analysis on a contract or legal document. Identifies risks, unusual clauses, missing protections, and provides an overall assessment.",
                parameters=[
                    ToolParameter(name="contract_text", type="string", description="The contract text to analyze", required=True),
                    ToolParameter(name="analysis_focus", type="array", description="Areas to focus on (e.g., risk_assessment, unusual_clauses, ip_rights, termination)", required=False, items_type="string"),
                    ToolParameter(name="source_id", type="string", description="ID of a previously ingested document to analyze from RAG", required=False),
                ],
            ),
            ToolDefinition(
                name="draft_document",
                description="Draft a legal document template based on requirements. Always includes review notes and disclaimer.",
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
        ]

    # ── Tool Execution ──────────────────────────────────────────────────

    async def execute_tool(self, name: str, arguments: dict, user_id: str) -> str:
        system = await self.build_system_prompt(user_id)

        if name == "analyze_contract":
            contract_text = arguments.get("contract_text", "")
            focus = arguments.get("analysis_focus", [])
            source_id = arguments.get("source_id")

            # Retrieve from RAG if source_id provided
            if source_id:
                chunks = await self.rag.retrieve(
                    user_id, "contract analysis key terms risks",
                    top_k=10, source_agent="lex"
                )
                if chunks:
                    contract_text = "\n\n".join(c.get("content", "") for c in chunks)

            prompt = (
                f"Analyze this contract:\n{contract_text[:4000]}\n\n"
                f"Focus areas: {', '.join(focus) if focus else 'comprehensive review'}\n\n"
                "Provide: summary, risk_level (low/medium/high), specific risks with severity, "
                "unusual clauses, missing protections, key terms, and overall assessment."
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )
            return f"{raw}\n\n---\nDISCLAIMER: {LEGAL_DISCLAIMER}"

        elif name == "draft_document":
            doc_type = arguments.get("document_type", "")
            requirements = arguments.get("requirements", "")
            jurisdiction = arguments.get("jurisdiction", "United States (Delaware)")
            additional = arguments.get("additional_clauses", [])

            prompt = (
                f"Draft a {doc_type} with these requirements:\n{requirements}\n"
                f"Jurisdiction: {jurisdiction}\n"
                f"Additional clauses needed: {', '.join(additional) if additional else 'None'}\n\n"
                "Include all standard sections and mark areas that need customization with [BRACKETS]."
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
                max_tokens=4096,
            )
            return f"{raw}\n\n---\nDISCLAIMER: {LEGAL_DISCLAIMER}"

        elif name == "explain_legal":
            text = arguments.get("text", "")
            context = arguments.get("context", "")

            prompt = (
                f"Explain this legal text in plain English:\n\n{text}\n\n"
                f"Context: {context or 'Not provided'}\n\n"
                "Provide: plain English explanation, key terms defined, "
                "related legal concepts, and practical implications for the reader."
            )
            raw = await self.llm.complete(
                provider=self.default_provider, model=self.default_model,
                system=system, messages=[{"role": "user", "content": prompt}],
            )
            return f"{raw}\n\n---\nDISCLAIMER: {LEGAL_DISCLAIMER}"

        raise ValueError(f"Unknown tool: {name}")

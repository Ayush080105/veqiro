import json
import uuid
import base64
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from core.utils import strip_json_fences, safe_json_loads
from agents.lex.agent import LexAgent, LEGAL_DISCLAIMER

router = APIRouter(prefix="/ai/lex", tags=["Lex"])

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = LexAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

class IngestDocumentRequest(BaseModel):
    user_id: str
    document_name: str
    document_type: str = "nda"
    pdf_base64: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "document_name": "Acme Corp NDA 2025",
                "document_type": "nda",
                "pdf_base64": "JVBERi0xLjQK...",
            }
        }
    )


class IngestDocumentResponse(BaseModel):
    source_id: str
    chunks_created: int
    page_count: int
    summary: str
    key_topics: list[str]
    document_type_detected: str


class AnalyzeContractRequest(BaseModel):
    user_id: str
    source_id: str | None = None
    contract_text: str = ""
    analysis_focus: list[str] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "source_id": "doc_abc123",
                "contract_text": "This Non-Disclosure Agreement ('Agreement') is entered into as of January 1, 2025...",
                "analysis_focus": ["risk_assessment", "unusual_clauses"],
            }
        }
    )


class ContractAnalysis(BaseModel):
    summary: str
    risk_level: str
    risks: list[dict]
    unusual_clauses: list[str]
    missing_protections: list[str]
    key_terms: dict
    overall_assessment: str


class AnalyzeContractResponse(BaseModel):
    analysis: ContractAnalysis
    disclaimer: str


class DraftDocumentRequest(BaseModel):
    user_id: str
    document_type: str
    requirements: str
    jurisdiction: str = "United States (Delaware)"
    additional_clauses: list[str] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "document_type": "mutual_nda",
                "requirements": "Mutual NDA between two SaaS companies for a potential partnership discussion. 2-year term, covers product roadmap and customer data.",
                "jurisdiction": "United States (Delaware)",
                "additional_clauses": ["data_protection", "ip_assignment_exclusion"],
            }
        }
    )


class DraftDocumentResponse(BaseModel):
    document: str
    review_notes: list[str]
    disclaimer: str


class ExplainRequest(BaseModel):
    user_id: str
    text: str
    context: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "text": "The Receiving Party agrees to hold the Confidential Information in strict confidence and not to disclose it to any third party without the prior written consent of the Disclosing Party.",
                "context": "This is from an NDA we're about to sign with a potential investor",
            }
        }
    )


class ExplainResponse(BaseModel):
    explanation: str
    key_terms: dict
    related_concepts: list[str]
    practical_implications: list[str]


class LegalResearchRequest(BaseModel):
    user_id: str
    query: str
    jurisdiction: str = "United States"
    legal_areas: list[str] = []

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "query": "What are the GDPR requirements for obtaining valid consent from users in the EU?",
                "jurisdiction": "EU",
                "legal_areas": ["data_privacy", "consent"],
            }
        }
    )


class LegalResearchResponse(BaseModel):
    summary: str
    applicable_laws: list[str]
    key_requirements: list[str]
    relevant_cases: list[str]
    practical_guidance: list[str]
    jurisdiction_notes: str
    confidence_level: str
    disclaimer: str


class ComplianceCheckRequest(BaseModel):
    user_id: str
    description: str
    frameworks: list[str]
    business_context: str = ""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "description": "We store EU user email addresses and behavioral analytics data on AWS US-East servers with 90-day retention and no explicit consent flow.",
                "frameworks": ["GDPR", "CCPA"],
                "business_context": "B2B SaaS with EU and California customers",
            }
        }
    )


class ComplianceCheckResponse(BaseModel):
    overall_status: str
    framework_results: list[dict]
    critical_gaps: list[str]
    remediation_steps: list[dict]
    estimated_effort: str
    disclaimer: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Lex chat")
async def lex_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Lex's legal response. Always includes disclaimer in metadata."""
    result = await _agent.chat_sync(request)
    # chat_sync override already injects disclaimer, but ensure it's present
    result.metadata["disclaimer"] = LEGAL_DISCLAIMER
    return result


@router.post("/ingest-document", response_model=IngestDocumentResponse, summary="Ingest legal document")
async def ingest_document(request: IngestDocumentRequest) -> IngestDocumentResponse:
    """Upload and process a legal document (PDF) for RAG-powered analysis."""
    if settings.MOCK_MODE:
        source_id = f"doc_{str(uuid.uuid4())[:8]}"
        return IngestDocumentResponse(
            source_id=source_id,
            chunks_created=8,
            page_count=4,
            summary=(
                "This document is a Mutual Non-Disclosure Agreement between two parties. "
                "It covers confidentiality obligations, permitted disclosures, intellectual property ownership, "
                "and dispute resolution. Duration is 5 years with Delaware governing law."
            ),
            key_topics=["confidentiality", "intellectual_property", "non_solicitation", "term_and_termination", "dispute_resolution"],
            document_type_detected="mutual_nda",
        )

    try:
        pdf_bytes = base64.b64decode(request.pdf_base64)
    except Exception:
        pdf_bytes = b""

    from core.pdf_reader import extract_pages, summarize_pdf
    pages = extract_pages(pdf_bytes)
    page_count = len(pages)
    summary = await summarize_pdf(pdf_bytes, _llm)

    source_id = f"doc_{str(uuid.uuid4())[:8]}"
    chunks = await _rag.ingest_pdf(request.user_id, pdf_bytes, source_id, {"document_name": request.document_name, "document_type": request.document_type})

    return IngestDocumentResponse(
        source_id=source_id,
        chunks_created=chunks,
        page_count=page_count,
        summary=summary,
        key_topics=["legal"],
        document_type_detected=request.document_type,
    )


@router.post("/analyze-contract", response_model=AnalyzeContractResponse, summary="Analyze contract")
async def analyze_contract(request: AnalyzeContractRequest) -> AnalyzeContractResponse:
    """Perform comprehensive risk analysis on a contract or legal document."""
    if settings.MOCK_MODE:
        return AnalyzeContractResponse(
            analysis=ContractAnalysis(
                summary="This is a Mutual Non-Disclosure Agreement between two technology companies for partnership evaluation purposes. The agreement is broadly written with several one-sided provisions favoring the disclosing party.",
                risk_level="medium",
                risks=[
                    {"clause": "Definition of Confidential Information (Clause 2)", "risk": "Overly broad definition includes all verbal communications – difficult to track and enforce", "severity": "medium"},
                    {"clause": "Duration (Clause 5)", "risk": "5-year term is 2x the industry standard of 2-3 years for startup-stage NDAs", "severity": "low"},
                    {"clause": "Residuals Clause (Clause 7)", "risk": "Allows retained information to be used in future products – creates IP leakage risk", "severity": "high"},
                    {"clause": "Unilateral Termination (Clause 9)", "risk": "Disclosing party can terminate with 30 days notice but residuals survive – your obligations continue", "severity": "medium"},
                ],
                unusual_clauses=[
                    "Residuals clause (Clause 7) – rare in mutual NDAs, typically only in one-sided agreements",
                    "No limitation on injunctive relief scope – broader than necessary",
                    "No carve-out for information independently developed – standard protection missing",
                ],
                missing_protections=[
                    "Dispute resolution mechanism (arbitration vs. litigation not specified)",
                    "Data protection / GDPR compliance obligations",
                    "Limitation on remedies beyond injunctive relief",
                    "Carve-out for publicly available information developed independently",
                ],
                key_terms={
                    "governing_law": "Delaware, United States",
                    "duration": "5 years",
                    "scope": "Product roadmap, customer data, financial projections",
                    "permitted_disclosures": "Legal counsel, advisors under NDA",
                    "dispute_resolution": "Not specified",
                },
                overall_assessment="Proceed with negotiation. Request removal or modification of the residuals clause (Clause 7) and addition of a carve-out for independently developed information. The 5-year term should be renegotiated to 2-3 years.",
            ),
            disclaimer=LEGAL_DISCLAIMER,
        )

    contract_text = request.contract_text
    if request.source_id:
        chunks = await _rag.retrieve(request.user_id, "contract analysis key terms risks", top_k=10, source_agent="lex")
        if chunks:
            contract_text = "\n\n".join(c.get("content", "") for c in chunks)

    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Analyze this contract:\n{contract_text[:4000]}\n\n"
            f"Focus on: {request.analysis_focus}\n\n"
            "Return JSON with fields: summary, risk_level, risks (list of objects with clause/risk/severity), "
            "unusual_clauses, missing_protections, key_terms (dict), overall_assessment"
        )}],
    )
    try:
        data = json.loads(strip_json_fences(raw))
        analysis = ContractAnalysis(**data)
    except Exception:
        analysis = ContractAnalysis(
            summary=raw[:500],
            risk_level="unknown",
            risks=[],
            unusual_clauses=[],
            missing_protections=[],
            key_terms={},
            overall_assessment="Manual review recommended.",
        )
    return AnalyzeContractResponse(analysis=analysis, disclaimer=LEGAL_DISCLAIMER)


@router.post("/draft-document", response_model=DraftDocumentResponse, summary="Draft legal document")
async def draft_document(request: DraftDocumentRequest) -> DraftDocumentResponse:
    """Draft a legal document template based on requirements."""
    if settings.MOCK_MODE:
        return DraftDocumentResponse(
            document=f"""MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of [DATE] by and between:

Party A: [COMPANY NAME], a Delaware corporation ("Company A")
Party B: [COMPANY NAME], a Delaware corporation ("Company B")

(Each a "Party" and collectively the "Parties")

1. PURPOSE
The Parties wish to explore a potential business relationship ("Purpose") and may need to disclose certain confidential information to each other.

2. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any information disclosed by either Party to the other Party, either directly or indirectly, in writing, orally, or by inspection of tangible objects, that is designated as "Confidential" at the time of disclosure.

Confidential Information does NOT include information that:
(a) Is or becomes publicly available through no breach of this Agreement
(b) Was rightfully known to the Receiving Party before disclosure
(c) Is independently developed by the Receiving Party without use of Confidential Information
(d) Is required to be disclosed by law or court order

3. OBLIGATIONS
Each Party agrees to: (a) hold the other's Confidential Information in strict confidence; (b) not disclose it to third parties without prior written consent; (c) use it solely for the Purpose; (d) limit access to employees with a need to know.

4. TERM
This Agreement shall remain in effect for two (2) years from the Effective Date, unless earlier terminated by either Party with 30 days written notice.

5. GOVERNING LAW
This Agreement shall be governed by the laws of the State of {request.jurisdiction.split('(')[-1].rstrip(')') if '(' in request.jurisdiction else 'Delaware'}, without regard to its conflict of laws provisions.

6. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.

COMPANY A                               COMPANY B
By: _______________________             By: _______________________
Name: _____________________            Name: _____________________
Title: _____________________           Title: _____________________
Date: ______________________           Date: ______________________
""",
            review_notes=[
                "TEMPLATE ONLY – requires customization before use",
                "Insert full legal names and entity types in the header",
                "Add specific description of the business purpose in Section 1",
                "Adjust the definition scope in Section 2 based on your actual sharing needs",
                "Consider adding a data protection clause if sharing personal data (GDPR/CCPA implications)",
                "Have this reviewed by a qualified attorney in your jurisdiction before signing",
            ],
            disclaimer=LEGAL_DISCLAIMER,
        )

    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Draft a {request.document_type} with these requirements:\n{request.requirements}\nJurisdiction: {request.jurisdiction}\nAdditional clauses needed: {request.additional_clauses}"}],
        max_tokens=4096,
    )
    return DraftDocumentResponse(
        document=raw,
        review_notes=["DRAFT ONLY – not legal advice", "Have reviewed by a qualified attorney"],
        disclaimer=LEGAL_DISCLAIMER,
    )


@router.post("/explain", response_model=ExplainResponse, summary="Explain legal text")
async def explain_legal_text(request: ExplainRequest) -> ExplainResponse:
    """Explain legal text in plain English with practical implications."""
    if settings.MOCK_MODE:
        return ExplainResponse(
            explanation=(
                "In plain English: You must keep the other party's confidential information completely private "
                "and not share it with anyone else. You can only get their permission to share it, and that "
                "permission must be in writing. This is a standard confidentiality obligation found in most NDAs.\n\n"
                "What this means for you: Once you sign this, sharing anything they've told you (product plans, "
                "financials, customer lists, etc.) with anyone else – even your own investors or advisors – "
                "requires their explicit written approval first."
            ),
            key_terms={
                "Receiving Party": "The person or company receiving the confidential information (likely you)",
                "Confidential Information": "Any information marked or identified as confidential during disclosure",
                "Third Party": "Anyone other than the two parties signing this agreement",
                "Prior Written Consent": "Written permission obtained BEFORE the disclosure, not after",
                "Disclosing Party": "The party sharing their confidential information with you",
            },
            related_concepts=[
                "Trade secret protection",
                "Attorney-client privilege (exception to NDA obligations)",
                "Carve-outs for publicly available information",
                "Return or destruction of confidential information upon termination",
            ],
            practical_implications=[
                "You cannot share their information with your investors without getting written approval first",
                "Internal team members who don't need to know should NOT be briefed on their confidential details",
                "Keep records of all confidential disclosures – document what was shared and when",
                "If you're subpoenaed, you may have a legal obligation to disclose – notify the disclosing party immediately",
                "Verbal disclosures also count if marked confidential at the time",
            ],
        )

    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Explain this legal text in plain English:\n\n{request.text}\n\n"
            f"Context: {request.context or 'None'}\n\n"
            "Return JSON with fields: explanation, key_terms (dict), related_concepts (list), practical_implications (list)"
        )}],
    )
    try:
        data = json.loads(strip_json_fences(raw))
        return ExplainResponse(**data)
    except Exception:
        return ExplainResponse(
            explanation=raw,
            key_terms={},
            related_concepts=[],
            practical_implications=[],
        )


@router.post("/legal-research", response_model=LegalResearchResponse, summary="Research legal questions")
async def legal_research(request: LegalResearchRequest) -> LegalResearchResponse:
    """Research laws, regulations, and case precedents for a legal question."""
    if settings.MOCK_MODE:
        return LegalResearchResponse(
            summary=(
                "GDPR Article 7 sets strict requirements for consent. Consent must be freely given, specific, "
                "informed, and unambiguous. Pre-ticked boxes, bundled consent, and vague language are explicitly prohibited. "
                "Organizations must be able to demonstrate that consent was properly obtained."
            ),
            applicable_laws=[
                "GDPR Article 7 (Conditions for consent)",
                "GDPR Recital 32 (Affirmative consent requirement)",
                "GDPR Article 4(11) (Definition of consent)",
                "ePrivacy Directive (for cookies and electronic communications)",
                "GDPR Article 17 (Right to erasure — consent withdrawal triggers this)",
            ],
            key_requirements=[
                "Consent must be a clear affirmative act (no pre-ticked boxes or silence)",
                "Granular consent required — separate consent per distinct processing purpose",
                "As easy to withdraw consent as to give it",
                "Maintain records of consent: timestamp, IP address, consent version, method",
                "Children under 16 require parental consent (age threshold varies by EU member state: 13-16)",
                "No bundled consent — consent for services cannot be conditioned on unrelated data processing",
            ],
            relevant_cases=[
                "Planet49 GmbH v Bundesverband (CJEU C-673/17, 2019) — pre-ticked boxes invalid",
                "Fashion ID GmbH v Verbraucherzentrale NRW (CJEU C-40/17, 2019) — joint controller liability",
                "CNIL enforcement actions (France, 2022-2023) — cookie consent dark patterns fined",
                "DSK (Germany) — guidance on valid consent for analytics tracking",
            ],
            practical_guidance=[
                "Implement a proper Consent Management Platform (CMP) with granular opt-in toggles",
                "Store consent records server-side with timestamp, IP, consent version, and method",
                "Provide a dedicated privacy settings page where users can withdraw individual consents",
                "Refresh consent if processing purpose changes significantly",
                "Avoid pre-checked boxes, confusing UX, or consent walls that block access",
                "Conduct a Legitimate Interest Assessment (LIA) as an alternative basis where consent is impractical",
            ],
            jurisdiction_notes="EU-wide requirement under GDPR. Individual member states may impose stricter requirements (e.g., Germany's TTDSG for cookies, France's CNIL guidelines).",
            confidence_level="high — based on GDPR text, CJEU case law, and supervisory authority guidance",
            disclaimer=LEGAL_DISCLAIMER,
        )

    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Research this legal question:\n{request.query}\n\n"
            f"Jurisdiction: {request.jurisdiction}\n"
            f"Legal areas: {', '.join(request.legal_areas) if request.legal_areas else 'general'}\n\n"
            "Return ONLY a JSON object (no markdown fences) with keys: "
            "summary, applicable_laws, key_requirements, relevant_cases, "
            "practical_guidance, jurisdiction_notes, confidence_level"
        )}],
    )
    try:
        data = json.loads(strip_json_fences(raw))
        return LegalResearchResponse(**data, disclaimer=LEGAL_DISCLAIMER)
    except Exception:
        return LegalResearchResponse(
            summary=raw[:500],
            applicable_laws=[], key_requirements=[], relevant_cases=[],
            practical_guidance=[], jurisdiction_notes=request.jurisdiction,
            confidence_level="medium — consult an attorney for verified research",
            disclaimer=LEGAL_DISCLAIMER,
        )


@router.post("/compliance-check", response_model=ComplianceCheckResponse, summary="Check regulatory compliance")
async def compliance_check(request: ComplianceCheckRequest) -> ComplianceCheckResponse:
    """Evaluate compliance against GDPR, CCPA, SOC2, HIPAA and other frameworks."""
    if settings.MOCK_MODE:
        return ComplianceCheckResponse(
            overall_status="partial",
            framework_results=[
                {
                    "framework": "GDPR",
                    "status": "non_compliant",
                    "gaps": [
                        "No explicit consent flow for data collection",
                        "EU data stored on US servers without valid transfer mechanism (SCCs or adequacy decision required)",
                        "90-day retention not documented or justified under storage limitation principle",
                    ],
                    "requirements": [
                        "Article 7 — valid consent mechanism",
                        "Chapter V — lawful EU-to-US data transfer mechanism",
                        "Article 5(1)(e) — storage limitation with defined retention policy",
                        "Article 13/14 — privacy notice with processing purposes",
                    ],
                },
                {
                    "framework": "CCPA",
                    "status": "partial",
                    "gaps": [
                        "No 'Do Not Sell or Share My Personal Information' opt-out link",
                        "Privacy notice does not describe categories of data collected or purposes",
                    ],
                    "requirements": [
                        "CCPA Section 1798.120 — right to opt out of sale/sharing",
                        "Section 1798.100 — right to know what data is collected",
                        "Section 1798.130 — designated methods for submitting requests",
                    ],
                },
            ],
            critical_gaps=[
                "Storing EU personal data on US servers without SCCs — active GDPR violation",
                "No consent mechanism — GDPR Article 7 violation with fines up to 4% of global revenue",
                "No opt-out mechanism for California residents — CCPA violation",
            ],
            remediation_steps=[
                {"priority": "high", "action": "Execute Standard Contractual Clauses (SCCs) for EU→US data transfers, or migrate EU data to EU-based infrastructure within 30 days"},
                {"priority": "high", "action": "Implement a consent management platform with GDPR-compliant granular consent flows for each processing purpose"},
                {"priority": "high", "action": "Add 'Do Not Sell or Share My Personal Information' link to footer and implement opt-out mechanism for California residents"},
                {"priority": "medium", "action": "Update privacy notice to describe data categories, purposes, retention periods, and user rights"},
                {"priority": "medium", "action": "Document and justify the 90-day retention period or reduce it to minimum necessary"},
            ],
            estimated_effort="2-4 weeks for critical compliance items, 2-3 months for full implementation and documentation",
            disclaimer=LEGAL_DISCLAIMER,
        )

    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
            f"Evaluate the regulatory compliance of this practice or document:\n{request.description}\n\n"
            f"Business context: {request.business_context or 'Not provided'}\n"
            f"Check against: {', '.join(request.frameworks)}\n\n"
            "Return ONLY a JSON object (no markdown fences) with keys: "
            "overall_status (compliant/partial/non_compliant), "
            "framework_results (list of {framework, status, gaps, requirements}), "
            "critical_gaps (list of strings), "
            "remediation_steps (list of {priority: high/medium/low, action: string}), "
            "estimated_effort (string)"
        )}],
    )
    try:
        data = json.loads(strip_json_fences(raw))
        return ComplianceCheckResponse(**data, disclaimer=LEGAL_DISCLAIMER)
    except Exception:
        return ComplianceCheckResponse(
            overall_status="unknown",
            framework_results=[], critical_gaps=[],
            remediation_steps=[],
            estimated_effort="Manual review required",
            disclaimer=LEGAL_DISCLAIMER,
        )

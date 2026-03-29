import uuid
import base64
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from agents.lex.agent import LexAgent, LEGAL_DISCLAIMER

router = APIRouter(prefix="/ai/lex", tags=["Lex"])

_llm = LLMClient()
_rag = RAGService()
_agent = LexAgent(_llm, _rag)


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
    risk_level: str  # "low" | "medium" | "high"
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


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Lex chat")
async def lex_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Lex's legal response as a standard JSON response. Always includes disclaimer in metadata."""
    result = await _agent.chat_sync(request)
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

    # Retrieve RAG context if source_id provided
    contract_text = request.contract_text
    if request.source_id:
        chunks = await _rag.retrieve(request.user_id, "contract analysis key terms risks", top_k=10, source_agent="lex")
        if chunks:
            contract_text = "\n\n".join(c.get("content", "") for c in chunks)

    system = await _agent.build_system_prompt(request.user_id)
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Analyze this contract:\n{contract_text[:4000]}\n\nFocus on: {request.analysis_focus}\n\nReturn JSON with fields: summary, risk_level, risks (list of objects), unusual_clauses, missing_protections, key_terms (dict), overall_assessment"}],
    )
    try:
        data = json.loads(raw)
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
    import json
    raw = await _llm.complete(
        provider=_agent.default_provider, model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": f"Explain this legal text in plain English:\n\n{request.text}\n\nContext: {request.context or 'None'}\n\nReturn JSON with fields: explanation, key_terms (dict), related_concepts (list), practical_implications (list)"}],
    )
    try:
        data = json.loads(raw)
        return ExplainResponse(**data)
    except Exception:
        return ExplainResponse(
            explanation=raw,
            key_terms={},
            related_concepts=[],
            practical_implications=[],
        )

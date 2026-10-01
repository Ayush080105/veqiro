import io
import asyncio
import logging
import re
import base64
import json
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from core.llm import LLMClient
from core.rag import RAGService
from core.models import ChatRequest, ChatSyncResponse
from core.config import settings
from core.streaming import sse_format, stream_chat_sync_response
from core.utils import strip_json_fences, safe_json_loads
from agents.lex.agent import LexAgent
from agents.lex import services as lex_services
from agents.lex.contract_analysis import analyze_contract_text

router = APIRouter(prefix="/ai/lex", tags=["Lex"])
logger = logging.getLogger("lex.routes")

from agents.registry import register_agent

_llm = LLMClient()
_rag = RAGService()
_agent = LexAgent(_llm, _rag)
register_agent(_agent)


# ── Models ───────────────────────────────────────────────────────────────────

class IngestDocumentRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    document_name: str
    document_type: str = "nda"
    document_url: str | None = None
    pdf_base64: str | None = None
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "document_name": "Acme Corp NDA 2025",
                "document_type": "nda",
                "document_url": "https://pub-xxxx.r2.dev/documents/acme-nda-2025.pdf",
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
    tokens_used: int = 0
    model_used: str = ""


class AnalyzeContractRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    source_id: str | None = None
    # Pasted text, used when no uploaded document is chosen.
    contract_text: str = ""
    # Which party to review for; inferred from the brand kit and the document when empty.
    perspective: str = ""
    analysis_focus: list[str] = Field(default_factory=list)
    # The company's usual positions ({key, label, value}); departures become findings.
    preferences: list[dict] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "source_id": "doc_abc123",
            }
        }
    )


class ClauseRisk(BaseModel):
    clause: str
    risk: str
    severity: str        # low / medium / high / critical
    recommendation: str
    confidence: str | None = None   # high / medium / low
    basis: str | None = None        # one-sentence legal justification


class ScoreBreakdown(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class ObligationItem(BaseModel):
    action: str
    deadline: str | None = None
    condition: str | None = None
    consequence: str | None = None


class PartyObligations(BaseModel):
    party: str
    items: list[ObligationItem]


class AmbiguousClause(BaseModel):
    clause: str
    section: str | None = None
    issue: str
    interpretation: str


class NegotiationPoint(BaseModel):
    priority: str        # high / medium / low
    clause: str
    issue: str
    suggested_change: str


class ContractAnalysis(BaseModel):
    # Overview
    document_type: str
    parties: list[str]
    effective_date: str
    governing_law: str
    jurisdiction: str

    # Summary
    executive_summary: str
    risk_level: str      # low / medium / high / critical
    risk_score: int      # 1–10

    # Risk breakdown
    risks: list[ClauseRisk]
    unusual_clauses: list[str]
    missing_protections: list[str]

    # Clause-by-clause
    clause_breakdown: list[dict]  # {section, title, summary, risk_level, notes}

    # Key terms
    key_terms: dict

    # Obligations per party
    obligations: dict    # {"Party A name": [...], "Party B name": [...]}

    # Negotiation guidance
    negotiation_points: list[NegotiationPoint]

    # Verdict
    overall_assessment: str
    recommended_action: str  # sign / negotiate / reject / legal_review_required

    # Enhanced fields (optional — absent on older cached results)
    score_breakdown: ScoreBreakdown | None = None
    obligations_structured: list[PartyObligations] | None = None
    ambiguous_clauses: list[AmbiguousClause] | None = None

    # Version 2 — verdict-first review (see agents/lex/contract_analysis.py)
    version: int = 1
    failed: bool = False
    perspective: str = ""
    counterparty: str = ""
    verdict: dict | None = None
    favours: dict | None = None
    key_facts: list[dict] = Field(default_factory=list)
    issues: list[dict] = Field(default_factory=list)
    key_dates: list[dict] = Field(default_factory=list)
    contract: dict | None = None
    clauses: list[dict] = Field(default_factory=list)


class AnalyzeContractResponse(BaseModel):
    analysis: ContractAnalysis
    tokens_used: int = 0
    model_used: str = ""


class QueryDocumentRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    source_id: str
    query: str
    top_k: int = 5
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "source_id": "doc_abc123",
                "query": "What are the termination conditions and notice periods?",
                "top_k": 5,
            }
        }
    )


class QueryDocumentChunk(BaseModel):
    content: str
    score: float
    metadata: dict = {}


class QueryDocumentCitation(BaseModel):
    section: str = ""
    quote: str


class QueryDocumentResponse(BaseModel):
    answer: str
    short_answer: str = ""
    found: bool = True
    citations: list[QueryDocumentCitation] = Field(default_factory=list)
    sources: list[QueryDocumentChunk]
    tokens_used: int = 0
    model_used: str = ""


class SourceContentRequest(BaseModel):
    user_id: str
    source_id: str


class SourceContentResponse(BaseModel):
    source_id: str
    content: str
    chunk_count: int


class DraftDocumentRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    document_type: str
    requirements: str
    jurisdiction: str = ""
    additional_clauses: list[str] = []
    metadata: dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "user_123",
                "document_type": "mutual_nda",
                "requirements": "Mutual NDA between two SaaS companies for a potential partnership discussion. 2-year term, covers product roadmap and customer data.",
                "jurisdiction": "India",
                "additional_clauses": ["data_protection", "ip_assignment_exclusion"],
            }
        }
    )


class DraftDocumentResponse(BaseModel):
    document: str
    review_notes: list[str]
    document_type: str = ""
    jurisdiction: str = ""
    tokens_used: int = 0
    model_used: str = ""


class ExplainRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    text: str
    context: str | None = None
    metadata: dict = Field(default_factory=dict)

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
    tokens_used: int = 0
    model_used: str = ""


class LegalResearchRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    query: str
    jurisdiction: str = ""
    legal_areas: list[str] = []
    metadata: dict = Field(default_factory=dict)

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


class LegalResearchSource(BaseModel):
    title: str = ""
    url: str
    # statute | case_law | government_guidance | commentary
    kind: str = "commentary"
    date: str = ""


class LegalResearchResponse(BaseModel):
    answer: str
    sections: list[dict] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)
    relevant_cases: list[str] = Field(default_factory=list)
    jurisdiction_notes: str = ""
    confidence_level: str = "medium"
    jurisdiction: str = ""
    sources: list[LegalResearchSource] = Field(default_factory=list)
    failed: bool = False
    tokens_used: int = 0
    model_used: str = ""


class ComplianceCheckRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    description: str
    frameworks: list[str] = Field(default_factory=list)
    business_context: str = ""
    jurisdiction: str = ""
    metadata: dict = Field(default_factory=dict)

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
    jurisdiction: str = ""
    failed: bool = False


class DraftReplyRequest(BaseModel):
    user_id: str
    organization_id: str = ""
    analysis: dict
    sender: str = ""
    tone: str = "firm but friendly"
    metadata: dict = Field(default_factory=dict)


class DraftReplyChange(BaseModel):
    section: str = ""
    current: str
    proposed: str
    reason: str = ""


class DraftReplyResponse(BaseModel):
    subject: str
    email: str
    changes: list[DraftReplyChange]
    counterparty: str = ""
    changes_document: str = ""
    model_used: str = ""
    tokens_used: int = 0
    model_used: str = ""


class DeleteSourceRequest(BaseModel):
    user_id: str
    source_id: str


class DeleteSourceResponse(BaseModel):
    deleted_chunks: int


class ListSourcesRequest(BaseModel):
    user_id: str


class SourceSummary(BaseModel):
    source_id: str
    source_type: str
    source_agent: str
    metadata: dict = {}
    created_at: str | None = None


class ListSourcesResponse(BaseModel):
    sources: list[SourceSummary]


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatSyncResponse, summary="Lex chat")
async def lex_chat(request: ChatRequest) -> ChatSyncResponse:
    """Get Lex's legal response."""
    return await _agent.chat_sync(request)


@router.post("/chat/stream", summary="Lex chat (streamed)")
async def lex_chat_stream(request: ChatRequest) -> StreamingResponse:
    """Same as /chat, but progressively — live tool_call/tool_result events
    followed by chunked token events, then a done event carrying the same
    fields the non-streaming response returns."""
    events = stream_chat_sync_response(_agent.chat_sync_stream(request), _agent.slug)
    return StreamingResponse(sse_format(events), media_type="text/event-stream")


@router.post("/ingest-document", response_model=IngestDocumentResponse, summary="Ingest legal document")
async def ingest_document(request: IngestDocumentRequest) -> IngestDocumentResponse:
    """Upload and process a legal document (PDF) for review and Q&A."""
    if settings.MOCK_MODE:
        return IngestDocumentResponse(
            source_id=f"doc_{str(uuid.uuid4())[:8]}",
            chunks_created=8,
            page_count=4,
            summary=(
                "A mutual NDA between two companies exploring a partnership. It runs for 5 years and "
                "includes a residuals clause that lets the other side reuse what they remember."
            ),
            key_topics=["Confidentiality", "Residuals", "Term", "Dispute resolution"],
            document_type_detected="nda",
        )

    import asyncio
    import base64 as _base64
    from fastapi import HTTPException

    if request.pdf_base64:
        try:
            pdf_bytes = _base64.b64decode(request.pdf_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 PDF data: {e}")
    elif request.document_url:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=settings.R2_FETCH_TIMEOUT) as client:
                resp = await client.get(request.document_url)
                resp.raise_for_status()
                pdf_bytes = resp.content
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch document from URL: {e}")
    else:
        raise HTTPException(status_code=400, detail="Either pdf_base64 or document_url is required")

    from core.pdf_reader import extract_text_with_vision, extract_pages

    try:
        full_text = await extract_text_with_vision(pdf_bytes, _llm)
    except Exception:
        from core.pdf_reader import extract_text
        full_text = extract_text(pdf_bytes)

    page_count = len(extract_pages(pdf_bytes))
    source_id = f"doc_{str(uuid.uuid4())[:8]}"
    meta = {"document_name": request.document_name, "document_type": request.document_type}

    chunks_count, summary = await asyncio.gather(
        _rag.ingest(request.user_id, full_text, "pdf", source_id, "lex", meta),
        lex_services.summarize_document(
            _llm, provider=_agent.default_provider, model=_agent.default_model,
            full_text=full_text, fallback_type=request.document_type,
        ),
    )
    return IngestDocumentResponse(
        source_id=source_id,
        chunks_created=chunks_count,
        page_count=page_count,
        summary=summary["summary"],
        key_topics=summary["key_topics"],
        document_type_detected=summary["document_type_detected"],
        model_used=_agent.default_model,
    )


_MOCK_REVIEW = {
    "document_type": "Mutual NDA",
    "parties": ["Acme Corp (Disclosing Party)", "Beta Inc (Receiving Party)"],
    "perspective": "Beta Inc (Receiving Party)",
    "counterparty": "Acme Corp",
    "verdict": {"action": "negotiate", "headline": "Sign after 2 changes",
                "summary": "The residuals clause lets Acme reuse anything its staff remember, which undercuts the NDA. Remove it and cap the term at 3 years."},
    "favours": {"party": "Acme Corp", "lean": 70},
    "risk_level": "high", "risk_score": 6,
    "key_facts": [
        {"label": "Term", "value": "5 years"}, {"label": "Survival", "value": "Indefinite after termination"},
        {"label": "Exit", "value": "30 days' written notice"}, {"label": "Disputes", "value": "Courts at Mumbai"},
    ],
    "issues": [
        {"severity": "high", "kind": "risk", "title": "They can reuse what they remember", "section": "7",
         "quote": "Nothing shall restrict use of information retained in the unaided memory of personnel.",
         "what_it_means": "Anything Acme's team remembers from your product or pricing can be used freely, which empties the NDA.",
         "send_back": "Delete Section 7."},
        {"severity": "medium", "kind": "unusual", "title": "Five-year term is long", "section": "5",
         "quote": "This Agreement shall remain in force for a period of five (5) years.",
         "what_it_means": "You carry confidentiality duties well beyond a normal evaluation period.",
         "send_back": "This Agreement shall remain in force for three (3) years from the Effective Date."},
        {"severity": "medium", "kind": "missing", "title": "No return-or-destroy deadline", "section": "",
         "quote": "", "what_it_means": "Nothing forces Acme to hand back or delete your information when talks end.",
         "send_back": "Within 15 days of written request, the Receiving Party shall return or destroy all Confidential Information."},
    ],
    "key_dates": [
        {"when": "Within 15 days of request", "what": "Return or destroy confidential information", "section": "9", "recurrence": "once", "days_from_start": None},
        {"when": "5 years after signing", "what": "Agreement ends; survival clauses continue", "section": "5", "recurrence": "once", "days_from_start": 1825},
    ],
    "clauses": [
        {"section": "1", "title": "Purpose", "summary": "Information is shared only to evaluate a partnership.", "risk_level": "low"},
        {"section": "7", "title": "Residuals", "summary": "Remembered information is free to use.", "risk_level": "high"},
    ],
    "key_terms": {"Residuals": "Information kept in someone's memory without notes or copies."},
    "effective_date": "1 January 2026", "governing_law": "Laws of India", "jurisdiction": "Courts at Mumbai",
}


@router.post("/analyze-contract", response_model=AnalyzeContractResponse, summary="Analyze contract")
async def analyze_contract(request: AnalyzeContractRequest) -> AnalyzeContractResponse:
    """Review a contract: verdict, key facts, issues with send-back wording, and key dates."""
    from fastapi import HTTPException
    from agents.lex.contract_analysis import normalize_analysis

    if settings.MOCK_MODE:
        return AnalyzeContractResponse(analysis=ContractAnalysis(**normalize_analysis(_MOCK_REVIEW)))

    if request.source_id:
        full_text = await _rag.source_text(request.user_id, request.source_id)
        if not full_text:
            raise HTTPException(status_code=404, detail=f"No document found for source_id '{request.source_id}'")
    elif request.contract_text.strip():
        full_text = request.contract_text.strip()
    else:
        raise HTTPException(status_code=422, detail="Provide a source_id or contract_text")

    system, company_name = await asyncio.gather(
        _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False),
        lex_services.org_company_name(request.organization_id),
    )
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    data = await analyze_contract_text(
        _llm, provider=_agent.default_provider, model=_agent.default_model,
        system=system, full_text=full_text, perspective=request.perspective,
        company_name=company_name, focus=request.analysis_focus, preferences=request.preferences,
    )
    return AnalyzeContractResponse(analysis=ContractAnalysis(**data), model_used=_agent.default_model)


@router.post("/query-document", response_model=QueryDocumentResponse, summary="Query document via RAG")
async def query_document(request: QueryDocumentRequest) -> QueryDocumentResponse:
    """Answer a question about one uploaded document, quoting the passages it relies on."""
    if settings.MOCK_MODE:
        return QueryDocumentResponse(
            answer="Either side can end the agreement with 30 days' written notice. Your confidentiality duties continue after it ends, with no time limit.",
            found=True,
            citations=[
                QueryDocumentCitation(section="9", quote="Either party may terminate this Agreement upon 30 days written notice to the other party."),
                QueryDocumentCitation(section="9.2", quote="Confidentiality obligations shall survive the expiration or termination of this Agreement."),
            ],
            sources=[],
        )

    chunks = await _rag.retrieve(
        user_id=request.user_id,
        query=request.query,
        top_k=request.top_k,
        source_id=request.source_id,
        # Scoped to the one document the user picked, so every chunk is on-topic: rank by
        # similarity and keep the best top_k. The default 0.70 floor rejected every chunk of
        # real contracts (best match ~0.62) and turned each question into a 404.
        min_score=0.0,
    )
    if not chunks:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No document found for source_id '{request.source_id}'")

    result = await lex_services.answer_from_document(
        _llm, provider=_agent.default_provider, model=_agent.default_model,
        question=request.query, chunks=chunks,
    )
    return QueryDocumentResponse(
        answer=result["answer"],
        short_answer=result["short_answer"],
        found=result["found"],
        citations=[QueryDocumentCitation(**c) for c in result["citations"]],
        sources=[QueryDocumentChunk(content=c["content"], score=c["score"], metadata=c.get("metadata", {})) for c in chunks],
        model_used=_agent.default_model,
    )


@router.post("/source-content", response_model=SourceContentResponse, summary="Fetch full text of an ingested source")
async def source_content(request: SourceContentRequest) -> SourceContentResponse:
    """Full document text in reading order, for callers that hand a whole document to the model
    as context (e.g. an explicit '#' attach in chat) rather than the top-k search
    /query-document does."""
    if settings.MOCK_MODE:
        return SourceContentResponse(source_id=request.source_id, content="Mock document content.", chunk_count=1)

    chunks = await _rag.retrieve_by_source(request.user_id, request.source_id)
    if not chunks:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No document found for source_id '{request.source_id}'")

    from core.rag import join_chunks
    return SourceContentResponse(source_id=request.source_id, content=join_chunks(chunks), chunk_count=len(chunks))


def _get_draft_review_notes(document_type: str, jurisdiction: str, additional_clauses: list[str]) -> list[str]:
    doc_lower = document_type.lower()
    notes: list[str] = []
    in_india = "india" in jurisdiction.lower()

    # ── Binding legal documents ────────────────────────────────────────────────
    is_binding = any(k in doc_lower for k in (
        "agreement", "contract", "nda", "non-disclosure", "confidentiality",
        "saas", "service agreement", "shareholder", "founder", "vendor",
        "supplier", "license", "lease", "terms of service", "terms and conditions",
        "mou", "memorandum", "deed", "settlement", "indemnity",
    ))
    if is_binding:
        notes.append("TEMPLATE ONLY — consult a qualified attorney before signing or distributing")

    # ── Letters ───────────────────────────────────────────────────────────────
    if any(k in doc_lower for k in ("resignation", "resign")):
        notes += [
            "Fill in the employee's full last name and any remaining [BRACKET] fields",
            "Confirm the exact last working day — check your employment contract's required notice period",
            "Review the reason stated — consider whether to keep, soften, or omit specific reasons before sending",
            "Verify whether HR requires a separate clearance or handover checklist",
            "Keep a signed or sent copy for your personal records",
        ]
    elif any(k in doc_lower for k in ("offer letter", "job offer")):
        notes += [
            "Confirm all compensation figures (salary, bonus) are accurate before sending",
            "Verify the start date, role title, and reporting line",
            "Reference your equity/option plan document if applicable",
            "Have HR or legal review before sending to the candidate",
        ]
    elif any(k in doc_lower for k in ("demand letter", "legal notice", "cease and desist")):
        notes += [
            "Verify the recipient's full legal name and mailing address",
            "Confirm all factual claims are accurate and can be documented",
            "Set a realistic response deadline (typically 10–30 days)",
            "Send via certified mail and retain proof of delivery",
            "Have an attorney review before sending — a poorly worded demand can undermine your position",
        ]
    elif "cover letter" in doc_lower:
        notes += [
            "Personalise the opening paragraph to reference the specific role and company",
            "Ensure your contact details and the hiring manager's name are correct",
            "Tailor the skills highlighted to match the job description",
        ]
    elif any(k in doc_lower for k in ("recommendation letter", "reference letter")):
        notes += [
            "Confirm the subject's name, role, and dates of association are correct",
            "Add specific examples or achievements to make the letter more credible",
            "Include your title and contact details so the recipient can verify",
        ]

    # ── Contracts & agreements ────────────────────────────────────────────────
    elif any(k in doc_lower for k in ("nda", "non-disclosure", "confidentiality")):
        notes += [
            "Fill in full legal names and entity types (Pvt Ltd, LLP, proprietorship) for both parties"
            if in_india else "Fill in full legal names and entity types (LLC, Inc., Ltd.) for both parties",
            "Specify the exact confidentiality period — standard range is 2–5 years",
            "Define the scope of 'Confidential Information' to match what you'll actually share",
            "Add a data-protection clause if sharing personal data (DPDP Act, 2023)"
            if in_india else "Add a DPA clause if sharing personal data (GDPR/CCPA may apply)",
            "Confirm the governing law matches where your business is registered",
        ]
    elif any(k in doc_lower for k in ("employment contract", "employment agreement")):
        notes += [
            "Confirm compensation, start date, and role title are accurate",
            "Confirm the IP assignment covers work created during employment",
            "Post-employment non-competes are void in India (Contract Act s.27) — keep restrictions to the employment period"
            if in_india else "Review non-compete scope — many US states (CA, MN, ND) restrict or ban them",
            "Check probation, notice period and gratuity terms against your state's Shops and Establishments Act"
            if in_india else "Confirm at-will / probation language matches your local employment law",
            "Add equity or bonus details referencing a separate option plan if applicable",
        ]
    elif any(k in doc_lower for k in ("saas", "software", "service agreement", "subscription")):
        notes += [
            "Confirm SLA uptime percentage and credit/remedy structure",
            "Check liability cap — typically tied to fees paid in the prior 12 months",
            "Add a DPA if you handle EU/UK personal data",
            "Verify auto-renewal window and the required cancellation notice period",
        ]
    elif any(k in doc_lower for k in ("founder", "co-founder", "shareholder")):
        notes += [
            "Confirm equity split percentages and vesting schedule (common: 4-year with 1-year cliff)",
            "Review IP assignment — all pre-existing relevant IP must be assigned to the company",
            "Verify drag-along and tag-along rights align with your cap table intentions",
            "Each party should have this reviewed by independent counsel before signing",
        ]
    elif any(k in doc_lower for k in ("vendor", "supplier", "procurement", "purchase order")):
        notes += [
            "Confirm payment terms (Net 30/60) and any late payment penalty rate",
            "Review indemnification — ensure it is mutual and proportionate",
            "Add acceptance testing criteria for software or physical deliverables",
            "Confirm warranty period and remedy for defective deliverables",
        ]

    # ── Notices, memos, policies ──────────────────────────────────────────────
    elif any(k in doc_lower for k in ("notice", "memo", "memorandum", "circular")):
        notes += [
            "Verify the To / From / Date fields are filled in correctly",
            "Confirm the subject line accurately describes the purpose",
            "Review the action items or deadlines stated and ensure they are achievable",
        ]
    elif any(k in doc_lower for k in ("privacy policy", "terms of service", "cookie policy", "refund policy")):
        notes += [
            "Have a lawyer review before publishing — policy documents can create legal obligations",
            "Confirm data types collected and retention periods are accurately described",
            "Verify compliance with the DPDP Act, 2023 and IT Rules (and GDPR if you serve EU users)"
            if in_india else "Verify compliance with applicable regulations (GDPR, CCPA, etc.) for your user base",
            "Keep a version history and update the 'last updated' date whenever you change the policy",
        ]

    # ── Generic fallback ──────────────────────────────────────────────────────
    else:
        notes += [
            "Fill in all [BRACKET] placeholders before using or sending this document",
            "Review all names, dates, and factual details for accuracy",
            "Adjust the tone or any specific language to fit your exact situation",
        ]
        if is_binding:
            notes += [
                "Verify the governing law and jurisdiction clause match your intended forum",
                "Review any liability, indemnification, or penalty clauses carefully",
            ]

    if additional_clauses:
        notes.append(
            f"Requested elements ({', '.join(additional_clauses[:3])}) have been included — verify they fit your situation"
        )

    if is_binding:
        if in_india:
            notes.append("Indian law document — confirm stamp duty requirements for your state before execution")
        elif "uk" in jurisdiction.lower() or "england" in jurisdiction.lower():
            notes.append("UK law document — confirm post-Brexit cross-border implications if any EU parties are involved")
        elif "eu" in jurisdiction.lower() or "europe" in jurisdiction.lower():
            notes.append("EU-governed document — GDPR Article 28 DPA is likely required; verify with your DPO")

    return notes


def _parse_document_sections(text: str) -> list[dict]:
    """Classify each line of a legal document for structured rendering."""
    lines = text.split("\n")
    sections: list[dict] = []
    in_signature = False
    found_title = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            sections.append({"type": "blank", "text": ""})
            continue

        if re.match(r"^(IN WITNESS WHEREOF|SIGNED BY|SIGNATURE PAGE|EXECUTED AS OF)", stripped, re.IGNORECASE):
            in_signature = True

        if in_signature:
            sections.append({"type": "signature", "text": stripped})
            continue

        if re.match(r"^\d+(\.\d+)*\.?\s+[A-Z]", stripped):
            sections.append({"type": "heading", "text": stripped})
            continue

        is_upper = stripped == stripped.upper() and re.search(r"[A-Z]", stripped) and len(stripped) > 3
        if is_upper and not found_title:
            sections.append({"type": "title", "text": stripped})
            found_title = True
            continue
        if is_upper and len(stripped.split()) <= 10:
            sections.append({"type": "heading", "text": stripped})
            continue

        if re.match(r"^\([a-z]\)\s", stripped):
            sections.append({"type": "subitem", "text": stripped})
            continue

        sections.append({"type": "body", "text": stripped})

    return sections


def _generate_docx(document_text: str, document_type: str, letterhead_bytes: bytes | None = None) -> bytes:
    from docx import Document as DocxDocument
    from docx.shared import Inches, Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = DocxDocument()
    for section in doc.sections:
        section.left_margin = Inches(1.25)
        section.right_margin = Inches(1.25)
        section.top_margin = Inches(1.5) if letterhead_bytes else Inches(1.0)
        section.bottom_margin = Inches(1.0)

    if letterhead_bytes:
        sec0 = doc.sections[0]
        header = sec0.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        # Negative indents cancel out page margins so image spans full page width
        hp.paragraph_format.left_indent = -sec0.left_margin
        hp.paragraph_format.right_indent = -sec0.right_margin
        hp.paragraph_format.space_before = Pt(0)
        hp.paragraph_format.space_after = Pt(0)
        hp.add_run().add_picture(io.BytesIO(letterhead_bytes), width=sec0.page_width)

    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(12)

    parsed = _parse_document_sections(document_text)
    sig_lines: list[str] = []

    for s in parsed:
        if s["type"] == "blank":
            continue
        elif s["type"] == "title":
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(s["text"])
            run.bold = True
            run.font.size = Pt(14)
            run.font.name = "Times New Roman"
            p.paragraph_format.space_after = Pt(6)
        elif s["type"] == "heading":
            p = doc.add_paragraph()
            run = p.add_run(s["text"])
            run.bold = True
            run.font.name = "Times New Roman"
            run.font.size = Pt(12)
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(4)
        elif s["type"] == "subitem":
            p = doc.add_paragraph(s["text"])
            p.paragraph_format.left_indent = Inches(0.3)
            p.runs[0].font.name = "Times New Roman"
        elif s["type"] == "signature":
            sig_lines.append(s["text"])
        else:
            p = doc.add_paragraph(s["text"])
            p.paragraph_format.space_after = Pt(4)
            if p.runs:
                p.runs[0].font.name = "Times New Roman"

    if sig_lines:
        doc.add_paragraph()
        for line in sig_lines:
            p = doc.add_paragraph(line)
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            if p.runs:
                p.runs[0].font.name = "Times New Roman"

    footer_para = doc.sections[0].footer.paragraphs[0]
    footer_para.text = ""

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _generate_pdf(document_text: str, document_type: str, letterhead_bytes: bytes | None = None) -> bytes:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    def _esc(t: str) -> str:
        return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    buf = io.BytesIO()
    if letterhead_bytes:
        from reportlab.lib.utils import ImageReader as _IR
        _isz = _IR(io.BytesIO(letterhead_bytes))
        _iw, _ih = _isz.getSize()
        top_margin = LETTER[0] * (_ih / _iw) + 0.25 * inch  # letterhead height + 18pt gap
    else:
        top_margin = 1.0 * inch
    doc_template = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=1.25 * inch, rightMargin=1.25 * inch,
        topMargin=top_margin, bottomMargin=0.9 * inch,
    )

    base = getSampleStyleSheet()["Normal"]
    title_style = ParagraphStyle("LexTitle", parent=base, fontName="Times-Bold",
                                  fontSize=14, alignment=TA_CENTER, spaceAfter=10)
    heading_style = ParagraphStyle("LexHeading", parent=base, fontName="Times-Bold",
                                    fontSize=12, alignment=TA_LEFT, spaceBefore=12, spaceAfter=5)
    body_style = ParagraphStyle("LexBody", parent=base, fontName="Times-Roman",
                                 fontSize=12, alignment=TA_JUSTIFY, spaceAfter=5, leading=17)
    sub_style = ParagraphStyle("LexSub", parent=base, fontName="Times-Roman",
                                fontSize=12, alignment=TA_LEFT, leftIndent=18, spaceAfter=4, leading=17)

    parsed = _parse_document_sections(document_text)
    story = []
    sig_lines: list[str] = []

    for s in parsed:
        if s["type"] == "blank":
            story.append(Spacer(1, 5))
        elif s["type"] == "title":
            story.append(Paragraph(_esc(s["text"]), title_style))
        elif s["type"] == "heading":
            story.append(Paragraph(_esc(s["text"]), heading_style))
        elif s["type"] == "subitem":
            story.append(Paragraph(_esc(s["text"]), sub_style))
        elif s["type"] == "signature":
            sig_lines.append(s["text"])
        else:
            story.append(Paragraph(_esc(s["text"]), body_style))

    if sig_lines:
        story.append(Spacer(1, 20))
        for line in sig_lines:
            story.append(Paragraph(_esc(line), body_style))

    def _footer(canvas, doc):
        canvas.saveState()
        if letterhead_bytes:
            from reportlab.lib.utils import ImageReader
            img = ImageReader(io.BytesIO(letterhead_bytes))
            iw, ih = img.getSize()
            draw_w = LETTER[0]
            draw_h = draw_w * (ih / iw)
            canvas.drawImage(img, 0, LETTER[1] - draw_h, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")
        canvas.setFont("Times-Italic", 8)
        canvas.drawRightString(LETTER[0] - 1.25 * inch, 0.5 * inch, f"Page {doc.page}")
        canvas.restoreState()

    doc_template.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()


@router.post("/draft-document", response_model=DraftDocumentResponse, summary="Draft legal document")
async def draft_document(request: DraftDocumentRequest) -> DraftDocumentResponse:
    """Draft a complete document for the user's jurisdiction (their organisation's, else India)."""
    from fastapi import HTTPException

    location = await lex_services.org_location(request.organization_id) if not settings.MOCK_MODE else ""
    jurisdiction = lex_services.resolve_jurisdiction(request.jurisdiction, location)
    notes = _get_draft_review_notes(request.document_type, jurisdiction, request.additional_clauses)

    if settings.MOCK_MODE:
        return DraftDocumentResponse(
            document=(
                "MUTUAL NON-DISCLOSURE AGREEMENT\n\n"
                "This Mutual Non-Disclosure Agreement is made on [DATE] between [PARTY A NAME], a company "
                "incorporated under the Companies Act, 2013 (\"Party A\"), and [PARTY B NAME] (\"Party B\").\n\n"
                "1. PURPOSE\nThe Parties wish to share confidential information to evaluate [PURPOSE].\n\n"
                "2. GOVERNING LAW\nThis Agreement is governed by the laws of India. The courts at [CITY] have "
                "exclusive jurisdiction."
            ),
            review_notes=notes,
            document_type=request.document_type,
            jurisdiction=jurisdiction,
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    try:
        document = await lex_services.draft_document(
            _llm, provider=_agent.default_provider, model=_agent.default_model, system=system,
            document_type=request.document_type, requirements=request.requirements,
            jurisdiction=jurisdiction, additional_clauses=request.additional_clauses,
        )
    except Exception as err:
        logger.error("draft failed | type=%s error=%s: %s", request.document_type, type(err).__name__, str(err)[:300])
        raise HTTPException(status_code=502, detail="Lex couldn't finish this draft. Try again.")
    return DraftDocumentResponse(
        document=document,
        review_notes=notes,
        document_type=request.document_type,
        jurisdiction=jurisdiction,
        model_used=_agent.default_model,
    )


class ExportDocumentRequest(BaseModel):
    document: str
    format: Literal["docx", "pdf"]
    document_type: str = "Legal Document"
    organization_id: str = ""
    include_letterhead: bool = False


class ExportDocumentResponse(BaseModel):
    file_b64: str
    mime_type: str
    filename: str


@router.post("/export-document", response_model=ExportDocumentResponse, summary="Export document as DOCX or PDF")
async def export_document(request: ExportDocumentRequest) -> ExportDocumentResponse:
    """Convert a drafted legal document to a formatted DOCX or PDF binary."""
    safe_name = re.sub(r"[^\w\s-]", "", request.document_type).strip().replace(" ", "_").lower() or "legal_document"

    letterhead_bytes: bytes | None = None
    if request.include_letterhead and request.organization_id:
        try:
            import httpx as _httpx
            from core.brand_kit import load_brand_kit
            brand_kit = await load_brand_kit(request.organization_id)
            if brand_kit.letterhead_url:
                async with _httpx.AsyncClient(timeout=10) as _client:
                    _r = await _client.get(brand_kit.letterhead_url)
                    if _r.status_code == 200:
                        letterhead_bytes = _r.content
        except Exception as _e:
            import logging as _logging
            _logging.getLogger("lex").warning("letterhead fetch failed: %s", _e)

    if request.format == "docx":
        binary = _generate_docx(request.document, request.document_type, letterhead_bytes)
        return ExportDocumentResponse(
            file_b64=base64.b64encode(binary).decode(),
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"lex_{safe_name}.docx",
        )
    else:
        binary = _generate_pdf(request.document, request.document_type, letterhead_bytes)
        return ExportDocumentResponse(
            file_b64=base64.b64encode(binary).decode(),
            mime_type="application/pdf",
            filename=f"lex_{safe_name}.pdf",
        )


# ── Stamp letterhead on existing document ─────────────────────────────────────

class StampLetterheadRequest(BaseModel):
    file_url: str
    filename: str
    format: Literal["docx", "pdf"]
    organization_id: str = ""


def _stamp_letterhead_docx(file_bytes: bytes, letterhead_bytes: bytes) -> bytes:
    from docx import Document as DocxDocument
    from docx.shared import Inches, Pt, Emu
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from PIL import Image as _PILImage

    # Calculate letterhead height in EMUs so top_margin can match it
    with _PILImage.open(io.BytesIO(letterhead_bytes)) as _pil:
        _iw, _ih = _pil.size

    doc = DocxDocument(io.BytesIO(file_bytes))
    for section in doc.sections:
        page_w_emu = section.page_width  # e.g., 12240000 EMU for 8.5"
        lh_h_emu = int(page_w_emu * (_ih / _iw))
        # top_margin = letterhead height + small gap so body text clears the header
        section.top_margin = lh_h_emu + Pt(14).pt * 12700  # letterhead + ~14pt gap

        header = section.header
        for para in header.paragraphs:
            for run in para.runs:
                run.text = ""
        hp = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        # Negative indents cancel page margins → image bleeds to paper edges
        hp.paragraph_format.left_indent = -section.left_margin
        hp.paragraph_format.right_indent = -section.right_margin
        hp.paragraph_format.space_before = Pt(0)
        hp.paragraph_format.space_after = Pt(0)
        hp.add_run().add_picture(io.BytesIO(letterhead_bytes), width=section.page_width)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _stamp_letterhead_pdf(file_bytes: bytes, letterhead_bytes: bytes) -> bytes:
    from PyPDF2 import PdfReader, PdfWriter
    from PyPDF2.generic import RectangleObject
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas as rl_canvas

    _sz = ImageReader(io.BytesIO(letterhead_bytes))
    iw, ih = _sz.getSize()
    page_w = LETTER[0]  # 612 pts — standard width used for letterhead sizing
    lh_h = page_w * (ih / iw)  # proportional letterhead height

    reader = PdfReader(io.BytesIO(file_bytes))
    writer = PdfWriter()

    for page in reader.pages:
        # Determine this page's actual dimensions
        mb = page.mediabox
        p_x0 = float(mb.left)
        p_y0 = float(mb.bottom)
        p_x1 = float(mb.right)
        p_y1 = float(mb.top)
        p_w = p_x1 - p_x0
        p_h = p_y1 - p_y0

        # Scale letterhead width to match this page's actual width
        lh_h_scaled = p_w * (ih / iw)

        # Extend the page upward by lh_h_scaled.
        # Original content stays exactly at its original coordinates —
        # no transformation, no scaling, text remains fully selectable.
        new_y1 = p_y1 + lh_h_scaled
        page.mediabox = RectangleObject([p_x0, p_y0, p_x1, new_y1])
        if hasattr(page, "cropbox"):
            page.cropbox = RectangleObject([p_x0, p_y0, p_x1, new_y1])

        # Build a letterhead overlay sized to the new extended page.
        # The letterhead occupies the NEW top section: y=p_y1 to y=new_y1.
        overlay_buf = io.BytesIO()
        c = rl_canvas.Canvas(overlay_buf, pagesize=(p_w, p_h + lh_h_scaled))
        img = ImageReader(io.BytesIO(letterhead_bytes))
        c.drawImage(img, 0, p_y1, width=p_w, height=lh_h_scaled,
                    preserveAspectRatio=True, mask="auto")
        c.save()
        overlay_buf.seek(0)

        overlay_page = PdfReader(overlay_buf).pages[0]
        page.merge_page(overlay_page)
        writer.add_page(page)

    out_buf = io.BytesIO()
    writer.write(out_buf)
    return out_buf.getvalue()


@router.post("/stamp-letterhead", response_model=ExportDocumentResponse, summary="Stamp letterhead on existing document")
async def stamp_letterhead(request: StampLetterheadRequest) -> ExportDocumentResponse:
    """Fetch the org's letterhead from brand kit and stamp it onto every page of the uploaded document."""
    if not request.organization_id:
        raise HTTPException(status_code=400, detail="organization_id is required")

    from core.brand_kit import load_brand_kit
    brand_kit = await load_brand_kit(request.organization_id)
    if not brand_kit.letterhead_url:
        raise HTTPException(status_code=400, detail="No letterhead uploaded in Brand Kit. Upload one in Brain → Assets.")

    try:
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=10) as _client:
            _r = await _client.get(brand_kit.letterhead_url)
        if _r.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not fetch letterhead image.")
        letterhead_bytes = _r.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Letterhead fetch failed: {e}") from e

    try:
        async with _httpx.AsyncClient(timeout=30) as _fclient:
            _fr = await _fclient.get(request.file_url)
        if _fr.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not fetch document from URL.")
        file_bytes = _fr.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Document fetch failed: {e}") from e

    safe_name = re.sub(r"[^\w\s-]", "", request.filename.rsplit(".", 1)[0]).strip().replace(" ", "_").lower() or "document"

    if request.format == "docx":
        binary = _stamp_letterhead_docx(file_bytes, letterhead_bytes)
        return ExportDocumentResponse(
            file_b64=base64.b64encode(binary).decode(),
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{safe_name}_with_letterhead.docx",
        )
    else:
        binary = _stamp_letterhead_pdf(file_bytes, letterhead_bytes)
        return ExportDocumentResponse(
            file_b64=base64.b64encode(binary).decode(),
            mime_type="application/pdf",
            filename=f"{safe_name}_with_letterhead.pdf",
        )


@router.post("/explain", response_model=ExplainResponse, summary="Explain legal text")
async def explain_legal_text(request: ExplainRequest) -> ExplainResponse:
    """Explain legal text in plain English with practical implications."""
    if settings.MOCK_MODE:
        return ExplainResponse(
            explanation=(
                "You must keep the other side's confidential information private and can only share it "
                "with their written permission, given before you share."
            ),
            key_terms={"Prior written consent": "Permission in writing, obtained before the disclosure."},
            related_concepts=["Carve-outs for public information"],
            practical_implications=[
                "Get written approval before briefing your investors on their details.",
                "Keep a record of what was shared and when.",
            ],
        )

    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    data = await lex_services.explain_text(
        _llm, provider=_agent.default_provider, model=_agent.default_model, system=system,
        text=request.text, context=request.context,
    )
    return ExplainResponse(**data, model_used=_agent.default_model)


@router.post("/legal-research", response_model=LegalResearchResponse, summary="Research legal questions")
async def legal_research(request: LegalResearchRequest) -> LegalResearchResponse:
    """Answer a legal question from current web sources, with the sources listed."""
    if settings.MOCK_MODE:
        return LegalResearchResponse(
            answer=(
                "An LLP converts to a private limited company by registering it under Section 366 of the "
                "Companies Act, 2013 through the SPICe+ form on the MCA portal [1]. Plan for 3-6 weeks."
            ),
            sections=[
                {"title": "Steps", "type": "ordered", "items": [
                    "Get consent from all partners and settle any creditor objections.",
                    "Reserve the company name through SPICe+ Part A.",
                    "File SPICe+ Part B with URC-1 and the conversion documents.",
                ]},
                {"title": "Documents needed", "type": "bullets", "items": [
                    "LLP agreement and partner consents", "Statement of assets and liabilities", "No-objection from creditors",
                ]},
            ],
            references=["Companies Act, 2013, Section 366", "Companies (Authorised to Register) Rules, 2014"],
            relevant_cases=[],
            jurisdiction_notes="Fees and form versions change — check the MCA portal before filing.",
            confidence_level="high",
            jurisdiction="India",
            sources=[LegalResearchSource(title="Conversion of LLP into company — MCA", url="https://www.mca.gov.in")],
        )

    location = await lex_services.org_location(request.organization_id)
    jurisdiction = lex_services.resolve_jurisdiction(request.jurisdiction, location)
    system = await _agent.build_system_prompt(request.user_id, request.organization_id)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    data = await lex_services.research(
        _llm, provider=_agent.default_provider, model=_agent.default_model, system=system,
        query=request.query, jurisdiction=jurisdiction, legal_areas=request.legal_areas,
    )
    return LegalResearchResponse(**data, model_used=_agent.default_model)


@router.post("/compliance-check", response_model=ComplianceCheckResponse, summary="Check regulatory compliance")
async def compliance_check(request: ComplianceCheckRequest) -> ComplianceCheckResponse:
    """Check a practice or document against the laws that apply — India-first unless told otherwise."""
    if settings.MOCK_MODE:
        return ComplianceCheckResponse(
            overall_status="partial",
            framework_results=[{
                "framework": "Digital Personal Data Protection Act, 2023", "status": "partial",
                "gaps": ["No notice telling users what personal data you collect and why"],
                "requirements": ["Give a clear notice before collecting personal data", "Let users withdraw consent as easily as they gave it"],
            }],
            critical_gaps=["Collecting phone numbers at checkout without a consent notice"],
            remediation_steps=[
                {"priority": "high", "action": "Add a consent notice to checkout explaining what you collect and why."},
                {"priority": "medium", "action": "Publish a grievance contact on the privacy policy page."},
            ],
            estimated_effort="1-2 weeks, mostly policy and checkout copy",
            jurisdiction="India",
        )

    location = await lex_services.org_location(request.organization_id)
    jurisdiction = lex_services.resolve_jurisdiction(request.jurisdiction, location)
    system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
    memory_context = request.metadata.get("memory_context", "")
    if memory_context:
        system += f"\n\n## Memory Context\n{memory_context}"
    data = await lex_services.compliance(
        _llm, provider=_agent.default_provider, model=_agent.default_model, system=system,
        description=request.description, frameworks=request.frameworks,
        business_context=request.business_context, jurisdiction=jurisdiction,
    )
    return ComplianceCheckResponse(**data, model_used=_agent.default_model)


@router.post("/draft-reply", response_model=DraftReplyResponse, summary="Draft a reply to the counterparty from a review")
async def draft_reply(request: DraftReplyRequest) -> DraftReplyResponse:
    """Turn a contract review into an email to the other side plus a schedule of proposed changes."""
    from fastapi import HTTPException

    if settings.MOCK_MODE:
        reply = {
            "subject": "Proposed changes to the Mutual NDA",
            "email": "Hi team,\n\nThanks for sending the NDA over. Before we sign, we'd like two changes:\n\n1. Section 7 — remove the residuals clause.\n2. Section 5 — reduce the term to three years.\n\nHappy to discuss on a quick call.\n\nBest,\n[YOUR NAME]",
            "changes": [
                {"section": "7", "current": "Nothing shall restrict use of information retained in unaided memory.", "proposed": "Delete Section 7.", "reason": "It lets remembered information be used freely."},
            ],
            "counterparty": "Acme Corp",
        }
    else:
        system = await _agent.build_system_prompt(request.user_id, request.organization_id, use_brand_kit=False)
        try:
            reply = await lex_services.draft_reply(
                _llm, provider=_agent.default_provider, model=_agent.default_model, system=system,
                analysis=request.analysis, sender=request.sender, tone=request.tone,
            )
        except ValueError as err:
            raise HTTPException(status_code=422, detail=str(err))
        except Exception as err:
            logger.error("draft reply failed | error=%s: %s", type(err).__name__, str(err)[:300])
            raise HTTPException(status_code=502, detail="Lex couldn't draft the reply. Try again.")

    return DraftReplyResponse(
        **reply,
        changes_document=lex_services.changes_document(reply, str(request.analysis.get("document_type") or "Contract")),
        model_used=_agent.default_model,
    )


class CompareVersionsRequest(BaseModel):
    previous_user_id: str
    previous_source_id: str
    current_user_id: str
    current_source_id: str
    perspective: str = ""
    preferences: list[dict] = Field(default_factory=list)


class VersionChange(BaseModel):
    topic: str
    section: str = ""
    before: str = ""
    after: str = ""
    severity: str = "medium"
    why_it_matters: str = ""
    suggested_response: str = ""


class CompareVersionsResponse(BaseModel):
    summary: str
    changes: list[VersionChange]
    failed: bool = False
    model_used: str = ""


@router.post("/compare-versions", response_model=CompareVersionsResponse, summary="Compare two versions of a contract")
async def compare_versions(request: CompareVersionsRequest) -> CompareVersionsResponse:
    """What changed between two uploaded versions of the same contract, and why it matters."""
    from fastapi import HTTPException

    if settings.MOCK_MODE:
        return CompareVersionsResponse(
            summary="The new version shifts risk to you: liability is now uncapped and the notice period is halved.",
            changes=[
                VersionChange(topic="Liability", section="8.2", before="Capped at fees paid in 12 months", after="Unlimited",
                              severity="critical", why_it_matters="Your exposure is no longer limited to the contract value.",
                              suggested_response="Restore the cap at fees paid in the previous 12 months."),
                VersionChange(topic="Termination notice", section="11.1", before="30 days", after="15 days",
                              severity="high", why_it_matters="Less time to replace the business if they exit.",
                              suggested_response="Keep 30 days' written notice."),
            ],
        )

    previous_text, current_text = await asyncio.gather(
        _rag.source_text(request.previous_user_id, request.previous_source_id),
        _rag.source_text(request.current_user_id, request.current_source_id),
    )
    if not previous_text or not current_text:
        raise HTTPException(status_code=404, detail="One of the versions could not be found")

    data = await lex_services.compare_versions(
        _llm, provider=_agent.default_provider, model=_agent.default_model,
        previous_text=previous_text, current_text=current_text,
        perspective=request.perspective, preferences=request.preferences,
    )
    return CompareVersionsResponse(**data, model_used=_agent.default_model)


@router.post("/delete-source", response_model=DeleteSourceResponse, summary="Delete an ingested document")
async def delete_source(request: DeleteSourceRequest) -> DeleteSourceResponse:
    """Remove all RAG chunks for a (user_id, source_id) pair."""
    deleted = await _rag.delete_source(request.user_id, request.source_id)
    return DeleteSourceResponse(deleted_chunks=deleted)


@router.post("/sources", response_model=ListSourcesResponse, summary="List ingested documents")
async def list_sources(request: ListSourcesRequest) -> ListSourcesResponse:
    """List all ingested documents for a user under the lex agent."""
    rows = await _rag.list_sources(request.user_id, source_agent="lex")
    return ListSourcesResponse(
        sources=[SourceSummary(**r) for r in rows],
    )

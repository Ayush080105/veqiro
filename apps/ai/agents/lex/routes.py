import json
import uuid
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
    document_url: str | None = None
    pdf_base64: str | None = None

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
    source_id: str

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


class AnalyzeContractResponse(BaseModel):
    analysis: ContractAnalysis
    disclaimer: str
    tokens_used: int = 0
    model_used: str = ""


class QueryDocumentRequest(BaseModel):
    user_id: str
    source_id: str
    query: str
    top_k: int = 5

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


class QueryDocumentResponse(BaseModel):
    answer: str
    sources: list[QueryDocumentChunk]
    tokens_used: int = 0
    model_used: str = ""


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
    tokens_used: int = 0
    model_used: str = ""


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
    tokens_used: int = 0
    model_used: str = ""


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
    tokens_used: int = 0
    model_used: str = ""


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

    # Extract text once — reused for both ingestion and metadata
    try:
        full_text = await extract_text_with_vision(pdf_bytes, _llm)
    except Exception:
        from core.pdf_reader import extract_text
        full_text = extract_text(pdf_bytes)

    page_count = len(extract_pages(pdf_bytes))
    source_id = f"doc_{str(uuid.uuid4())[:8]}"
    meta = {"document_name": request.document_name, "document_type": request.document_type}

    async def _extract_metadata():
        raw = await _llm.complete(
            provider=_agent.default_provider,
            model=_agent.default_model,
            system="You are a legal document analyst. Be precise and concise.",
            messages=[{"role": "user", "content": (
                f"Analyze this legal document and return ONLY a JSON object (no markdown fences) with exactly these keys:\n"
                f"- summary: 2-3 sentence overview of what the document is, who the parties are, and its main purpose\n"
                f"- key_topics: list of 4-8 specific legal topic strings (e.g. confidentiality, ip_assignment, termination, governing_law)\n"
                f"- document_type_detected: one of nda, mou, employment_agreement, service_agreement, partnership_agreement, "
                f"shareholder_agreement, lease_agreement, loan_agreement, settlement_agreement, other\n\n"
                f"Document:\n{full_text[:12000]}"
            )}],
            max_tokens=512,
        )
        return raw

    # Run ingestion and metadata extraction in parallel
    chunks_count, meta_raw = await asyncio.gather(
        _rag.ingest(request.user_id, full_text, "pdf", source_id, "lex", meta),
        _extract_metadata(),
    )

    tokens_used = _llm.count_tokens(meta_raw)
    try:
        meta_data = json.loads(strip_json_fences(meta_raw))
        summary = meta_data.get("summary", "")
        key_topics = meta_data.get("key_topics", [])
        document_type_detected = meta_data.get("document_type_detected", request.document_type)
    except Exception:
        summary = meta_raw[:300]
        key_topics = []
        document_type_detected = request.document_type

    return IngestDocumentResponse(
        source_id=source_id,
        chunks_created=chunks_count,
        page_count=page_count,
        summary=summary,
        key_topics=key_topics,
        document_type_detected=document_type_detected,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
    )


@router.post("/analyze-contract", response_model=AnalyzeContractResponse, summary="Analyze contract")
async def analyze_contract(request: AnalyzeContractRequest) -> AnalyzeContractResponse:
    """Fetch all chunks for source_id and perform a full structured contract analysis."""
    if settings.MOCK_MODE:
        return AnalyzeContractResponse(
            analysis=ContractAnalysis(
                document_type="Mutual Non-Disclosure Agreement",
                parties=["Acme Corp (Disclosing Party)", "Beta Inc (Receiving Party)"],
                effective_date="January 1, 2025",
                governing_law="Delaware General Corporation Law",
                jurisdiction="United States (Delaware)",
                executive_summary=(
                    "A mutual NDA between two technology companies for partnership evaluation. "
                    "The agreement is broadly written with several one-sided provisions favoring the disclosing party, "
                    "most notably a residuals clause that creates IP leakage risk."
                ),
                risk_level="medium",
                risk_score=6,
                risks=[
                    ClauseRisk(
                        clause="Definition of Confidential Information (Section 2)",
                        risk="Overly broad — includes all verbal communications with no follow-up written confirmation requirement, making scope unmanageable.",
                        severity="medium",
                        recommendation="Add a requirement that verbal disclosures be confirmed in writing within 10 business days to be considered Confidential Information.",
                    ),
                    ClauseRisk(
                        clause="Residuals Clause (Section 7)",
                        risk="Allows the receiving party to use residual knowledge retained in unaided memory — creates IP leakage risk for your product roadmap and technical architecture.",
                        severity="high",
                        recommendation="Remove entirely or limit to generic industry knowledge, explicitly excluding product roadmap, source code, and customer data.",
                    ),
                    ClauseRisk(
                        clause="Duration (Section 5)",
                        risk="5-year term is 2× the industry standard of 2–3 years for startup-stage NDAs.",
                        severity="low",
                        recommendation="Renegotiate to 2–3 years with a survival clause limited to 1 year post-termination for specific categories.",
                    ),
                    ClauseRisk(
                        clause="Unilateral Termination (Section 9)",
                        risk="Disclosing party can terminate with 30 days notice, but confidentiality obligations survive indefinitely — your obligations continue even after termination.",
                        severity="medium",
                        recommendation="Cap survival of obligations to 2 years post-termination and require mutual consent for early termination.",
                    ),
                ],
                unusual_clauses=[
                    "Residuals clause (Section 7) — rare in mutual NDAs, typically found only in one-sided agreements favoring large enterprises",
                    "No limitation on injunctive relief scope — allows either party to seek unlimited injunctive relief without bond",
                    "No carve-out for information independently developed — standard protection is missing",
                ],
                missing_protections=[
                    "Dispute resolution mechanism — arbitration vs. litigation not specified",
                    "Data protection / GDPR compliance obligations — no mention despite potential EU data exchange",
                    "Limitation of liability — no cap on damages beyond injunctive relief",
                    "Carve-out for information independently developed without reference to confidential information",
                    "Return or destruction of materials clause upon termination",
                ],
                clause_breakdown=[
                    {"section": "1", "title": "Purpose", "summary": "Defines the scope of the relationship as partnership evaluation.", "risk_level": "low", "notes": "Standard. No issues."},
                    {"section": "2", "title": "Definition of Confidential Information", "summary": "Broadly defines all information, including verbal disclosures, as confidential.", "risk_level": "medium", "notes": "Verbal inclusion without written confirmation requirement is problematic."},
                    {"section": "3", "title": "Obligations", "summary": "Standard confidentiality obligations — hold in confidence, restrict access, use only for Purpose.", "risk_level": "low", "notes": "Standard. No issues."},
                    {"section": "5", "title": "Term", "summary": "5-year confidentiality period from Effective Date.", "risk_level": "low", "notes": "Above industry standard. Negotiate down."},
                    {"section": "7", "title": "Residuals", "summary": "Permits use of retained knowledge in unaided memory for any purpose.", "risk_level": "high", "notes": "Significant IP risk. Should be removed or heavily restricted."},
                    {"section": "9", "title": "Termination", "summary": "Either party may terminate with 30 days written notice. Obligations survive.", "risk_level": "medium", "notes": "Indefinite survival of obligations post-termination is unusual."},
                ],
                key_terms={
                    "duration": "5 years",
                    "governing_law": "Delaware, United States",
                    "scope": "Product roadmap, customer data, financial projections, technical architecture",
                    "permitted_disclosures": "Legal counsel and advisors who are themselves bound by NDA",
                    "dispute_resolution": "Not specified",
                    "termination_notice": "30 days written notice",
                    "survival": "Indefinite post-termination",
                },
                obligations={
                    "Acme Corp": [
                        "Hold Beta's Confidential Information in strict confidence",
                        "Limit access to employees with need-to-know",
                        "Use information solely for the Purpose",
                        "Notify Beta immediately of any unauthorized disclosure",
                    ],
                    "Beta Inc": [
                        "Hold Acme's Confidential Information in strict confidence",
                        "Limit access to employees with need-to-know",
                        "Use information solely for the Purpose",
                        "Notify Acme immediately of any unauthorized disclosure",
                    ],
                },
                negotiation_points=[
                    NegotiationPoint(
                        priority="high",
                        clause="Residuals Clause (Section 7)",
                        issue="Permits unrestricted use of retained knowledge — directly undermines the NDA's purpose.",
                        suggested_change="Delete Section 7 entirely, or restrict to generic industry knowledge explicitly excluding product IP, source code, and customer data.",
                    ),
                    NegotiationPoint(
                        priority="medium",
                        clause="Definition of Confidential Information (Section 2)",
                        issue="Verbal communications without written confirmation create enforcement ambiguity.",
                        suggested_change="Add: 'Verbal disclosures must be confirmed in writing within 10 business days to constitute Confidential Information.'",
                    ),
                    NegotiationPoint(
                        priority="medium",
                        clause="Termination / Survival (Section 9)",
                        issue="Indefinite survival of obligations is commercially unusual and burdensome.",
                        suggested_change="Cap survival at 3 years post-termination for general confidentiality; allow indefinite survival only for trade secrets.",
                    ),
                    NegotiationPoint(
                        priority="low",
                        clause="Duration (Section 5)",
                        issue="5-year term exceeds market standard.",
                        suggested_change="Reduce to 2–3 years.",
                    ),
                ],
                overall_assessment=(
                    "This NDA is weighted toward the disclosing party and contains one high-risk clause (residuals) "
                    "that should be a hard blocker. The agreement is otherwise workable with targeted modifications. "
                    "Do not sign as-is."
                ),
                recommended_action="negotiate",
            ),
            disclaimer=LEGAL_DISCLAIMER,
        )

    chunks = await _rag.retrieve_by_source(request.user_id, request.source_id)
    if not chunks:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No document found for source_id '{request.source_id}'")

    full_text = "\n\n".join(c.get("content", "") for c in chunks)

    system = await _agent.build_system_prompt(request.user_id)
    raw = await _llm.complete(
        provider=_agent.default_provider,
        model=_agent.default_model,
        system=system,
        messages=[{"role": "user", "content": (
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
        )}],
        max_tokens=4096,
    )
    tokens_used = _llm.count_tokens(raw)
    try:
        data = json.loads(strip_json_fences(raw))
        risks = [ClauseRisk(**r) for r in data.pop("risks", [])]
        negotiation_points = [NegotiationPoint(**n) for n in data.pop("negotiation_points", [])]
        analysis = ContractAnalysis(**data, risks=risks, negotiation_points=negotiation_points)
    except Exception:
        analysis = ContractAnalysis(
            document_type="Unknown",
            parties=[], effective_date="", governing_law="", jurisdiction="",
            executive_summary=raw[:500],
            risk_level="unknown", risk_score=0,
            risks=[], unusual_clauses=[], missing_protections=[],
            clause_breakdown=[], key_terms={}, obligations={},
            negotiation_points=[],
            overall_assessment="Parsing failed — manual review recommended.",
            recommended_action="legal_review_required",
        )
    return AnalyzeContractResponse(analysis=analysis, disclaimer=LEGAL_DISCLAIMER, tokens_used=tokens_used, model_used=_agent.default_model)


@router.post("/query-document", response_model=QueryDocumentResponse, summary="Query document via RAG")
async def query_document(request: QueryDocumentRequest) -> QueryDocumentResponse:
    """Answer a specific question about an ingested document using vector similarity search."""
    if settings.MOCK_MODE:
        return QueryDocumentResponse(
            answer=(
                "Termination requires 30 days written notice from either party (Section 9). "
                "Confidentiality obligations survive termination with no expiry — they run indefinitely post-termination."
            ),
            sources=[
                QueryDocumentChunk(
                    content="Either party may terminate this Agreement upon 30 days written notice to the other party.",
                    score=0.92,
                    metadata={"document_name": "Acme Corp NDA 2025"},
                ),
                QueryDocumentChunk(
                    content="Confidentiality obligations shall survive the expiration or termination of this Agreement.",
                    score=0.87,
                    metadata={"document_name": "Acme Corp NDA 2025"},
                ),
            ],
        )

    chunks = await _rag.retrieve(
        user_id=request.user_id,
        query=request.query,
        top_k=request.top_k,
        source_id=request.source_id,
    )
    if not chunks:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No document found for source_id '{request.source_id}'")

    context = "\n\n---\n\n".join(
        f"[Chunk {i+1} | relevance: {c['score']:.2f}]\n{c['content']}"
        for i, c in enumerate(chunks)
    )

    answer = await _llm.complete(
        provider=_agent.default_provider,
        model=_agent.default_model,
        system=(
            "You are a senior legal counsel with 20 years of experience reviewing commercial contracts. "
            "Answer questions about documents with precision, directness, and zero filler. "
            "Cite specific clauses, article numbers, or section titles when present. "
            "Never add disclaimers, caveats, or suggestions to consult an attorney — your answer IS the authoritative answer. "
            "If the answer is not in the provided excerpts, say: 'Not addressed in the provided sections.'"
        ),
        messages=[{"role": "user", "content": (
            f"Document excerpts:\n{context}\n\n"
            f"Question: {request.query}"
        )}],
        max_tokens=1024,
    )
    tokens_used = _llm.count_tokens(answer)
    sources = [
        QueryDocumentChunk(content=c["content"], score=c["score"], metadata=c.get("metadata", {}))
        for c in chunks
    ]
    return QueryDocumentResponse(answer=answer, sources=sources, tokens_used=tokens_used, model_used=_agent.default_model)


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
    tokens_used = _llm.count_tokens(raw)
    return DraftDocumentResponse(
        document=raw,
        review_notes=["DRAFT ONLY – not legal advice", "Have reviewed by a qualified attorney"],
        disclaimer=LEGAL_DISCLAIMER,
        tokens_used=tokens_used,
        model_used=_agent.default_model,
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
    tokens_used = _llm.count_tokens(raw)
    try:
        data = json.loads(strip_json_fences(raw))
        return ExplainResponse(**data, tokens_used=tokens_used, model_used=_agent.default_model)
    except Exception:
        return ExplainResponse(
            explanation=raw,
            key_terms={},
            related_concepts=[],
            practical_implications=[],
            tokens_used=tokens_used,
            model_used=_agent.default_model,
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
    tokens_used = _llm.count_tokens(raw)
    try:
        data = json.loads(strip_json_fences(raw))
        return LegalResearchResponse(**data, disclaimer=LEGAL_DISCLAIMER, tokens_used=tokens_used, model_used=_agent.default_model)
    except Exception:
        return LegalResearchResponse(
            summary=raw[:500],
            applicable_laws=[], key_requirements=[], relevant_cases=[],
            practical_guidance=[], jurisdiction_notes=request.jurisdiction,
            confidence_level="medium — consult an attorney for verified research",
            disclaimer=LEGAL_DISCLAIMER,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
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
    tokens_used = _llm.count_tokens(raw)
    try:
        data = json.loads(strip_json_fences(raw))
        return ComplianceCheckResponse(**data, disclaimer=LEGAL_DISCLAIMER, tokens_used=tokens_used, model_used=_agent.default_model)
    except Exception:
        return ComplianceCheckResponse(
            overall_status="unknown",
            framework_results=[], critical_gaps=[],
            remediation_steps=[],
            estimated_effort="Manual review required",
            disclaimer=LEGAL_DISCLAIMER,
            tokens_used=tokens_used,
            model_used=_agent.default_model,
        )


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

"""Covers Lex's shared services: India-first jurisdiction, grounded research, compliance,
document Q&A with citations, drafts without markdown, and the reply-to-counterparty flow."""

import asyncio

import pytest

from agents.lex import routes
from agents.lex import services as svc
from core.config import settings
from core.rag import join_chunks


class _LLM:
    def __init__(self, json_result=None, text_results=None):
        self.json_result = json_result
        self.text_results = list(text_results or [])
        self.json_calls = []
        self.text_calls = []

    async def complete_json(self, **kwargs):
        self.json_calls.append(kwargs)
        if isinstance(self.json_result, Exception):
            raise self.json_result
        return self.json_result

    async def complete(self, **kwargs):
        self.text_calls.append(kwargs)
        return self.text_results.pop(0)


def _prompt(call) -> str:
    return call["messages"][0]["content"]


# ── jurisdiction ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("requested,location,expected", [
    ("", "", "India"),
    ("United States (Delaware)", "", "India"),
    ("United States", "Bengaluru, Karnataka", "Bengaluru, Karnataka"),
    ("", "Pune", "Pune"),
    ("United Kingdom", "Pune", "United Kingdom"),
])
def test_jurisdiction_prefers_explicit_choice_then_org_location_then_india(requested, location, expected):
    assert svc.resolve_jurisdiction(requested, location) == expected


# ── drafts ───────────────────────────────────────────────────────────────────

def test_strip_markdown_removes_bold_headings_and_fences():
    text = "## MUTUAL NDA\n**[PARTY A]** and __[PARTY B]__\n```\nUse `code`\n```"
    assert svc.strip_markdown(text) == "MUTUAL NDA\n[PARTY A] and [PARTY B]\n\nUse code"


def test_draft_retries_an_empty_reasoning_response_and_strips_markdown():
    llm = _LLM(text_results=["", "**MUTUAL NDA**\n1. PURPOSE"])
    doc = asyncio.run(svc.draft_document(
        llm, provider="p", model="m", system="s", document_type="Mutual NDA",
        requirements="brand and manufacturer", jurisdiction="India"))
    assert doc == "MUTUAL NDA\n1. PURPOSE"
    assert llm.text_calls[1]["max_tokens"] > llm.text_calls[0]["max_tokens"]
    assert "Indian Contract Act" in _prompt(llm.text_calls[0])


def test_draft_that_stays_empty_raises():
    llm = _LLM(text_results=["", "   "])
    with pytest.raises(ValueError):
        asyncio.run(svc.draft_document(llm, provider="p", model="m", system="s", document_type="NDA",
                                       requirements="x", jurisdiction="India"))


# ── research ─────────────────────────────────────────────────────────────────

def _research(monkeypatch, llm, results):
    async def fake_search(query, search_type="search"):
        return results

    import agents.scout.scraper as scraper
    monkeypatch.setattr(scraper, "serper_search", fake_search)
    return asyncio.run(svc.research(llm, provider="p", model="m", system="s",
                                    query="convert LLP to Pvt Ltd", jurisdiction="India"))


def test_research_is_grounded_in_sources_and_matches_the_card_shape(monkeypatch):
    llm = _LLM(json_result={
        "answer": "File SPICe+ under Section 366 [1].",
        "sections": [{"title": "Steps", "type": "ordered", "items": ["Reserve name", ""]}, {"title": "Empty", "items": []}],
        "references": ["Companies Act, 2013, s.366"],
        "relevant_cases": [],
        "jurisdiction_notes": "Check MCA fees.",
        "confidence_level": "High — sources are official",
    })
    result = _research(monkeypatch, llm, [
        {"title": "MCA", "link": "https://mca.gov.in/a", "snippet": "SPICe+ conversion"},
        {"title": "dup", "link": "https://mca.gov.in/a", "snippet": "same link"},
        {"title": "no snippet", "link": "https://x", "snippet": ""},
    ])
    assert result["answer"].startswith("File SPICe+")
    assert result["sections"] == [{"title": "Steps", "type": "ordered", "items": ["Reserve name"]}]
    assert result["confidence_level"] == "high"
    assert result["sources"] == [{"title": "MCA", "url": "https://mca.gov.in/a"}]
    assert "[1] MCA" in _prompt(llm.json_calls[0])
    routes.LegalResearchResponse(**result)


def test_research_without_sources_is_low_confidence(monkeypatch):
    llm = _LLM(json_result={"answer": "General answer.", "confidence_level": "high"})
    result = _research(monkeypatch, llm, [])
    assert result["confidence_level"] == "low"
    assert result["sources"] == []


def test_research_failure_says_so_instead_of_an_empty_card(monkeypatch):
    llm = _LLM(json_result=RuntimeError("provider down"))
    result = _research(monkeypatch, llm, [])
    assert result["failed"] is True
    assert "couldn't complete" in result["answer"]


# ── compliance ───────────────────────────────────────────────────────────────

def test_compliance_without_frameworks_picks_india_laws():
    llm = _LLM(json_result={
        "overall_status": "Non-Compliant",
        "framework_results": [{"framework": "DPDP Act, 2023", "status": "partial", "gaps": ["No notice"], "requirements": []}, "junk"],
        "critical_gaps": ["No consent notice"],
        "remediation_steps": [{"priority": "urgent", "action": "Add notice"}, {"action": ""}],
        "estimated_effort": "1 week",
    })
    result = asyncio.run(svc.compliance(llm, provider="p", model="m", system="s", description="checkout collects phones",
                                        frameworks=[], business_context="D2C brand", jurisdiction="India"))
    assert "Digital Personal Data Protection Act" in _prompt(llm.json_calls[0])
    assert result["overall_status"] == "non_compliant"
    assert result["remediation_steps"] == [{"priority": "medium", "action": "Add notice"}]
    routes.ComplianceCheckResponse(**result)


# ── ask a document ───────────────────────────────────────────────────────────

def test_document_answer_returns_quoted_citations():
    llm = _LLM(json_result={"found": True, "answer": "The Deputy Director appoints the arbitrator.",
                            "citations": [{"section": "7.14.1", "quote": "\"appointed by the Deputy Director\""}, {"quote": ""}]})
    result = asyncio.run(svc.answer_from_document(llm, provider="p", model="m", question="who appoints",
                                                  chunks=[{"content": "7.14.1 ... appointed by the Deputy Director"}]))
    assert result["found"] is True
    assert result["citations"] == [{"section": "7.14.1", "quote": "appointed by the Deputy Director"}]


def test_query_route_passes_no_floor_and_returns_citations(monkeypatch):
    monkeypatch.setattr(settings, "MOCK_MODE", False)
    seen = {}

    async def fake_retrieve(**kwargs):
        seen.update(kwargs)
        return [{"content": "7.14.1 Sole Arbitrator appointed by the Deputy Director", "score": 0.62, "metadata": {}}]

    async def fake_answer(llm, **kwargs):
        seen["question"] = kwargs["question"]
        return {"answer": "The Deputy Director.", "found": True, "citations": [{"section": "7.14.1", "quote": "appointed by the Deputy Director"}]}

    monkeypatch.setattr(routes._rag, "retrieve", fake_retrieve)
    monkeypatch.setattr(svc, "answer_from_document", fake_answer)
    result = asyncio.run(routes.query_document(routes.QueryDocumentRequest(user_id="u", source_id="doc-1", query="who appoints")))
    assert seen["min_score"] == 0.0 and seen["source_id"] == "doc-1"
    assert result.citations[0].section == "7.14.1"


# ── reply to counterparty ────────────────────────────────────────────────────

_ANALYSIS = {
    "document_type": "Mess services agreement", "perspective": "Service Provider", "counterparty": "IIT Kanpur",
    "issues": [
        {"severity": "critical", "title": "They choose the arbitrator", "section": "7.14.1",
         "quote": "appointed by the Deputy Director", "what_it_means": "They pick the judge.", "send_back": "Mutually agreed arbitrator."},
        {"severity": "low", "title": "No change wanted", "section": "2", "send_back": ""},
    ],
}


def test_reply_email_and_change_schedule():
    llm = _LLM(json_result={
        "subject": "Proposed changes", "email": "Hi,\n\n**1.** Clause 7.14.1 — mutual arbitrator.",
        "changes": [{"section": "7.14.1", "current": "appointed by the Deputy Director", "proposed": "Mutually agreed arbitrator.", "reason": "Neutral forum."}],
    })
    reply = asyncio.run(svc.draft_reply(llm, provider="p", model="m", system="s", analysis=_ANALYSIS, sender="Asha"))
    assert "**" not in reply["email"]
    assert reply["counterparty"] == "IIT Kanpur"
    prompt = _prompt(llm.json_calls[0])
    assert "They choose the arbitrator" in prompt and "No change wanted" not in prompt
    doc = svc.changes_document(reply, "Mess services agreement")
    assert doc.startswith("PROPOSED CHANGES — MESS SERVICES AGREEMENT")
    assert "Proposed wording: Mutually agreed arbitrator." in doc


def test_reply_needs_proposed_changes():
    with pytest.raises(ValueError):
        asyncio.run(svc.draft_reply(_LLM(json_result={}), provider="p", model="m", system="s",
                                    analysis={"issues": [{"title": "x", "send_back": ""}]}, sender=""))


def test_mock_routes_return_the_new_shapes():
    review = asyncio.run(routes.analyze_contract(routes.AnalyzeContractRequest(user_id="u", source_id="d")))
    assert review.analysis.version == 2 and review.analysis.issues
    research = asyncio.run(routes.legal_research(routes.LegalResearchRequest(user_id="u", query="q")))
    assert research.answer and research.sections and research.sources
    reply = asyncio.run(routes.draft_reply(routes.DraftReplyRequest(user_id="u", analysis=review.analysis.model_dump())))
    assert reply.changes_document.startswith("PROPOSED CHANGES")


# ── chunk reassembly ─────────────────────────────────────────────────────────

def test_join_chunks_drops_overlap_and_keeps_legacy_documents():
    from core.rag import _chunk_text
    text = " ".join(f"w{i}" for i in range(700))
    chunks = _chunk_text(text, 200, 30)
    rows = [{"content": c, "metadata": {"chunk_index": i, "overlap_words": 30}} for i, c in enumerate(chunks)]
    assert join_chunks(rows).split() == text.split()
    legacy = [{"content": "a b"}, {"content": "c d"}]
    assert join_chunks(legacy) == "a b\n\nc d"

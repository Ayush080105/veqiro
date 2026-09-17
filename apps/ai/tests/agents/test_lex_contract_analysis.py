"""Covers Lex contract analysis: the failure that showed "Unknown · score 0/10 · Parsing
failed" on a long contract, and the item-level repair that keeps one bad entry from failing the
whole analysis.
"""

import asyncio

import pytest

from agents.lex import contract_analysis as ca
from agents.lex.routes import ContractAnalysis


def _good() -> dict:
    return {
        "document_type": "Mess Services Agreement",
        "parties": ["IIT Kanpur (Institute)", "Service Provider"],
        "effective_date": "October 1, 2012",
        "governing_law": "Laws of India",
        "jurisdiction": "Courts at Kanpur",
        "executive_summary": "A one-sided services contract.",
        "risk_level": "high",
        "risk_score": "8",
        "score_breakdown": {"critical": 9, "high": 9},
        "risks": [
            {"clause": "6.2 Termination", "risk": "Termination for any reason on 30 days.",
             "severity": "HIGH", "recommendation": "Add mutual termination.", "confidence": "high",
             "basis": "Indian Contract Act s.73"},
            {"clause": "3.5", "risk": "Cost cap borne by provider.", "severity": "extreme",
             "recommendation": "Add escalation."},
            "not a dict",
            {"clause": "missing risk text"},
        ],
        "clause_breakdown": [{"section": "7.14", "title": "Arbitration", "summary": "Sole arbitrator.",
                              "risk_level": "high", "notes": None}, 42],
        "key_terms": {"HEC": "Hostel Executive Committee", "Empanelment": ["2 years", "extendable"], "": "x"},
        "obligations_structured": [
            {"party": "Service Provider", "items": [
                {"action": "Deposit Rs 5 lakh security", "deadline": None},
                "Pay minimum wages",
                {"deadline": "no action"},
            ]},
            {"party": "", "items": [{"action": "orphan"}]},
        ],
        "ambiguous_clauses": [{"clause": "to the satisfaction of the Institute", "section": 3}],
        "negotiation_points": [{"priority": "urgent", "clause": "6.2", "issue": "One-sided",
                                "suggested_change": "Mutual 60-day notice"}],
        "overall_assessment": "Negotiate before signing.",
        "recommended_action": "Negotiate",
    }


def test_normalized_output_always_satisfies_the_response_model():
    data = ca.normalize_analysis(_good())
    analysis = ContractAnalysis(**data)
    assert analysis.risk_score == 8
    assert analysis.recommended_action == "negotiate"


def test_bad_items_are_dropped_not_the_whole_analysis():
    data = ca.normalize_analysis(_good())
    assert [r["clause"] for r in data["risks"]] == ["6.2 Termination", "3.5"]
    assert data["risks"][0]["severity"] == "high"
    assert data["risks"][1]["severity"] == "medium"  # unknown severity repaired
    assert len(data["clause_breakdown"]) == 1
    assert data["negotiation_points"][0]["priority"] == "medium"
    assert data["key_terms"] == {"HEC": "Hostel Executive Committee", "Empanelment": "2 years; extendable"}


def test_score_breakdown_is_counted_from_kept_risks():
    data = ca.normalize_analysis(_good())
    assert data["score_breakdown"] == {"critical": 0, "high": 1, "medium": 1, "low": 0}


def test_plain_obligations_are_derived_from_structured():
    data = ca.normalize_analysis(_good())
    assert data["obligations_structured"] == [{"party": "Service Provider", "items": [
        {"action": "Deposit Rs 5 lakh security", "deadline": None, "condition": None, "consequence": None},
        {"action": "Pay minimum wages", "deadline": None, "condition": None, "consequence": None},
    ]}]
    assert data["obligations"] == {"Service Provider": ["Deposit Rs 5 lakh security", "Pay minimum wages"]}


def test_lists_are_capped():
    raw = _good()
    raw["risks"] = [{"clause": f"c{i}", "risk": "r", "severity": "low", "recommendation": "x"} for i in range(40)]
    raw["clause_breakdown"] = [{"section": str(i), "title": "t", "summary": "s"} for i in range(60)]
    data = ca.normalize_analysis(raw)
    assert len(data["risks"]) == ca.MAX_RISKS
    assert len(data["clause_breakdown"]) == ca.MAX_CLAUSE_SECTIONS


def test_non_object_output_is_rejected():
    with pytest.raises(ValueError):
        ca.normalize_analysis(["not", "an", "object"])


def test_prompt_bounds_the_output_and_no_longer_asks_for_obligations_twice():
    prompt = ca.build_analysis_prompt("CONTRACT TEXT")
    assert f"at most {ca.MAX_CLAUSE_SECTIONS}" in prompt
    assert "obligations_structured" in prompt
    assert "\nobligations (" not in prompt
    assert "analyze EVERY numbered section" not in prompt


class _LLM:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def complete_json(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _run(llm):
    return asyncio.run(ca.analyze_contract_text(
        llm, provider="openai", model="m", system="sys", full_text="text"))


def test_analysis_uses_json_mode_helper_with_a_roomy_budget():
    llm = _LLM(_good())
    data = _run(llm)
    assert llm.calls[0]["max_tokens"] == ca.ANALYSIS_MAX_TOKENS >= 16000
    assert data["document_type"] == "Mess Services Agreement"


def test_empty_model_response_returns_an_explicit_failure_card_and_logs(caplog):
    from core.llm import LLMError
    llm = _LLM(LLMError("complete_json got an empty response from m even at max_tokens=48000"))
    with caplog.at_level("ERROR", logger="lex.contract_analysis"):
        data = _run(llm)
    ContractAnalysis(**data)
    assert data["document_type"] == "Analysis unavailable"
    assert "uploaded correctly" in data["executive_summary"]
    assert "empty response" in caplog.text

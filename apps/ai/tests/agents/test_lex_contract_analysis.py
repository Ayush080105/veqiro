"""Covers the verdict-first contract review (v2).

v1 returned six overlapping lists that restated the same problems and failed outright on long
contracts. v2 returns a verdict, key facts, one de-duplicated issue list with quotes and
send-back wording, and key dates — normalised item by item, with the v1 fields derived so
older clients and saved messages still render.
"""

import asyncio

import pytest

from agents.lex import contract_analysis as ca
from agents.lex.routes import ContractAnalysis


def _raw() -> dict:
    return {
        "document_type": "Mess services agreement",
        "parties": ["IIT Kanpur (Institute)", "Service Provider"],
        "perspective": "Service Provider",
        "counterparty": "IIT Kanpur",
        "verdict": {"action": "Negotiate", "headline": "Don't sign as-is",
                    "summary": "The Institute can fine you and keep your deposit on its own say."},
        "favours": {"party": "IIT Kanpur", "lean": "140"},
        "risk_level": "critical",
        "risk_score": "9",
        "key_facts": [{"label": "Deposit", "value": "₹5,00,000"}, {"label": "Term"}, "junk"],
        "issues": [
            {"severity": "medium", "kind": "ambiguous", "title": "Satisfaction of the Institute",
             "section": "3", "quote": "\"to the satisfaction of the Institute\"",
             "what_it_means": "Performance is judged subjectively.", "send_back": "Define objective service levels."},
            {"severity": "critical", "kind": "risk", "title": "They choose the arbitrator", "section": "7.14.1",
             "quote": "appointed by the Deputy Director", "what_it_means": "The other side picks the judge.",
             "send_back": "A mutually agreed sole arbitrator."},
            {"severity": "extreme", "kind": "weird", "title": "Deposit forfeiture", "section": "6.1",
             "quote": "", "what_it_means": "Any lapse forfeits the deposit.", "send_back": ""},
            {"severity": "high", "kind": "missing", "title": "No penalty cap", "section": "",
             "quote": "", "what_it_means": "Fines are unlimited.", "send_back": "Cap penalties at 5% of monthly fees."},
            {"title": "no meaning"},
            "junk",
        ],
        "key_dates": [
            {"when": "Within 10 days of signing", "what": "Start work", "section": "4.11",
             "recurrence": "once", "days_from_start": "10"},
            {"when": "Every month", "what": "Submit bills", "section": "5.4", "recurrence": "Monthly", "days_from_start": None},
            {"when": "Every 6 months", "what": "Medical certificates", "recurrence": "half-yearly", "days_from_start": -3},
            {"what": "missing when"},
        ],
        "clauses": [{"section": "7.14", "title": "Arbitration", "summary": "Sole arbitrator.", "risk_level": "HIGH"}, 7],
        "key_terms": {"HEC": "Hostel Executive Committee", "": "x"},
        "effective_date": None,
        "governing_law": "Laws of India",
        "jurisdiction": "Courts at Kanpur",
    }


def test_normalized_review_satisfies_the_response_model():
    data = ca.normalize_analysis(_raw())
    analysis = ContractAnalysis(**data)
    assert analysis.version == 2
    assert analysis.verdict["action"] == "negotiate"
    assert analysis.verdict["headline"] == "Don't sign as-is"
    assert analysis.favours == {"party": "IIT Kanpur", "lean": 100}
    assert analysis.risk_score == 9
    assert analysis.effective_date == "Not specified"


def test_issues_are_repaired_sorted_and_malformed_ones_dropped():
    issues = ca.normalize_analysis(_raw())["issues"]
    assert [i["title"] for i in issues] == [
        "They choose the arbitrator", "No penalty cap", "Satisfaction of the Institute", "Deposit forfeiture",
    ]
    forfeiture = issues[-1]
    assert forfeiture["severity"] == "medium" and forfeiture["kind"] == "risk"
    assert issues[2]["quote"] == "to the satisfaction of the Institute"


def test_key_facts_and_dates_are_cleaned():
    data = ca.normalize_analysis(_raw())
    assert data["key_facts"] == [{"label": "Deposit", "value": "₹5,00,000"}]
    dates = data["key_dates"]
    assert len(dates) == 3
    assert dates[0]["days_from_start"] == 10
    assert dates[1]["recurrence"] == "monthly"
    assert dates[2]["recurrence"] == "half_yearly" and dates[2]["days_from_start"] is None


def test_legacy_fields_are_derived_from_issues():
    data = ca.normalize_analysis(_raw())
    assert data["recommended_action"] == "negotiate"
    assert data["executive_summary"] == data["verdict"]["summary"]
    assert data["score_breakdown"] == {"critical": 1, "high": 1, "medium": 2, "low": 0}
    assert [r["clause"] for r in data["risks"]][0] == "§7.14.1 They choose the arbitrator"
    assert all(r["clause"] != "No penalty cap" for r in data["risks"])
    assert data["missing_protections"] == ["No penalty cap — Fines are unlimited."]
    assert data["ambiguous_clauses"][0]["clause"] == "to the satisfaction of the Institute"
    assert data["clause_breakdown"][0]["risk_level"] == "high"


def test_missing_verdict_is_inferred_from_the_worst_issue():
    raw = _raw()
    raw["verdict"] = None
    data = ca.normalize_analysis(raw)
    assert data["verdict"]["action"] == "negotiate"
    assert data["verdict"]["headline"] == "Review before signing"


def test_lists_are_capped():
    raw = _raw()
    raw["issues"] = [{"title": f"t{i}", "what_it_means": "m", "severity": "low"} for i in range(40)]
    raw["clauses"] = [{"section": str(i), "title": "t", "summary": "s"} for i in range(60)]
    data = ca.normalize_analysis(raw)
    assert len(data["issues"]) == ca.MAX_ISSUES
    assert len(data["clauses"]) == ca.MAX_CLAUSES


def test_non_object_output_is_rejected():
    with pytest.raises(ValueError):
        ca.normalize_analysis(["not", "an", "object"])


def test_prompt_uses_perspective_focus_and_company():
    prompt = ca.build_analysis_prompt("TEXT", perspective="the service provider", focus=["penalties"])
    assert "Review it for: the service provider" in prompt
    assert "penalties" in prompt
    inferred = ca.build_analysis_prompt("TEXT", company_name="Klyvora Clothing")
    assert "'Klyvora Clothing'" in inferred
    assert "issues:" in prompt and "send_back" in prompt and "key_dates" in prompt


class _LLM:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def complete_json(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _run(llm, **kw):
    return asyncio.run(ca.analyze_contract_text(llm, provider="openai", model="m", system="sys", full_text="text", **kw))


def test_review_uses_json_mode_helper_with_a_roomy_budget():
    llm = _LLM(_raw())
    data = _run(llm, perspective="Service Provider")
    assert llm.calls[0]["max_tokens"] == ca.ANALYSIS_MAX_TOKENS >= 16000
    assert "Review it for: Service Provider" in llm.calls[0]["messages"][0]["content"]
    assert data["document_type"] == "Mess services agreement"


def test_failed_review_returns_an_explicit_card_and_logs(caplog):
    from core.llm import LLMError
    llm = _LLM(LLMError("complete_json got an empty response from m even at max_tokens=48000"))
    with caplog.at_level("ERROR", logger="lex.contract_analysis"):
        data = _run(llm)
    ContractAnalysis(**data)
    assert data["failed"] is True
    assert data["verdict"]["headline"] == "Review didn't finish"
    assert "uploaded correctly" in data["executive_summary"]
    assert "empty response" in caplog.text


def test_verdict_never_claims_a_contract_is_safe():
    raw = _raw()
    raw["issues"] = [{"title": "Minor typo", "what_it_means": "Cosmetic.", "severity": "low"}]
    raw["verdict"] = {"action": "sign", "headline": "Safe to sign", "summary": "Fine."}
    data = ca.normalize_analysis(raw)
    assert data["verdict"]["headline"] == "No critical issues found"


def test_sign_is_downgraded_when_high_findings_exist():
    raw = _raw()
    raw["verdict"] = {"action": "sign", "headline": "Looks fine", "summary": "x"}
    assert ca.normalize_analysis(raw)["verdict"]["action"] == "negotiate"


def test_preference_mismatch_and_contract_metadata():
    raw = _raw()
    raw["issues"].append({"severity": "high", "kind": "preference_mismatch", "title": "Net 15 payment",
                          "what_it_means": "Shorter than you accept.", "preference": "Net 30"})
    raw["contract"] = {"effective_date": "2026-10-01", "expiry_date": "30 Sep 2027", "auto_renewal": True,
                       "value": "₹5,00,000 deposit", "payment_terms": "Monthly"}
    raw["key_dates"][0]["owner"] = "Counterparty"
    raw["key_dates"][0]["date"] = "2026-10-11"
    with_prefs = ca.normalize_analysis(raw, preferences_given=True)
    mismatch = next(i for i in with_prefs["issues"] if i["title"] == "Net 15 payment")
    assert mismatch["category"] == "company_preference_mismatch" and mismatch["preference"] == "Net 30"
    assert with_prefs["contract"]["effective_date"] == "2026-10-01"
    assert with_prefs["contract"]["expiry_date"] is None
    assert with_prefs["contract"]["auto_renewal"] is True
    assert with_prefs["key_dates"][0]["owner"] == "counterparty" and with_prefs["key_dates"][0]["date"] == "2026-10-11"
    without = ca.normalize_analysis(raw)
    assert next(i for i in without["issues"] if i["title"] == "Net 15 payment")["kind"] == "risk"


def test_prompt_includes_company_preferences():
    prompt = ca.build_analysis_prompt("T", preferences=[{"key": "payment_terms", "label": "Payment terms", "value": "Net 30"}])
    assert "Payment terms: Net 30" in prompt and "preference_mismatch" in prompt


def test_fields_nested_inside_verdict_are_hoisted():
    """Seen live: the model nested every field after verdict inside it, leaving 0 issues."""
    raw = _raw()
    verdict = raw.pop("verdict")
    nested = {k: raw.pop(k) for k in ("issues", "key_dates", "key_facts", "clauses", "risk_level")}
    raw["verdict"] = {**verdict, **nested}
    data = ca.normalize_analysis(raw)
    assert len(data["issues"]) == 4 and len(data["key_dates"]) == 3 and data["key_facts"]
    assert data["verdict"]["headline"] == "Don't sign as-is"


def test_prompt_shows_a_flat_output_skeleton():
    prompt = ca.build_analysis_prompt("TEXT")
    assert "never nest issues" in prompt
    assert '"issues": [{"severity"' in prompt

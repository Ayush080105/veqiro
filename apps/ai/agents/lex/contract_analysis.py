"""Contract review, shared by the /analyze-contract route and Lex's chat tool.

Version 2 is built around the question a founder actually brings: "can I sign this?". The
model returns a verdict, the handful of facts that define the deal, ONE de-duplicated list of
findings — each with the exact quote, why it matters, and a suggested position — the dates and
duties the reader must act on, and the contract's key metadata. Version 1 returned six
overlapping lists (risks, negotiation points, unusual clauses, missing protections, ambiguous
language, clause notes) that restated the same few problems at length.

Findings keep three categories apart rather than folding them into one score:
`document_risk` (a term in the contract that hurts you), `missing_information` (a protection
that is absent) and `company_preference_mismatch` (a term outside the company's own usual
position, when preferences are known).

Verdicts never say a contract is safe or legally sound: the strongest positive verdict is "No
critical issues found in this review".

The legacy v1 fields are still derived from the v2 content, so the server's message summary,
older clients, and previously saved analyses keep working.

Reliability: the call goes through `complete_json` (JSON mode, a larger budget on an empty
response, one corrective retry), the requested output is bounded, and every list is normalised
item by item so one malformed entry never fails the review.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger("lex.contract_analysis")

ANALYSIS_MAX_TOKENS = 16000
ANALYSIS_VERSION = 2

MAX_ISSUES = 10
MAX_FACTS = 6
MAX_DATES = 12
MAX_CLAUSES = 25
MAX_KEY_TERMS = 10
MAX_PARTIES = 6
MAX_PREFERENCES = 20

_SEVERITIES = ("critical", "high", "medium", "low")
_SEVERITY_RANK = {s: i for i, s in enumerate(_SEVERITIES)}
_KINDS = {"risk", "missing", "ambiguous", "unusual", "preference_mismatch"}
_CATEGORY_FOR_KIND = {
    "risk": "document_risk",
    "ambiguous": "document_risk",
    "unusual": "document_risk",
    "missing": "missing_information",
    "preference_mismatch": "company_preference_mismatch",
}
_ACTIONS = {"sign", "negotiate", "reject", "legal_review_required"}
_RECURRENCE = {"once", "monthly", "quarterly", "half_yearly", "yearly"}
_OWNERS = {"you", "counterparty", "both"}
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Deliberately never "safe to sign": Lex reports what this review found, not a legal guarantee.
_DEFAULT_HEADLINES = {
    "sign": "No critical issues found",
    "negotiate": "Review before signing",
    "reject": "Serious issues — don't sign as-is",
    "legal_review_required": "Get a lawyer to review",
}
_UNSAFE_HEADLINE = re.compile(r"\b(safe to sign|legally binding|guaranteed|definitely legal)\b", re.I)


def build_analysis_prompt(
    full_text: str,
    *,
    perspective: str = "",
    company_name: str = "",
    focus: list[str] | None = None,
    preferences: list[dict] | None = None,
) -> str:
    if perspective:
        side = f"Review it for: {perspective}. Every judgement is from that party's point of view."
    else:
        side = (
            "Decide whose side to review it for: "
            + (f"if '{company_name}' is (or clearly matches) one of the parties, that party; otherwise " if company_name else "")
            + "the party that was handed this contract to sign — usually the smaller business, vendor, "
            "service provider, employee or customer, not the party that drafted it."
        )
    focus_line = (
        f"\nThe reader asked you to pay extra attention to: {'; '.join(focus)}. Cover these explicitly.\n"
        if focus else ""
    )
    prefs = [p for p in (preferences or []) if p.get("value")][:MAX_PREFERENCES]
    preference_block = (
        "\nTHE COMPANY'S USUAL POSITIONS (compare the contract against these; where the contract departs "
        "from one, add a finding with kind 'preference_mismatch' and put the preference in 'preference'):\n"
        + "\n".join(f"- {p.get('label') or p.get('key')}: {p['value']}" for p in prefs)
        + "\n"
        if prefs else ""
    )
    return (
        "You are reviewing a contract for a busy founder who is not a lawyer. They want to know, in "
        "under a minute, what needs their attention before signing, what to push back on, and what "
        "they would be committing to. Write plainly, in second person ('you'), with no legal filler. "
        "Base every finding on the document; quote it exactly where asked; never invent clauses, amounts, "
        "dates or case law. You provide legal information, not legal advice: never say the contract is "
        "safe, legally sound, binding or guaranteed.\n\n"
        f"{side}\n{focus_line}{preference_block}\n"
        f"CONTRACT:\n{full_text}\n\n"
        "Return ONLY a JSON object with these keys:\n\n"
        "document_type: short name, e.g. 'Mess services agreement', 'Mutual NDA'.\n"
        "parties: list of 'Name (Role)'; use the role alone where the name is blank.\n"
        "perspective: the party you reviewed for, as 'Name (Role)' or the role.\n"
        "counterparty: the other main party, short name.\n"
        "verdict: object —\n"
        "  action: one of sign / negotiate / reject / legal_review_required (use sign only when no "
        "critical or high findings exist);\n"
        "  headline: at most 6 words, e.g. 'Review before signing', 'No critical issues found', "
        "'Serious issues — don't sign as-is'. Never 'safe to sign';\n"
        "  summary: at most 2 sentences and 45 words — the real reason, concrete, second person.\n"
        "favours: object — party (short name of who the contract favours, or 'Balanced'), "
        "lean (integer 0-100: 0 = strongly favours you, 50 = balanced, 100 = strongly favours the counterparty).\n"
        "risk_level: low / medium / high / critical. risk_score: integer 1-10.\n"
        f"key_facts: {MAX_FACTS // 2}-{MAX_FACTS} objects {{label, value}} — the snapshot of the deal: term, "
        "renewal, money (fees, deposits, caps), how either side can exit, disputes, jurisdiction. label at "
        "most 3 words, value at most 6 words, with real amounts and periods.\n"
        f"issues: 3-{MAX_ISSUES} findings, most severe first, ONE per underlying problem — if a problem shows "
        "up in several sections, list it once and name all its sections. Each:\n"
        "  severity: critical / high / medium / low;\n"
        "  kind: risk (a term that hurts you) / missing (a protection that should be there) / ambiguous "
        "(vague wording that invites disputes) / unusual (off-market term) / preference_mismatch (outside "
        "the company's usual position — only when positions were given);\n"
        "  title: at most 8 words, plain, e.g. 'They choose the arbitrator';\n"
        "  section: section number(s), e.g. '7.14.1' or '3.10, 4.5'; '' for a missing protection;\n"
        "  quote: what the contract says — exact words, at most 40 words; '' for a missing protection;\n"
        "  what_it_means: why it matters for you — at most 45 words;\n"
        "  send_back: the suggested position as ready-to-paste clause wording, at most 60 words;\n"
        "  preference: for preference_mismatch, the company position it departs from; else ''.\n"
        f"key_dates: up to {MAX_DATES} dates and recurring duties, yours first, then the counterparty's that "
        "matter to you. Include start, end/expiry, renewal, notice deadlines, payments, deliveries, reports, "
        "renewals of insurance or registrations. Each: when (the contract's timing at most 6 words, e.g. "
        "'Within 10 days of signing', 'Every month'), what (at most 14 words), owner (you / counterparty / "
        "both), section, recurrence (once / monthly / quarterly / half_yearly / yearly), date (YYYY-MM-DD "
        "only if the contract states the calendar date, else null), days_from_start (integer days after the "
        "contract starts for a one-off relative date, else null).\n"
        "contract: object — effective_date, expiry_date, renewal_date, notice_deadline (each YYYY-MM-DD only "
        "if stated or directly computable from stated dates, else null), auto_renewal (true / false / null), "
        "value (e.g. '₹12,00,000 per year' or null), currency (e.g. 'INR' or null), payment_terms (e.g. "
        "'Net 30' or null), dispute_resolution (e.g. 'Arbitration, Kanpur' or null).\n"
        f"clauses: up to {MAX_CLAUSES} objects covering the whole contract in order, grouping minor "
        "sub-clauses. Each: section, title, summary (at most 25 words), risk_level (low / medium / high / critical).\n"
        f"key_terms: object mapping up to {MAX_KEY_TERMS} defined or technical terms to plain meanings "
        "(at most 20 words each).\n"
        "effective_date, governing_law, jurisdiction: short strings, 'Not specified' if absent."
    )


# ── Normalisation ────────────────────────────────────────────────────────────


def _text(value: object, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, (list, tuple)):
        value = "; ".join(str(v) for v in value if v is not None)
    return " ".join(str(value).split()) or default


def _level(value: object, default: str = "medium") -> str:
    text = _text(value).lower()
    return text if text in _SEVERITIES else default


def _items(value: object, limit: int) -> list:
    return list(value)[:limit] if isinstance(value, list) else []


def _int(value: object, default: int | None = None) -> int | None:
    try:
        return int(float(value))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _iso(value: object) -> str | None:
    text = _text(value)
    return text if _ISO_DATE.match(text) else None


def _dropped(kind: str, item: object) -> None:
    logger.info("contract analysis | dropped malformed %s entry: %.200s", kind, item)


def _issues(value: object, preferences_given: bool) -> list[dict]:
    out = []
    for it in _items(value, MAX_ISSUES * 2):
        if not isinstance(it, dict) or not (_text(it.get("title")) and _text(it.get("what_it_means"))):
            _dropped("issue", it)
            continue
        kind = _text(it.get("kind")).lower()
        if kind not in _KINDS or (kind == "preference_mismatch" and not preferences_given):
            kind = "risk"
        out.append({
            "severity": _level(it.get("severity")),
            "kind": kind,
            "category": _CATEGORY_FOR_KIND[kind],
            "title": _text(it.get("title")),
            "section": _text(it.get("section")),
            "quote": _text(it.get("quote")).strip("\"“”"),
            "what_it_means": _text(it.get("what_it_means")),
            "send_back": _text(it.get("send_back")),
            "preference": _text(it.get("preference")) if kind == "preference_mismatch" else "",
        })
    out.sort(key=lambda i: _SEVERITY_RANK[i["severity"]])
    return out[:MAX_ISSUES]


def _facts(value: object) -> list[dict]:
    out = []
    for f in _items(value, MAX_FACTS):
        if isinstance(f, dict) and _text(f.get("label")) and _text(f.get("value")):
            out.append({"label": _text(f.get("label")), "value": _text(f.get("value"))})
        else:
            _dropped("key fact", f)
    return out


def _dates(value: object) -> list[dict]:
    out = []
    for d in _items(value, MAX_DATES):
        if not isinstance(d, dict) or not (_text(d.get("when")) and _text(d.get("what"))):
            _dropped("key date", d)
            continue
        recurrence = _text(d.get("recurrence")).lower().replace("-", "_").replace(" ", "_")
        owner = _text(d.get("owner")).lower()
        days = _int(d.get("days_from_start"))
        out.append({
            "when": _text(d.get("when")),
            "what": _text(d.get("what")),
            "owner": owner if owner in _OWNERS else "you",
            "section": _text(d.get("section")),
            "recurrence": recurrence if recurrence in _RECURRENCE else "once",
            "date": _iso(d.get("date")),
            "days_from_start": days if days is not None and days >= 0 else None,
        })
    return out


def _contract(value: object) -> dict:
    c = value if isinstance(value, dict) else {}
    auto = c.get("auto_renewal")
    return {
        "effective_date": _iso(c.get("effective_date")),
        "expiry_date": _iso(c.get("expiry_date")),
        "renewal_date": _iso(c.get("renewal_date")),
        "notice_deadline": _iso(c.get("notice_deadline")),
        "auto_renewal": auto if isinstance(auto, bool) else None,
        "value": _text(c.get("value")) or None,
        "currency": _text(c.get("currency")) or None,
        "payment_terms": _text(c.get("payment_terms")) or None,
        "dispute_resolution": _text(c.get("dispute_resolution")) or None,
    }


def _clauses(value: object) -> list[dict]:
    out = []
    for c in _items(value, MAX_CLAUSES):
        if not isinstance(c, dict) or not (_text(c.get("summary")) or _text(c.get("title"))):
            _dropped("clause", c)
            continue
        out.append({
            "section": _text(c.get("section")),
            "title": _text(c.get("title")),
            "summary": _text(c.get("summary")),
            "risk_level": _level(c.get("risk_level"), "low"),
        })
    return out


def _legacy_fields(result: dict) -> dict:
    """The v1 fields, derived from v2 content, for older clients and saved-message summaries."""
    issues = result["issues"]
    return {
        "executive_summary": result["verdict"]["summary"],
        "overall_assessment": result["verdict"]["summary"],
        "recommended_action": result["verdict"]["action"],
        "risks": [
            {
                "clause": " ".join(p for p in (f"§{i['section']}" if i["section"] else "", i["title"]) if p),
                "risk": i["what_it_means"],
                "severity": i["severity"],
                "recommendation": i["send_back"] or "Raise this with the counterparty.",
                "confidence": None,
                "basis": None,
            }
            for i in issues if i["kind"] != "missing"
        ],
        "negotiation_points": [
            {
                "priority": "high" if i["severity"] in ("critical", "high") else i["severity"],
                "clause": i["section"] or i["title"],
                "issue": i["what_it_means"],
                "suggested_change": i["send_back"],
            }
            for i in issues if i["send_back"]
        ],
        "unusual_clauses": [f"{i['title']} (§{i['section']})" if i["section"] else i["title"] for i in issues if i["kind"] == "unusual"],
        "missing_protections": [f"{i['title']} — {i['what_it_means']}" for i in issues if i["kind"] == "missing"],
        "ambiguous_clauses": [
            {"clause": i["quote"] or i["title"], "section": i["section"] or None,
             "issue": i["what_it_means"], "interpretation": i["send_back"] or "Clarify in writing."}
            for i in issues if i["kind"] == "ambiguous"
        ] or None,
        "clause_breakdown": [{**c, "notes": ""} for c in result["clauses"]],
        "obligations": {},
        "obligations_structured": None,
        "score_breakdown": {s: sum(1 for i in issues if i["severity"] == s) for s in _SEVERITIES},
    }


def normalize_analysis(data: object, *, preferences_given: bool = False) -> dict:
    """Coerce model output into the ContractAnalysis shape (v2 fields plus derived v1 fields).
    Raises ValueError only when the output is not an object at all."""
    if not isinstance(data, dict):
        raise ValueError(f"analysis is {type(data).__name__}, not a JSON object")

    issues = _issues(data.get("issues"), preferences_given)
    worst = issues[0]["severity"] if issues else "low"

    verdict_raw = data.get("verdict") if isinstance(data.get("verdict"), dict) else {}
    action = _text(verdict_raw.get("action")).lower().replace(" ", "_")
    if action not in _ACTIONS:
        action = "negotiate" if worst in ("critical", "high") else "sign"
    if action == "sign" and worst in ("critical", "high"):
        action = "negotiate"
    headline = " ".join(_text(verdict_raw.get("headline")).split()[:8])
    if not headline or _UNSAFE_HEADLINE.search(headline):
        headline = _DEFAULT_HEADLINES[action]
    verdict = {"action": action, "headline": headline, "summary": _text(verdict_raw.get("summary"))}

    favours_raw = data.get("favours") if isinstance(data.get("favours"), dict) else {}
    lean = _int(favours_raw.get("lean"), 50)
    favours = {"party": _text(favours_raw.get("party"), "Balanced"), "lean": max(0, min(100, lean if lean is not None else 50))}

    risk_level = _text(data.get("risk_level")).lower()
    key_terms_raw = data.get("key_terms")
    key_terms = {
        _text(k): _text(v)
        for k, v in list(key_terms_raw.items())[:MAX_KEY_TERMS]
        if _text(k) and _text(v)
    } if isinstance(key_terms_raw, dict) else {}

    result = {
        "version": ANALYSIS_VERSION,
        "document_type": _text(data.get("document_type"), "Contract"),
        "parties": [p for p in (_text(x) for x in _items(data.get("parties"), MAX_PARTIES)) if p],
        "perspective": _text(data.get("perspective")),
        "counterparty": _text(data.get("counterparty")),
        "verdict": verdict,
        "favours": favours,
        "risk_level": risk_level if risk_level in _SEVERITIES else worst,
        "risk_score": max(1, min(10, _int(data.get("risk_score"), 5) or 5)),
        "key_facts": _facts(data.get("key_facts")),
        "issues": issues,
        "key_dates": _dates(data.get("key_dates")),
        "contract": _contract(data.get("contract")),
        "clauses": _clauses(data.get("clauses")),
        "key_terms": key_terms,
        "effective_date": _text(data.get("effective_date"), "Not specified"),
        "governing_law": _text(data.get("governing_law"), "Not specified"),
        "jurisdiction": _text(data.get("jurisdiction"), "Not specified"),
    }
    result.update(_legacy_fields(result))
    return result


def failed_analysis(reason: str) -> dict:
    """The card shown when a review could not be produced — says so plainly."""
    summary = (
        "Lex couldn't finish reviewing this document. It uploaded correctly — run the review "
        "again, or ask Lex a specific question about it."
    )
    return {
        "version": ANALYSIS_VERSION,
        "failed": True,
        "document_type": "Review unavailable",
        "parties": [], "perspective": "", "counterparty": "",
        "verdict": {"action": "legal_review_required", "headline": "Review didn't finish", "summary": summary},
        "favours": None,
        "risk_level": "unknown", "risk_score": 0,
        "key_facts": [], "issues": [], "key_dates": [], "contract": None, "clauses": [], "key_terms": {},
        "effective_date": "", "governing_law": "", "jurisdiction": "",
        "executive_summary": summary,
        "overall_assessment": f"Automated review failed ({reason}).",
        "recommended_action": "legal_review_required",
        "risks": [], "negotiation_points": [], "unusual_clauses": [], "missing_protections": [],
        "ambiguous_clauses": None, "clause_breakdown": [], "obligations": {},
        "obligations_structured": None, "score_breakdown": None,
    }


async def analyze_contract_text(
    llm,
    *,
    provider: str,
    model: str,
    system: str,
    full_text: str,
    perspective: str = "",
    company_name: str = "",
    focus: list[str] | None = None,
    preferences: list[dict] | None = None,
) -> dict:
    """Run the review and return a dict matching ContractAnalysis. Never raises."""
    try:
        raw = await llm.complete_json(
            provider=provider, model=model, system=system,
            messages=[{"role": "user", "content": build_analysis_prompt(
                full_text, perspective=perspective, company_name=company_name,
                focus=focus, preferences=preferences,
            )}],
            max_tokens=ANALYSIS_MAX_TOKENS,
        )
        result = normalize_analysis(raw, preferences_given=bool(preferences))
        logger.info(
            "contract analysis done | chars=%d issues=%d dates=%d clauses=%d action=%s",
            len(full_text), len(result["issues"]), len(result["key_dates"]),
            len(result["clauses"]), result["verdict"]["action"],
        )
        return result
    except Exception as err:
        logger.error(
            "contract analysis failed | model=%s chars=%d error=%s: %s",
            model, len(full_text), type(err).__name__, str(err)[:300],
        )
        return failed_analysis("the model did not return a usable result")

"""Contract review, shared by the /analyze-contract route and Lex's chat tool.

Version 2 is built around the question a founder actually brings: "can I sign this?". The
model returns a verdict, the handful of facts that define the deal, ONE de-duplicated list of
issues — each with the exact quote, what it means for the reader, and wording to send back —
and the dates the reader has to act on. Version 1 returned six overlapping lists (risks,
negotiation points, unusual clauses, missing protections, ambiguous language, clause notes)
that restated the same few problems at length.

The legacy v1 fields are still derived from the v2 content, so the server's message summary,
older clients, and previously saved analyses keep working.

Reliability notes carried over from v1: the call goes through `complete_json` (JSON mode, a
larger budget on an empty response, one corrective retry), the requested output is bounded,
and every list is normalised item by item so one malformed entry never fails the review.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("lex.contract_analysis")

ANALYSIS_MAX_TOKENS = 16000
ANALYSIS_VERSION = 2

MAX_ISSUES = 10
MAX_FACTS = 6
MAX_DATES = 10
MAX_CLAUSES = 25
MAX_KEY_TERMS = 10
MAX_PARTIES = 6

_SEVERITIES = ("critical", "high", "medium", "low")
_SEVERITY_RANK = {s: i for i, s in enumerate(_SEVERITIES)}
_KINDS = {"risk", "missing", "ambiguous", "unusual"}
_ACTIONS = {"sign", "negotiate", "reject", "legal_review_required"}
_RECURRENCE = {"once", "monthly", "quarterly", "half_yearly", "yearly"}

_DEFAULT_HEADLINES = {
    "sign": "Safe to sign",
    "negotiate": "Negotiate before signing",
    "reject": "Don't sign this",
    "legal_review_required": "Get a lawyer to review",
}


def build_analysis_prompt(
    full_text: str,
    *,
    perspective: str = "",
    company_name: str = "",
    focus: list[str] | None = None,
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
    return (
        "You are reviewing a contract for a busy founder who is not a lawyer. They want to know, in "
        "under a minute, whether they can sign it, what to push back on, and what they would be "
        "committing to. Write plainly, in second person ('you'), with no legal filler. Quote the "
        "contract exactly where asked; never invent clauses, amounts or case law.\n\n"
        f"{side}\n{focus_line}\n"
        f"CONTRACT:\n{full_text}\n\n"
        "Return ONLY a JSON object with these keys:\n\n"
        "document_type: short name, e.g. 'Mess services agreement', 'Mutual NDA'.\n"
        "parties: list of 'Name (Role)'; use the role alone where the name is blank.\n"
        "perspective: the party you reviewed for, as 'Name (Role)' or the role.\n"
        "counterparty: the other main party, short name.\n"
        "verdict: object —\n"
        "  action: one of sign / negotiate / reject / legal_review_required;\n"
        "  headline: at most 6 words, e.g. \"Don't sign as-is\", \"Sign after 2 changes\", \"Safe to sign\";\n"
        "  summary: at most 2 sentences and 45 words — the real reason, concrete, second person.\n"
        "favours: object — party (short name of who the contract favours, or 'Balanced'), "
        "lean (integer 0-100: 0 = strongly favours you, 50 = balanced, 100 = strongly favours the counterparty).\n"
        "risk_level: low / medium / high / critical. risk_score: integer 1-10.\n"
        f"key_facts: {MAX_FACTS // 2}-{MAX_FACTS} objects {{label, value}} for the facts that define the deal — "
        "term, money (fees, deposits, caps), payment timing, how either side can exit, liability, where "
        "disputes go. label at most 3 words, value at most 6 words, with real amounts and periods.\n"
        f"issues: 3-{MAX_ISSUES} objects, most severe first, ONE per underlying problem — if a problem shows "
        "up in several sections, list it once and name all its sections. Each:\n"
        "  severity: critical / high / medium / low;\n"
        "  kind: risk (a term that hurts you) / missing (a protection that should be there) / "
        "ambiguous (vague wording that invites disputes) / unusual (off-market term);\n"
        "  title: at most 8 words, plain, e.g. 'They choose the arbitrator';\n"
        "  section: section number(s), e.g. '7.14.1' or '3.10, 4.5'; '' for a missing protection;\n"
        "  quote: the exact words from the contract, at most 40 words; '' for a missing protection;\n"
        "  what_it_means: at most 45 words — the practical consequence for you;\n"
        "  send_back: the replacement or additional clause wording to propose, ready to paste, at most 60 words.\n"
        f"key_dates: up to {MAX_DATES} objects for deadlines and recurring duties YOU must act on (then the "
        "counterparty's that matter to you). Each: when (at most 6 words, e.g. 'Within 10 days of signing', "
        "'Every month'), what (at most 14 words), section, recurrence (once / monthly / quarterly / "
        "half_yearly / yearly), days_from_start (integer days after the contract starts for a one-off date, else null).\n"
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


def _opt_text(value: object) -> str | None:
    return _text(value) or None


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


def _dropped(kind: str, item: object) -> None:
    logger.info("contract analysis | dropped malformed %s entry: %.200s", kind, item)


def _issues(value: object) -> list[dict]:
    out = []
    for it in _items(value, MAX_ISSUES * 2):
        if not isinstance(it, dict) or not (_text(it.get("title")) and _text(it.get("what_it_means"))):
            _dropped("issue", it)
            continue
        kind = _text(it.get("kind")).lower()
        out.append({
            "severity": _level(it.get("severity")),
            "kind": kind if kind in _KINDS else "risk",
            "title": _text(it.get("title")),
            "section": _text(it.get("section")),
            "quote": _text(it.get("quote")).strip("\"“”"),
            "what_it_means": _text(it.get("what_it_means")),
            "send_back": _text(it.get("send_back")),
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
        days = _int(d.get("days_from_start"))
        out.append({
            "when": _text(d.get("when")),
            "what": _text(d.get("what")),
            "section": _text(d.get("section")),
            "recurrence": recurrence if recurrence in _RECURRENCE else "once",
            "days_from_start": days if days is not None and days >= 0 else None,
        })
    return out


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


def normalize_analysis(data: object) -> dict:
    """Coerce model output into the ContractAnalysis shape (v2 fields plus derived v1 fields).
    Raises ValueError only when the output is not an object at all."""
    if not isinstance(data, dict):
        raise ValueError(f"analysis is {type(data).__name__}, not a JSON object")

    issues = _issues(data.get("issues"))
    worst = issues[0]["severity"] if issues else "low"

    verdict_raw = data.get("verdict") if isinstance(data.get("verdict"), dict) else {}
    action = _text(verdict_raw.get("action")).lower().replace(" ", "_")
    if action not in _ACTIONS:
        action = "negotiate" if worst in ("critical", "high") else "sign"
    verdict = {
        "action": action,
        "headline": " ".join(_text(verdict_raw.get("headline")).split()[:8]) or _DEFAULT_HEADLINES[action],
        "summary": _text(verdict_raw.get("summary")),
    }

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
        "key_facts": [], "issues": [], "key_dates": [], "clauses": [], "key_terms": {},
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
) -> dict:
    """Run the review and return a dict matching ContractAnalysis. Never raises."""
    try:
        raw = await llm.complete_json(
            provider=provider, model=model, system=system,
            messages=[{"role": "user", "content": build_analysis_prompt(
                full_text, perspective=perspective, company_name=company_name, focus=focus,
            )}],
            max_tokens=ANALYSIS_MAX_TOKENS,
        )
        result = normalize_analysis(raw)
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

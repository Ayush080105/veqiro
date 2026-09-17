"""Structured contract analysis, shared by the /analyze-contract route and Lex's chat tool.

The previous version asked a reasoning model for an exhaustive JSON document — every numbered
section, every obligation twice (as a dict and as structured items) — under a 10k-token cap
that the model's own reasoning also draws from. On a long contract the budget ran out before
any JSON was written, the empty string failed `json.loads`, and a bare `except` returned a
"Parsing failed" card without logging anything. One malformed list item failed the whole
analysis the same way.

Here the request is bounded (sections and lists are capped), the call goes through
`complete_json` (JSON mode, a larger budget on an empty response, one corrective retry on bad
JSON), and the result is normalised item by item: a bad risk or clause is dropped, not the
analysis. A failure is logged with its cause and returns a card that says what happened.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("lex.contract_analysis")

# Output budget for the first attempt. complete_json triples it if the model returns nothing,
# which is what a reasoning model does when reasoning consumes the whole budget.
ANALYSIS_MAX_TOKENS = 16000

MAX_CLAUSE_SECTIONS = 20
MAX_RISKS = 10
MAX_OBLIGATIONS_PER_PARTY = 10
MAX_LIST_ITEMS = 8
MAX_KEY_TERMS = 12

_SEVERITIES = {"low", "medium", "high", "critical"}
_ACTIONS = {"sign", "negotiate", "reject", "legal_review_required"}


def build_analysis_prompt(full_text: str) -> str:
    return (
        "Perform a thorough, senior-attorney-level legal analysis of this contract. "
        "Be specific — quote exact clause language when relevant, name exact section numbers, "
        "and explain practical real-world impact, not just legal theory. Be concise: every "
        "string is a tight sentence or two, never a paragraph.\n\n"
        f"CONTRACT:\n{full_text}\n\n"
        "Return ONLY a valid JSON object with EXACTLY these keys:\n\n"
        "document_type (string — precise document type),\n"
        "parties (list of strings — each 'Full Legal Name (Role)'; use the role alone if the name is blank in the document),\n"
        "effective_date (string — exact date or 'Not specified'),\n"
        "governing_law (string),\n"
        "jurisdiction (string — courts where disputes must be filed),\n"
        "executive_summary (string — 4-6 sentences: what it is, the parties, its commercial purpose, "
        "overall balance, and a plain-English verdict on who it favours),\n"
        "risk_level (string — one of: low/medium/high/critical),\n"
        "risk_score (integer 1-10 where 1=essentially no risk, 10=do not sign),\n"
        "score_breakdown (object — critical, high, medium, low as integers counting the risks below),\n"
        f"risks (list, 3-{MAX_RISKS} most material, each: clause, risk (problem and business impact), "
        "severity (low/medium/high/critical), recommendation (specific fix), "
        "confidence (high/medium/low), basis (one sentence citing the legal authority or market precedent)),\n"
        f"unusual_clauses (list of up to {MAX_LIST_ITEMS} strings — section and why it deviates from market standard),\n"
        f"missing_protections (list of up to {MAX_LIST_ITEMS} strings — what is missing and the risk it creates),\n"
        f"clause_breakdown (list of at most {MAX_CLAUSE_SECTIONS} objects covering the most material "
        "sections — group minor or purely definitional sub-clauses into their parent article; each: "
        "section, title, summary (1-2 sentences), risk_level (low/medium/high/critical), "
        "notes (specific issues or 'Standard — no issues')),\n"
        f"key_terms (object — 5-{MAX_KEY_TERMS} defined terms mapped to their practical meaning as strings),\n"
        f"obligations_structured (list — one object per party: party (exact name from parties), items "
        f"(up to {MAX_OBLIGATIONS_PER_PARTY} most important obligations, each: action, deadline (string or null), "
        "condition (string or null), consequence (string or null))),\n"
        f"ambiguous_clauses (list of up to {MAX_LIST_ITEMS} — vague or undefined language that could cause "
        "disputes; each: clause (the exact phrase), section (string or null), issue, "
        "interpretation (how courts in the governing jurisdiction typically read it)),\n"
        f"negotiation_points (list, 3-{MAX_LIST_ITEMS}, each: priority (high/medium/low), clause, issue, "
        "suggested_change (exact proposed language or deletion)),\n"
        "overall_assessment (string — 3-4 sentences: who it favours, what would change your "
        "recommendation, whether to sign as-is),\n"
        "recommended_action (string — one of: sign/negotiate/reject/legal_review_required)"
    )


# ── Normalisation ────────────────────────────────────────────────────────────


def _text(value: object, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, (list, tuple)):
        value = "; ".join(str(v) for v in value if v is not None)
    return " ".join(str(value).split()) or default


def _opt_text(value: object) -> str | None:
    text = _text(value)
    return text or None


def _level(value: object, default: str = "medium") -> str:
    text = _text(value).lower()
    return text if text in _SEVERITIES else default


def _items(value: object, limit: int) -> list:
    return list(value)[:limit] if isinstance(value, list) else []


def _strings(value: object, limit: int) -> list[str]:
    return [t for t in (_text(v) for v in _items(value, limit)) if t]


def _dropped(kind: str, item: object) -> None:
    logger.info("contract analysis | dropped malformed %s entry: %.200s", kind, item)


def _risks(value: object) -> list[dict]:
    out = []
    for r in _items(value, MAX_RISKS):
        if not isinstance(r, dict) or not _text(r.get("risk")):
            _dropped("risk", r)
            continue
        confidence = _text(r.get("confidence")).lower()
        out.append({
            "clause": _text(r.get("clause"), "Unspecified clause"),
            "risk": _text(r.get("risk")),
            "severity": _level(r.get("severity")),
            "recommendation": _text(r.get("recommendation"), "Review with counsel."),
            "confidence": confidence if confidence in {"high", "medium", "low"} else None,
            "basis": _opt_text(r.get("basis")),
        })
    return out


def _clauses(value: object) -> list[dict]:
    out = []
    for c in _items(value, MAX_CLAUSE_SECTIONS):
        if not isinstance(c, dict) or not (_text(c.get("summary")) or _text(c.get("title"))):
            _dropped("clause", c)
            continue
        out.append({
            "section": _text(c.get("section")),
            "title": _text(c.get("title")),
            "summary": _text(c.get("summary")),
            "risk_level": _level(c.get("risk_level"), "low"),
            "notes": _text(c.get("notes"), "Standard — no issues"),
        })
    return out


def _obligations(value: object) -> list[dict]:
    out = []
    for p in _items(value, MAX_LIST_ITEMS):
        if not isinstance(p, dict) or not _text(p.get("party")):
            _dropped("obligation party", p)
            continue
        items = []
        for it in _items(p.get("items"), MAX_OBLIGATIONS_PER_PARTY):
            action = _text(it.get("action")) if isinstance(it, dict) else _text(it)
            if not action:
                continue
            items.append({
                "action": action,
                "deadline": _opt_text(it.get("deadline")) if isinstance(it, dict) else None,
                "condition": _opt_text(it.get("condition")) if isinstance(it, dict) else None,
                "consequence": _opt_text(it.get("consequence")) if isinstance(it, dict) else None,
            })
        if items:
            out.append({"party": _text(p.get("party")), "items": items})
    return out


def _ambiguous(value: object) -> list[dict]:
    out = []
    for a in _items(value, MAX_LIST_ITEMS):
        if not isinstance(a, dict) or not _text(a.get("clause")):
            _dropped("ambiguous clause", a)
            continue
        out.append({
            "clause": _text(a.get("clause")),
            "section": _opt_text(a.get("section")),
            "issue": _text(a.get("issue"), "Undefined or vague language."),
            "interpretation": _text(a.get("interpretation"), "No settled interpretation."),
        })
    return out


def _negotiation(value: object) -> list[dict]:
    out = []
    for n in _items(value, MAX_LIST_ITEMS):
        if not isinstance(n, dict) or not _text(n.get("issue")):
            _dropped("negotiation point", n)
            continue
        priority = _text(n.get("priority")).lower()
        out.append({
            "priority": priority if priority in {"high", "medium", "low"} else "medium",
            "clause": _text(n.get("clause"), "General"),
            "issue": _text(n.get("issue")),
            "suggested_change": _text(n.get("suggested_change"), "Clarify with the counterparty."),
        })
    return out


def _int(value: object, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def normalize_analysis(data: object) -> dict:
    """Coerce model output into the ContractAnalysis shape. Raises ValueError only when the
    output is not an object at all; anything inside is repaired or dropped item by item."""
    if not isinstance(data, dict):
        raise ValueError(f"analysis is {type(data).__name__}, not a JSON object")

    risks = _risks(data.get("risks"))
    obligations_structured = _obligations(data.get("obligations_structured"))

    # Counted from the risks actually kept, so the badge always matches the list.
    breakdown = {s: 0 for s in ("critical", "high", "medium", "low")}
    for r in risks:
        breakdown[r["severity"]] += 1

    key_terms_raw = data.get("key_terms")
    key_terms = {
        _text(k): _text(v)
        for k, v in list(key_terms_raw.items())[:MAX_KEY_TERMS]
        if _text(k) and _text(v)
    } if isinstance(key_terms_raw, dict) else {}

    action = _text(data.get("recommended_action")).lower().replace(" ", "_")
    risk_level = _text(data.get("risk_level")).lower()

    return {
        "document_type": _text(data.get("document_type"), "Contract"),
        "parties": _strings(data.get("parties"), MAX_LIST_ITEMS),
        "effective_date": _text(data.get("effective_date"), "Not specified"),
        "governing_law": _text(data.get("governing_law"), "Not specified"),
        "jurisdiction": _text(data.get("jurisdiction"), "Not specified"),
        "executive_summary": _text(data.get("executive_summary")),
        "risk_level": risk_level if risk_level in _SEVERITIES else "medium",
        "risk_score": max(1, min(10, _int(data.get("risk_score"), 5))),
        "risks": risks,
        "unusual_clauses": _strings(data.get("unusual_clauses"), MAX_LIST_ITEMS),
        "missing_protections": _strings(data.get("missing_protections"), MAX_LIST_ITEMS),
        "clause_breakdown": _clauses(data.get("clause_breakdown")),
        "key_terms": key_terms,
        # The plain per-party list is derived, not requested: asking the model for the same
        # obligations twice doubled the longest part of the output.
        "obligations": {p["party"]: [i["action"] for i in p["items"]] for p in obligations_structured},
        "negotiation_points": _negotiation(data.get("negotiation_points")),
        "overall_assessment": _text(data.get("overall_assessment")),
        "recommended_action": action if action in _ACTIONS else "legal_review_required",
        "score_breakdown": breakdown,
        "obligations_structured": obligations_structured or None,
        "ambiguous_clauses": _ambiguous(data.get("ambiguous_clauses")) or None,
    }


def failed_analysis(reason: str) -> dict:
    """The card shown when analysis could not be produced — says so instead of 'Unknown'."""
    return {
        "document_type": "Analysis unavailable",
        "parties": [], "effective_date": "", "governing_law": "", "jurisdiction": "",
        "executive_summary": (
            "Lex could not complete the automated analysis of this document. The document "
            "itself uploaded correctly — try the analysis again, or ask Lex a specific question "
            "about it."
        ),
        "risk_level": "unknown", "risk_score": 0,
        "risks": [], "unusual_clauses": [], "missing_protections": [],
        "clause_breakdown": [], "key_terms": {}, "obligations": {},
        "negotiation_points": [],
        "overall_assessment": f"Automated analysis failed ({reason}) — manual review recommended.",
        "recommended_action": "legal_review_required",
    }


async def analyze_contract_text(llm, *, provider: str, model: str, system: str, full_text: str) -> dict:
    """Run the analysis and return a dict matching ContractAnalysis. Never raises."""
    try:
        raw = await llm.complete_json(
            provider=provider, model=model, system=system,
            messages=[{"role": "user", "content": build_analysis_prompt(full_text)}],
            max_tokens=ANALYSIS_MAX_TOKENS,
        )
        result = normalize_analysis(raw)
        logger.info(
            "contract analysis done | chars=%d risks=%d clauses=%d",
            len(full_text), len(result["risks"]), len(result["clause_breakdown"]),
        )
        return result
    except Exception as err:
        logger.error(
            "contract analysis failed | model=%s chars=%d error=%s: %s",
            model, len(full_text), type(err).__name__, str(err)[:300],
        )
        return failed_analysis("the model did not return a usable result")

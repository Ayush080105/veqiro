"""Lex's capabilities, written once and shared by the HTTP routes and the chat tools.

Before this module each capability existed twice — a route version and a chat-tool version —
with different prompts, different output shapes (the research route returned `summary` and
`applicable_laws` while the research card reads `answer` and `sections`, so every research
result from the form rendered empty) and different failure handling (bare `json.loads` under
small token caps, which a reasoning model exhausts before writing any output).

Every structured call here goes through `complete_json`, has a budget sized for a reasoning
model, is normalised field by field, logs its real failure, and returns a result that says
plainly what went wrong instead of a blank card.

Jurisdiction defaults to the organisation's own location, then India — Veqiro's users are
Indian founders, and the previous US/Delaware defaults produced advice for the wrong country.
"""

from __future__ import annotations

import asyncio
import logging
import re

logger = logging.getLogger("lex.services")

JSON_BUDGET = 8000
DRAFT_BUDGET = 16000
DEFAULT_JURISDICTION = "India"

# The strings older clients sent as defaults; treated as "not chosen".
_LEGACY_DEFAULTS = {"", "united states", "united states (delaware)", "delaware, usa", "us"}

INDIA_FRAMEWORKS = [
    "Digital Personal Data Protection Act, 2023",
    "Information Technology Act, 2000 and IT Rules",
    "Consumer Protection (E-Commerce) Rules, 2020",
]


# ── Shared helpers ───────────────────────────────────────────────────────────


def _text(value: object, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, (list, tuple)):
        value = "; ".join(str(v) for v in value if v is not None)
    return " ".join(str(value).split()) or default


def _strings(value: object, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [t for t in (_text(v) for v in value[:limit]) if t]


def _confidence(value: object) -> str:
    word = (_text(value).lower().split() or ["medium"])[0]
    return word if word in ("high", "medium", "low") else "medium"


def resolve_jurisdiction(requested: str | None, location: str | None = None) -> str:
    """The user's explicit choice, else the organisation's location, else India."""
    chosen = _text(requested)
    if chosen and chosen.lower() not in _LEGACY_DEFAULTS:
        return chosen
    return _text(location) or DEFAULT_JURISDICTION


async def org_location(organization_id: str) -> str:
    if not organization_id:
        return ""
    try:
        from core.brand_kit import load_brand_kit
        kit = await load_brand_kit(organization_id)
        return _text(getattr(kit, "location", ""))
    except Exception as err:
        logger.warning("brand kit location unavailable | org=%s error=%s", organization_id, err)
        return ""


async def org_company_name(organization_id: str) -> str:
    if not organization_id:
        return ""
    try:
        from core.brand_kit import load_brand_kit
        kit = await load_brand_kit(organization_id)
        name = _text(getattr(kit, "company_name", ""))
        return "" if name == "My Company" else name
    except Exception:
        return ""


_MD_PATTERNS = [
    (re.compile(r"\*\*(.+?)\*\*", re.S), r"\1"),
    (re.compile(r"__(.+?)__", re.S), r"\1"),
    (re.compile(r"(?m)^#{1,6}\s+"), ""),
    (re.compile(r"(?m)^\s*```[a-zA-Z]*\s*$"), ""),
    (re.compile(r"`([^`]+)`"), r"\1"),
]


def strip_markdown(text: str) -> str:
    """Legal documents are exported to DOCX/PDF and shown verbatim — markdown markers would
    print as literal asterisks and hashes."""
    for pattern, repl in _MD_PATTERNS:
        text = pattern.sub(repl, text)
    return text.strip()


# ── Upload summary ───────────────────────────────────────────────────────────

_DOC_TYPES = {
    "nda", "mou", "employment_agreement", "service_agreement", "vendor_agreement",
    "partnership_agreement", "shareholder_agreement", "lease_agreement", "loan_agreement",
    "settlement_agreement", "policy", "terms_of_service", "other",
}


async def summarize_document(llm, *, provider: str, model: str, full_text: str, fallback_type: str) -> dict:
    """Three-line summary and topics for a freshly uploaded document. Never raises."""
    try:
        data = await llm.complete_json(
            provider=provider, model=model,
            system="You are a legal document analyst. Be precise, plain and brief.",
            messages=[{"role": "user", "content": (
                "Summarise this document for a busy founder. Return ONLY a JSON object with:\n"
                "summary: at most 3 short sentences — what it is, between whom, and the single most "
                "important thing to know before signing.\n"
                "key_topics: 3-6 short plain labels, e.g. 'Security deposit', 'Termination'.\n"
                f"document_type_detected: one of {', '.join(sorted(_DOC_TYPES))}.\n\n"
                f"DOCUMENT:\n{full_text[:30000]}"
            )}],
            max_tokens=JSON_BUDGET,
        )
        detected = _text(data.get("document_type_detected")).lower()
        return {
            "summary": _text(data.get("summary")),
            "key_topics": _strings(data.get("key_topics"), 6),
            "document_type_detected": detected if detected in _DOC_TYPES else fallback_type,
        }
    except Exception as err:
        logger.error("document summary failed | error=%s: %s", type(err).__name__, str(err)[:300])
        return {"summary": "", "key_topics": [], "document_type_detected": fallback_type}


# ── Ask a document ───────────────────────────────────────────────────────────


async def answer_from_document(llm, *, provider: str, model: str, question: str, chunks: list[dict]) -> dict:
    """Answer a question from a document's most relevant passages, quoting what it relies on."""
    context = "\n\n---\n\n".join(f"[Passage {i + 1}]\n{c['content']}" for i, c in enumerate(chunks))
    try:
        data = await llm.complete_json(
            provider=provider, model=model,
            system=(
                "You answer questions about a contract for a founder who is not a lawyer. Answer only "
                "from the passages given. Be direct: lead with the answer, then the detail that matters."
            ),
            messages=[{"role": "user", "content": (
                f"PASSAGES FROM THE DOCUMENT:\n{context}\n\nQUESTION: {question}\n\n"
                "Return ONLY a JSON object with:\n"
                "found: true if the passages answer the question, else false.\n"
                "answer: 1-4 plain sentences. If not found, say what the passages do cover and suggest "
                "running a full review.\n"
                "citations: up to 3 objects {section: section number or '', quote: exact words from the "
                "passages, at most 30 words} that support the answer; [] if not found."
            )}],
            max_tokens=JSON_BUDGET,
        )
        citations = []
        for c in data.get("citations") or []:
            if isinstance(c, dict) and _text(c.get("quote")):
                citations.append({"section": _text(c.get("section")), "quote": _text(c.get("quote")).strip("\"“”")})
        return {
            "answer": _text(data.get("answer")) or "I couldn't find that in this document.",
            "found": bool(data.get("found")) and bool(_text(data.get("answer"))),
            "citations": citations[:3],
        }
    except Exception as err:
        logger.error("document answer failed | error=%s: %s", type(err).__name__, str(err)[:300])
        return {"answer": "Lex couldn't answer that just now — try asking again.", "found": False, "citations": []}


# ── Explain ──────────────────────────────────────────────────────────────────


async def explain_text(llm, *, provider: str, model: str, system: str, text: str, context: str | None) -> dict:
    try:
        data = await llm.complete_json(
            provider=provider, model=model, system=system,
            messages=[{"role": "user", "content": (
                f"Explain this legal text to a founder who is not a lawyer:\n\n{text}\n\n"
                f"Where it comes from: {context or 'not given'}\n\n"
                "Return ONLY a JSON object with:\n"
                "explanation: 2-4 plain sentences on what it means and what it lets each side do.\n"
                "practical_implications: 2-5 short concrete consequences for you.\n"
                "key_terms: object of up to 6 terms mapped to plain meanings (at most 20 words each).\n"
                "related_concepts: up to 4 short labels."
            )}],
            max_tokens=JSON_BUDGET,
        )
        terms = data.get("key_terms") if isinstance(data.get("key_terms"), dict) else {}
        return {
            "explanation": _text(data.get("explanation")) or "Lex couldn't explain this text — try again.",
            "practical_implications": _strings(data.get("practical_implications"), 5),
            "key_terms": {_text(k): _text(v) for k, v in list(terms.items())[:6] if _text(k) and _text(v)},
            "related_concepts": _strings(data.get("related_concepts"), 4),
        }
    except Exception as err:
        logger.error("explain failed | error=%s: %s", type(err).__name__, str(err)[:300])
        return {"explanation": "Lex couldn't explain this text just now — try again.",
                "practical_implications": [], "key_terms": {}, "related_concepts": []}


# ── Research ─────────────────────────────────────────────────────────────────


async def _search(query: str, jurisdiction: str) -> list[dict]:
    from agents.scout.scraper import serper_search

    queries = [f"{query} {jurisdiction}".strip()]
    if jurisdiction.lower().startswith("india") or "india" in jurisdiction.lower():
        queries.append(f"{query} site:gov.in OR site:mca.gov.in OR site:indiacode.nic.in")
    else:
        queries.append(f"{query} {jurisdiction} official government guidance")
    batches = await asyncio.gather(*[serper_search(q) for q in queries], return_exceptions=True)
    seen, results = set(), []
    for batch in batches:
        if isinstance(batch, BaseException):
            continue
        for r in batch:
            link = r.get("link", "")
            if link and link not in seen and r.get("snippet"):
                seen.add(link)
                results.append(r)
    return results[:8]


_SECTION_TYPES = {"ordered", "bullets", "narrative"}


def _sections(value: object) -> list[dict]:
    out = []
    for s in value if isinstance(value, list) else []:
        if not isinstance(s, dict):
            continue
        items = _strings(s.get("items"), 10)
        if not items:
            continue
        kind = _text(s.get("type")).lower()
        out.append({"title": _text(s.get("title"), "Details"), "type": kind if kind in _SECTION_TYPES else "bullets", "items": items})
    return out[:5]


async def research(
    llm, *, provider: str, model: str, system: str, query: str, jurisdiction: str, legal_areas: list[str] | None = None,
) -> dict:
    """Answer a legal question from current web sources, citing them. Never raises."""
    sources = await _search(query, jurisdiction)
    source_block = "\n\n".join(
        f"[{i + 1}] {s.get('title', '')}\n{s.get('link', '')}\n{s.get('snippet', '')}" for i, s in enumerate(sources)
    ) or "No search results were available."
    try:
        data = await llm.complete_json(
            provider=provider, model=model, system=system,
            messages=[{"role": "user", "content": (
                f"QUESTION: {query}\nJURISDICTION: {jurisdiction}\n"
                + (f"AREAS: {', '.join(legal_areas)}\n" if legal_areas else "")
                + f"\nCURRENT WEB SOURCES:\n{source_block}\n\n"
                "Answer for a founder who is not a lawyer. Prefer the sources for anything that changes "
                "over time — fees, forms, thresholds, deadlines — and cite them as [n]. If the sources do "
                "not cover something and you rely on general knowledge, say so. Never invent case names, "
                "section numbers, fees or form numbers.\n\n"
                "Return ONLY a JSON object with:\n"
                "answer: 2-4 short paragraphs — the direct answer first, then what to do.\n"
                "sections: 0-4 objects {title, type: ordered|bullets|narrative, items: [strings]} — only "
                "where they add value, e.g. Steps (ordered), Documents needed, Fees and timeline, Watch out for.\n"
                "references: statutes, rules or official notifications that apply, precisely named.\n"
                "relevant_cases: case law ONLY if named in the sources, else [].\n"
                "jurisdiction_notes: one concrete caveat, or ''.\n"
                "confidence_level: high, medium or low — low if the sources were thin."
            )}],
            max_tokens=JSON_BUDGET,
        )
        answer = _text(data.get("answer"))
        if not answer:
            raise ValueError("research returned no answer")
        return {
            "answer": str(data.get("answer")).strip(),
            "sections": _sections(data.get("sections")),
            "references": _strings(data.get("references"), 8),
            "relevant_cases": _strings(data.get("relevant_cases"), 4),
            "jurisdiction_notes": _text(data.get("jurisdiction_notes")),
            "confidence_level": _confidence(data.get("confidence_level")) if sources else "low",
            "jurisdiction": jurisdiction,
            "sources": [{"title": _text(s.get("title")), "url": s.get("link", "")} for s in sources],
        }
    except Exception as err:
        logger.error("research failed | jurisdiction=%s error=%s: %s", jurisdiction, type(err).__name__, str(err)[:300])
        return {
            "answer": "Lex couldn't complete this research just now — try asking again.",
            "sections": [], "references": [], "relevant_cases": [], "jurisdiction_notes": "",
            "confidence_level": "low", "jurisdiction": jurisdiction, "sources": [],
            "failed": True,
        }


# ── Compliance ───────────────────────────────────────────────────────────────


async def compliance(
    llm, *, provider: str, model: str, system: str, description: str, frameworks: list[str],
    business_context: str, jurisdiction: str,
) -> dict:
    chosen = [f for f in frameworks if _text(f)]
    framework_line = (
        f"Check against: {', '.join(chosen)}."
        if chosen else
        f"Pick the laws that actually apply to this business in {jurisdiction} (for India typically "
        f"{'; '.join(INDIA_FRAMEWORKS)}, plus sector rules such as FSSAI, GST or RBI where relevant; "
        "GDPR/CCPA only if they serve EU/California users). Check against those."
    )
    try:
        data = await llm.complete_json(
            provider=provider, model=model, system=system,
            messages=[{"role": "user", "content": (
                f"WHAT TO CHECK: {description}\nBUSINESS: {business_context or 'not given'}\n"
                f"JURISDICTION: {jurisdiction}\n{framework_line}\n\n"
                "Write for a founder, plainly. Return ONLY a JSON object with:\n"
                "overall_status: compliant / partial / non_compliant.\n"
                "framework_results: one object per law {framework, status (compliant/partial/non_compliant), "
                "gaps: up to 5 plain strings, requirements: up to 5 plain strings}.\n"
                "critical_gaps: up to 5 things that could get you fined or sued now.\n"
                "remediation_steps: up to 7 objects {priority: high/medium/low, action: one concrete step}.\n"
                "estimated_effort: one short phrase, e.g. '1-2 weeks, mostly policy work'."
            )}],
            max_tokens=JSON_BUDGET,
        )
        results = []
        for f in data.get("framework_results") or []:
            if isinstance(f, dict) and _text(f.get("framework")):
                results.append({
                    "framework": _text(f.get("framework")), "status": _text(f.get("status"), "partial"),
                    "gaps": _strings(f.get("gaps"), 5), "requirements": _strings(f.get("requirements"), 5),
                })
        steps = []
        for s in data.get("remediation_steps") or []:
            if isinstance(s, dict) and _text(s.get("action")):
                p = _text(s.get("priority")).lower()
                steps.append({"priority": p if p in ("high", "medium", "low") else "medium", "action": _text(s.get("action"))})
        status = _text(data.get("overall_status")).lower().replace(" ", "_").replace("-", "_")
        return {
            "overall_status": status if status in ("compliant", "partial", "non_compliant") else "partial",
            "framework_results": results[:6],
            "critical_gaps": _strings(data.get("critical_gaps"), 5),
            "remediation_steps": steps[:7],
            "estimated_effort": _text(data.get("estimated_effort"), "Review with counsel"),
            "jurisdiction": jurisdiction,
        }
    except Exception as err:
        logger.error("compliance failed | error=%s: %s", type(err).__name__, str(err)[:300])
        return {
            "overall_status": "unknown", "framework_results": [], "critical_gaps": [],
            "remediation_steps": [], "estimated_effort": "Lex couldn't finish this check — try again.",
            "jurisdiction": jurisdiction, "failed": True,
        }


# ── Draft ────────────────────────────────────────────────────────────────────

_FORMAT_GUIDE = (
    "Use the format natural to this document type. Letters (offer, demand, resignation) use letter "
    "format with no numbered clauses. Agreements use a title in capitals, a parties block, recitals "
    "where useful, numbered clauses with capitalised headings, and a signature block with witness "
    "lines where customary. Policies use numbered or headed sections without a parties block. Notices "
    "and resolutions use a To/From/Date/Subject header."
)


def _india_notes(jurisdiction: str) -> str:
    if "india" not in jurisdiction.lower():
        return ""
    return (
        "Draft under Indian law: the Indian Contract Act, 1872 applies; name the governing law as the "
        "laws of India and courts of a named city; use the Arbitration and Conciliation Act, 1996 for "
        "arbitration with a mutually appointed arbitrator; express money in INR; note that the document "
        "may need stamping under the applicable State Stamp Act; for employment, respect the Code on "
        "Wages and do not include post-employment non-competes (void under Section 27). "
    )


async def draft_document(
    llm, *, provider: str, model: str, system: str, document_type: str, requirements: str,
    jurisdiction: str, additional_clauses: list[str] | None = None,
) -> str:
    """A complete, plain-text document. Raises on a failed draft so the caller can report it."""
    prompt = (
        f"Draft a complete, professional {document_type}.\n\n"
        f"DETAILS FROM THE USER:\n{requirements}\n\n"
        f"JURISDICTION: {jurisdiction}\n"
        f"ALSO INCLUDE: {', '.join(additional_clauses) if additional_clauses else 'nothing extra'}\n\n"
        f"{_india_notes(jurisdiction)}{_FORMAT_GUIDE}\n\n"
        "Rules: write complete, substantive clauses, not stubs. Use [SQUARE BRACKETS] only for details "
        "the user has not given (names, addresses, amounts, dates). Plain text only — no markdown, no "
        "asterisks, no # headings. Output only the document, with no introduction or closing comment."
    )
    messages = [{"role": "user", "content": prompt}]
    raw = await llm.complete(provider=provider, model=model, system=system, messages=messages, max_tokens=DRAFT_BUDGET)
    if not (raw or "").strip():
        logger.warning("draft came back empty — retrying with a larger budget | type=%s", document_type)
        raw = await llm.complete(provider=provider, model=model, system=system, messages=messages, max_tokens=DRAFT_BUDGET * 2)
    document = strip_markdown(raw or "")
    if not document:
        raise ValueError("the draft came back empty")
    return document


# ── Reply to the counterparty ────────────────────────────────────────────────


async def draft_reply(
    llm, *, provider: str, model: str, system: str, analysis: dict, sender: str, tone: str = "firm but friendly",
) -> dict:
    """An email to the counterparty and a clause-by-clause change list, built from a review."""
    issues = [i for i in analysis.get("issues") or [] if isinstance(i, dict) and _text(i.get("send_back"))]
    if not issues:
        raise ValueError("the review has no proposed changes to send")
    issue_block = "\n".join(
        f"- [{i.get('severity')}] {i.get('title')} (section {i.get('section') or 'n/a'})\n"
        f"  Current: {i.get('quote') or 'not addressed'}\n  Proposed: {i.get('send_back')}\n  Why: {i.get('what_it_means')}"
        for i in issues[:10]
    )
    counterparty = _text(analysis.get("counterparty"), "the other party")
    data = await llm.complete_json(
        provider=provider, model=model, system=system,
        messages=[{"role": "user", "content": (
            f"Write the reply that {_text(analysis.get('perspective'), 'our side')} sends to {counterparty} about "
            f"the {_text(analysis.get('document_type'), 'contract')}. Sender: {sender or 'our team'}. Tone: {tone}.\n\n"
            f"CHANGES WE WANT:\n{issue_block}\n\n"
            "The email should be short (under 200 words), appreciative of the deal, list the requested changes as "
            "brief numbered points by section, and propose a quick call. Business-like, not legalistic.\n\n"
            "Return ONLY a JSON object with:\n"
            "subject: email subject line.\n"
            "email: the email body as plain text with line breaks.\n"
            "changes: one object per change {section, current (exact current wording or 'Not addressed'), "
            "proposed (replacement wording), reason (one plain sentence)}, most important first."
        )}],
        max_tokens=JSON_BUDGET,
    )
    changes = []
    for c in data.get("changes") or []:
        if isinstance(c, dict) and _text(c.get("proposed")):
            changes.append({
                "section": _text(c.get("section")), "current": _text(c.get("current"), "Not addressed"),
                "proposed": _text(c.get("proposed")), "reason": _text(c.get("reason")),
            })
    email = strip_markdown(str(data.get("email") or ""))
    if not email:
        raise ValueError("the reply came back empty")
    return {"subject": _text(data.get("subject"), f"Proposed changes to the {analysis.get('document_type', 'contract')}"),
            "email": email, "changes": changes, "counterparty": counterparty}


def changes_document(reply: dict, document_type: str) -> str:
    """A plain-text schedule of proposed changes, ready for the DOCX/PDF exporter."""
    lines = [f"PROPOSED CHANGES — {document_type.upper()}", ""]
    for n, c in enumerate(reply.get("changes") or [], start=1):
        section = f"Clause {c['section']}" if c.get("section") else "New clause"
        lines += [
            f"{n}. {section}",
            f"Current wording: {c['current']}",
            f"Proposed wording: {c['proposed']}",
        ]
        if c.get("reason"):
            lines.append(f"Reason: {c['reason']}")
        lines.append("")
    return "\n".join(lines).strip()

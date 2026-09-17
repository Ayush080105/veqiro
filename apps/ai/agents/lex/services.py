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


async def org_preferences(organization_id: str) -> list[dict]:
    """The company's saved legal preferences ({key, label, value}) from the server. Chat-run
    reviews use these so they flag the same departures as reviews run from the card."""
    from core.config import settings

    if not organization_id or settings.MOCK_MODE or not settings.INTERNAL_API_KEY:
        return []
    try:
        import httpx

        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.BRAND_KIT_SERVICE_URL}/api/v1/internal/lex/preferences/{organization_id}",
                headers={"x-internal-key": settings.INTERNAL_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
        return [p for p in data if isinstance(p, dict) and p.get("value")] if isinstance(data, list) else []
    except Exception as err:
        logger.warning("legal preferences unavailable | org=%s error=%s", organization_id, err)
        return []


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
                "found: true only if the passages actually answer the question, else false.\n"
                "short_answer: the answer in at most 6 words, e.g. '30 days' or 'Yes, capped at ₹10 lakh'; "
                "'' if not found.\n"
                "answer: 1-3 plain sentences explaining it, naming the section. If not found, say exactly "
                "'I couldn't find <the thing asked about> in this document.' and nothing invented.\n"
                "citations: up to 3 objects {section: section number or '', quote: exact words from the "
                "passages, at most 30 words} that support the answer; [] if not found."
            )}],
            max_tokens=JSON_BUDGET,
        )
        citations = []
        for c in data.get("citations") or []:
            if isinstance(c, dict) and _text(c.get("quote")):
                citations.append({"section": _text(c.get("section")), "quote": _text(c.get("quote")).strip("\"“”")})
        found = bool(data.get("found")) and bool(_text(data.get("answer"))) and bool(citations)
        return {
            "answer": _text(data.get("answer")) or "I couldn't find that in this document.",
            "short_answer": _text(data.get("short_answer")) if found else "",
            "found": found,
            "citations": citations[:3] if found else [],
        }
    except Exception as err:
        logger.error("document answer failed | error=%s: %s", type(err).__name__, str(err)[:300])
        return {"answer": "Lex couldn't answer that just now — try asking again.", "short_answer": "", "found": False, "citations": []}


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


_CASE_LAW_HOSTS = ("indiankanoon.org", "scconline.com", "casemine.com", "main.sci.gov.in", "sci.gov.in",
                   "judis.nic.in", "ecourts.gov.in", "courtlistener.com", "bailii.org", "curia.europa.eu")
_STATUTE_HOSTS = ("indiacode.nic.in", "legislative.gov.in", "egazette.gov.in", "egazette.nic.in",
                  "legislation.gov.uk", "eur-lex.europa.eu", "law.cornell.edu/uscode")
_GOVERNMENT_SUFFIXES = (".gov.in", ".nic.in", ".gov", ".gov.uk", ".europa.eu", ".gc.ca", ".gov.au")


def source_kind(url: str) -> str:
    """Classify a source by its host, so answers can separate law from commentary."""
    from urllib.parse import urlparse

    parsed = urlparse(url or "")
    host = (parsed.netloc or "").lower().removeprefix("www.")
    full = host + (parsed.path or "")
    if any(h in full for h in _CASE_LAW_HOSTS):
        return "case_law"
    if any(h in full for h in _STATUTE_HOSTS):
        return "statute"
    if host.endswith(_GOVERNMENT_SUFFIXES) or any(host == s.lstrip(".") for s in _GOVERNMENT_SUFFIXES):
        return "government_guidance"
    return "commentary"


async def _search(query: str, jurisdiction: str) -> list[dict]:
    from agents.scout.scraper import serper_search

    # Search engines drop long OR-chains of site: operators, which left every result as
    # commentary; one plain query per official domain family actually returns them.
    queries = [f"{query} {jurisdiction}".strip()]
    if "india" in jurisdiction.lower():
        queries += [f"{query} site:gov.in", f"{query} site:indiacode.nic.in", f"{query} site:indiankanoon.org"]
    else:
        queries.append(f"{query} {jurisdiction} official government guidance")
    batches = await asyncio.gather(*[serper_search(q) for q in queries], return_exceptions=True)
    seen, results = set(), []
    for batch in batches:
        if isinstance(batch, BaseException):
            continue
        for r in batch:
            link = r.get("link", "")
            if not link or link in seen or not r.get("snippet") or any(h in link for h in _LOW_VALUE_HOSTS):
                continue
            seen.add(link)
            results.append(r)
    # Primary sources first, so they survive the cap and anchor the answer.
    rank = {"statute": 0, "government_guidance": 1, "case_law": 2, "commentary": 3}
    results.sort(key=lambda r: rank[source_kind(r.get("link", ""))])
    return results[:8]


_LOW_VALUE_HOSTS = ("youtube.com", "youtu.be", "facebook.com", "instagram.com", "quora.com", "reddit.com", "linkedin.com/posts")


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
    if not sources:
        # The spec is explicit: when current sources can't be found, say so rather than answer
        # from model memory, which is where fabricated fees, forms and case names come from.
        logger.warning("research found no sources | jurisdiction=%s", jurisdiction)
        return {
            "answer": (
                "I couldn't find current sources to verify an answer to this, so I'm not going to "
                "guess. Try rephrasing the question, or check the relevant government portal directly."
            ),
            "sections": [], "references": [], "relevant_cases": [], "jurisdiction_notes": "",
            "confidence_level": "low", "jurisdiction": jurisdiction, "sources": [], "failed": True,
        }
    for s in sources:
        s["kind"] = source_kind(s.get("link", ""))
    source_block = "\n\n".join(
        f"[{i + 1}] ({s['kind'].replace('_', ' ')}{', ' + s['date'] if s.get('date') else ''}) {s.get('title', '')}\n"
        f"{s.get('link', '')}\n{s.get('snippet', '')}"
        for i, s in enumerate(sources)
    )
    try:
        data = await llm.complete_json(
            provider=provider, model=model, system=system,
            messages=[{"role": "user", "content": (
                f"QUESTION: {query}\nJURISDICTION: {jurisdiction}\n"
                + (f"AREAS: {', '.join(legal_areas)}\n" if legal_areas else "")
                + f"\nCURRENT WEB SOURCES:\n{source_block}\n\n"
                "Answer for a founder who is not a lawyer. Each source is labelled statute, case law, "
                "government guidance or commentary — say which kind you rely on, prefer statute and "
                "government guidance over commentary, and cite sources as [n]. For anything that changes "
                "over time (fees, forms, thresholds, deadlines) use only the sources and mention how current "
                "they are when a date is shown. If the sources don't cover a point, say you couldn't verify "
                "it instead of filling the gap. Never invent case names, section numbers, fees or form numbers. "
                "This is legal information, not legal advice.\n\n"
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
            "confidence_level": _confidence(data.get("confidence_level")),
            "jurisdiction": jurisdiction,
            "sources": [
                {"title": _text(s.get("title")), "url": s.get("link", ""), "kind": s["kind"], "date": _text(s.get("date"))}
                for s in sources
            ],
        }
    except Exception as err:
        logger.error("research failed | jurisdiction=%s error=%s: %s", jurisdiction, type(err).__name__, str(err)[:300])
        return {
            "answer": "Lex couldn't complete this research just now — try asking again.",
            "sections": [], "references": [], "relevant_cases": [], "jurisdiction_notes": "",
            "confidence_level": "low", "jurisdiction": jurisdiction, "sources": [],
            "failed": True,
        }


# ── Version comparison ───────────────────────────────────────────────────────

_COMPARE_CHARS = 60000


async def compare_versions(
    llm, *, provider: str, model: str, previous_text: str, current_text: str,
    perspective: str = "", preferences: list[dict] | None = None,
) -> dict:
    """The material changes between two versions of a contract. Never raises."""
    prefs = [p for p in (preferences or []) if p.get("value")]
    pref_block = (
        "\nThe company's usual positions:\n" + "\n".join(f"- {p.get('label') or p.get('key')}: {p['value']}" for p in prefs) + "\n"
        if prefs else ""
    )
    try:
        data = await llm.complete_json(
            provider=provider, model=model,
            system="You compare contract versions for a founder who is not a lawyer. Only report differences that are actually in the text.",
            messages=[{"role": "user", "content": (
                f"Compare these two versions of the same contract{' for ' + perspective if perspective else ''}.{pref_block}\n"
                f"PREVIOUS VERSION:\n{previous_text[:_COMPARE_CHARS]}\n\n"
                f"NEW VERSION:\n{current_text[:_COMPARE_CHARS]}\n\n"
                "Report only material changes to rights, money, dates, liability, termination, disputes, IP, "
                "confidentiality or obligations — ignore formatting and renumbering. Return ONLY a JSON object with:\n"
                "summary: at most 2 sentences on what the new version changes overall, for you.\n"
                "changes: up to 12 objects, most severe first, each {topic (at most 4 words), section, "
                "before (the old position, at most 12 words), after (the new position, at most 12 words), "
                "severity (critical / high / medium / low — how much worse or better for you), "
                "why_it_matters (at most 30 words), suggested_response (at most 40 words)}. "
                "If nothing material changed, return an empty list."
            )}],
            max_tokens=JSON_BUDGET,
        )
        changes = []
        for c in data.get("changes") or []:
            if isinstance(c, dict) and _text(c.get("topic")):
                sev = _text(c.get("severity")).lower()
                changes.append({
                    "topic": _text(c.get("topic")), "section": _text(c.get("section")),
                    "before": _text(c.get("before")), "after": _text(c.get("after")),
                    "severity": sev if sev in ("critical", "high", "medium", "low") else "medium",
                    "why_it_matters": _text(c.get("why_it_matters")),
                    "suggested_response": _text(c.get("suggested_response")),
                })
        rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        changes.sort(key=lambda c: rank[c["severity"]])
        return {
            "summary": _text(data.get("summary")) or ("No material changes found." if not changes else ""),
            "changes": changes[:12],
            "failed": False,
        }
    except Exception as err:
        logger.error("version comparison failed | error=%s: %s", type(err).__name__, str(err)[:300])
        return {"summary": "Lex couldn't compare these versions just now — try again.", "changes": [], "failed": True}


# ── Compliance ───────────────────────────────────────────────────────────────


async def compliance(
    llm, *, provider: str, model: str, system: str, description: str, frameworks: list[str],
    business_context: str, jurisdiction: str,
) -> dict:
    chosen = [f for f in frameworks if _text(f)]
    framework_line = (
        f"Check against: {', '.join(chosen)}."
        if chosen else
        f"Work out which laws apply from the business type, geography, data handling and industry described, "
        f"for {jurisdiction}. For India, consider {'; '.join(INDIA_FRAMEWORKS)}, and GST, FSSAI or RBI rules "
        "only where the facts point to them; GDPR/CCPA only if they serve EU/California users. Do not say a "
        "law applies unless the facts given support it — if a fact needed to decide is missing, say what you'd "
        "need to know. Check against the laws that apply."
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

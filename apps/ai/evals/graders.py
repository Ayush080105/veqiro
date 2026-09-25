"""Graders. Each one answers a question a customer would ask of the output, and is filed under the
kind of friction a failure causes:

  works    — did I get an answer, fast enough?
  renders  — does the card have something in it, or is it blank?
  usable   — can I post/send/use this as-is, or must I fix it first?
  honest   — did it make up numbers, facts or quotes?
  correct  — is the answer right?
  helpful  — did it do what I asked, in my voice, without bouncing questions back?

Code graders come first and do most of the work: they are cheap, deterministic, and explain
themselves. The LLM judge is for what code cannot see (voice, whether a question was bounced
back), and every one of its criteria is written so two people would agree on the verdict.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Callable

WORKS, RENDERS, USABLE, HONEST, CORRECT, HELPFUL = (
    "works", "renders", "usable", "honest", "correct", "helpful",
)


@dataclass
class Grade:
    name: str
    category: str
    passed: bool
    detail: str = ""


@dataclass
class Trial:
    """What one attempt produced, as the grader sees it."""
    case: Any
    request: dict
    status: int
    body: Any          # parsed JSON, or the raw text if it was not JSON
    latency_s: float


# ── Reading the response ─────────────────────────────────────────────────────

def get(body: Any, path: str) -> Any:
    """`draft.body`, `ideas.0.hook`, `ideas.*.hook` (a list), or "" for the whole body."""
    if not path:
        return body
    cur: Any = body
    parts = path.split(".")
    for i, part in enumerate(parts):
        if part == "*":
            rest = ".".join(parts[i + 1:])
            return [get(item, rest) for item in (cur or [])]
        if isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def text_of(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


_MULT = {"lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "crore": 1e7, "crores": 1e7, "cr": 1e7,
         "k": 1e3, "mn": 1e6, "million": 1e6}
_NUM = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lac|crores?|cr|k|mn|million)?\b", re.I)


def numbers_in(text: str) -> list[float]:
    """Every number in the text, reading ₹1,78,319 / 1.78 lakh / 178k all as 178,000-ish."""
    out = []
    for raw, unit in _NUM.findall(text or ""):
        try:
            n = float(raw.replace(",", ""))
        except ValueError:
            continue
        out.append(n * _MULT.get(unit.lower(), 1) if unit else n)
    return out


def _close(a: float, b: float, tol_pct: float) -> bool:
    return abs(a - b) <= abs(b) * tol_pct / 100 + 1e-9


# ── Code graders ─────────────────────────────────────────────────────────────

def http_ok() -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        ok = t.status == 200
        return Grade("responds", WORKS, ok, "" if ok else f"HTTP {t.status}: {text_of(t.body)[:300]}")
    return g


def within(seconds: float) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        ok = t.latency_s <= seconds
        return Grade(f"under {seconds:.0f}s", WORKS, ok, f"took {t.latency_s:.1f}s")
    return g


def nonempty(*paths: str) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        empty = [p for p in paths if not str(text_of(get(t.body, p))).strip() or get(t.body, p) in ([], {})]
        return Grade("card has content", RENDERS, not empty, f"empty: {empty}" if empty else "")
    return g


def count(path: str, lo: int, hi: int | None = None, category: str = CORRECT) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        v = get(t.body, path)
        n = len(v) if isinstance(v, list) else 0
        ok = n >= lo and (hi is None or n <= hi)
        want = f"{lo}" if hi == lo else f"{lo}-{hi if hi is not None else '∞'}"
        return Grade(f"{path} count {want}", category, ok, f"got {n}")
    return g


def max_chars(path: str, limit: int, why: str) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        n = len(text_of(get(t.body, path)))
        return Grade(f"fits {why}", USABLE, n <= limit, f"{n}/{limit} chars")
    return g


_PLACEHOLDER = re.compile(
    r"\[(?:your|insert|company|client|recipient|name|date|link|url|x+|add|enter|product)[^\]]{0,40}\]"
    r"|\{\{[^}]*\}\}|<(?:your|insert)[^>]*>|\bTODO\b|lorem ipsum|\bXX+%?", re.I)


def no_placeholders(*paths: str) -> Callable[[Trial], Grade]:
    """A `[Your Name]` left in the text means the customer has to edit before sending."""
    def g(t: Trial) -> Grade:
        hits = []
        for p in paths:
            hits += _PLACEHOLDER.findall(text_of(get(t.body, p)))
        return Grade("no fill-in-the-blanks", USABLE, not hits, f"found {hits[:5]}" if hits else "")
    return g


_MARKDOWN = re.compile(r"\*\*[^*]+\*\*|^#{1,6}\s|__[^_]+__|^\s*[-*]\s\*\*", re.M)


def no_markdown(path: str, where: str) -> Callable[[Trial], Grade]:
    """LinkedIn/Instagram/email show `**bold**` as literal asterisks."""
    def g(t: Trial) -> Grade:
        hits = _MARKDOWN.findall(text_of(get(t.body, path)))
        return Grade(f"no markdown ({where} shows it raw)", USABLE, not hits,
                     f"found {hits[:3]}" if hits else "")
    return g


def mentions(path: str, *any_of: str, category: str = CORRECT, name: str | None = None) -> Callable[[Trial], Grade]:
    """Passes if the text contains any of the strings (case-insensitive) or regexes (prefix `re:`)."""
    def g(t: Trial) -> Grade:
        text = text_of(get(t.body, path))
        for want in any_of:
            if want.startswith("re:"):
                if re.search(want[3:], text, re.I | re.S):
                    return Grade(name or f"mentions {any_of}", category, True)
            elif want.lower() in text.lower():
                return Grade(name or f"mentions {any_of}", category, True)
        return Grade(name or f"mentions {any_of}", category, False, f"not in: {text[:240]!r}")
    return g


def answers_first(path: str, expected: str, *options: str) -> Callable[[Trial], Grade]:
    """Of several candidates, the expected one is named first — the answer, not a mention in
    passing ('Delhi has the most… Mumbai has ₹1,299' names Delhi, and fails)."""
    def g(t: Trial) -> Grade:
        text = text_of(get(t.body, path)).lower()
        found = sorted((text.find(o.lower()), o) for o in options if o.lower() in text)
        first = found[0][1] if found else None
        return Grade(f"answers {expected}", CORRECT, first == expected, f"named first: {first}")
    return g


def avoids(path: str, *patterns: str, category: str, name: str) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        text = text_of(get(t.body, path))
        hits = [p for p in patterns if re.search(p, text, re.I)]
        return Grade(name, category, not hits, f"matched {hits}" if hits else "")
    return g


def number(path: str, expected: float, tol_pct: float = 1.0, name: str | None = None) -> Callable[[Trial], Grade]:
    """Some number in the text matches the expected value (any formatting, lakh/crore aware)."""
    def g(t: Trial) -> Grade:
        v = get(t.body, path)
        nums = [float(v)] if isinstance(v, (int, float)) else numbers_in(text_of(v))
        ok = any(_close(n, expected, tol_pct) for n in nums)
        return Grade(name or f"states {expected:g}", CORRECT, ok,
                     "" if ok else f"numbers found: {nums[:12]}")
    return g


def one_of(path: str, *allowed: str, category: str = CORRECT) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        v = str(get(t.body, path) or "").strip().lower()
        ok = v in {a.lower() for a in allowed}
        return Grade(f"{path} in {allowed}", category, ok, f"got {v!r}")
    return g


def is_true(path: str, expect: bool = True, category: str = CORRECT, name: str | None = None) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        v = get(t.body, path)
        return Grade(name or f"{path} is {expect}", category, v is expect, f"got {v!r}")
    return g


def distinct(path: str) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        items = [str(x).strip().lower() for x in (get(t.body, path) or [])]
        ok = len(items) == len(set(items))
        return Grade("no repeated ideas", HELPFUL, ok, "" if ok else f"repeats in {items}")
    return g


def shorter_than(path: str, original: str, ratio: float = 0.8) -> Callable[[Trial], Grade]:
    def g(t: Trial) -> Grade:
        n, o = len(text_of(get(t.body, path))), len(original)
        return Grade(f"at most {int(ratio * 100)}% of original length", CORRECT, n <= o * ratio, f"{n} vs {o}")
    return g


def _derived(source: list[float]) -> set[float]:
    """Numbers an honest writer may compute from the facts: differences, ratios, % changes."""
    src = [n for n in source if n][:25]
    out = set()
    for a in src:
        for b in src:
            if a != b:
                out |= {round(b - a, 2), round(b / a, 2), round((b - a) / a * 100, 1)}
    return out


def grounded_numbers(path: str, source: str, allow: tuple[float, ...] = ()) -> Callable[[Trial], Grade]:
    """Every figure in the output traces back to the facts given (or is simple math on them).
    Small counts and years are ignored: they are rarely where invented claims live."""
    src = numbers_in(source)
    ok_set = set(src) | _derived(src) | set(allow)

    def traced(n: float) -> bool:
        return any(_close(n, s, 1.5) or abs(n - s) < 0.6 for s in ok_set)

    def g(t: Trial) -> Grade:
        nums = numbers_in(text_of(get(t.body, path)))
        suspect = [n for n in nums if n >= 10 and not (1990 <= n <= 2035) and not traced(n)]
        return Grade("no invented numbers", HONEST, not suspect,
                     f"not in the brief: {suspect[:8]}" if suspect else "")
    return g


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[\"'“”‘’]", "", s)).strip().lower()


def quotes_exist(path: str, source: str) -> Callable[[Trial], Grade]:
    """Each quote the answer cites must actually be in the document."""
    doc = _norm(source)

    def g(t: Trial) -> Grade:
        quotes = [q for q in (get(t.body, path) or []) if isinstance(q, str) and q.strip()]
        fake = [q for q in quotes if _norm(q).rstrip(".") not in doc]
        return Grade("quotes are real", HONEST, not fake, f"not in document: {fake[:2]}" if fake else "")
    return g


# ── LLM judge ────────────────────────────────────────────────────────────────

JUDGE_MODEL = os.environ.get("EVAL_JUDGE_MODEL", "gemini-3.1-pro-preview")

_JUDGE_PROMPT = """\
You are checking work an AI employee did for a real customer of a SaaS product. Be strict and
literal: a criterion passes only if it is clearly met. If unsure, it fails.

Who the customer is and what they need:
{story}

What the agent already knew about the customer's business (their saved brand kit — facts from
here are NOT invented):
{brand}

What the customer sent:
{request}

What the customer got back:
{response}

For each criterion below, decide pass or fail and give a one-sentence reason quoting the output
where you can.
{criteria}

Return JSON: {{"results": [{{"criterion": "<copy the criterion>", "pass": true|false, "reason": "..."}}]}}
"""


def judge(*criteria: str, category: str = HELPFUL, path: str = "") -> Callable[[Trial], Any]:
    """One grade per criterion. Written as yes/no checks, not scores, so they are reproducible."""
    async def g(t: Trial) -> list[Grade]:
        from google import genai
        from google.genai import types
        from core.config import settings

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        from evals.personas import BRAND_KITS

        kit = BRAND_KITS.get((t.request or {}).get("organization_id", ""))
        brand = kit.model_dump_json(include={
            "company_name", "company_description", "value_proposition", "target_audience",
            "brand_voice", "key_differentiators", "website_url", "location"}) if kit else "(none)"
        prompt = _JUDGE_PROMPT.format(
            story=t.case.story,
            brand=brand,
            request=text_of(t.request)[:6000],
            response=text_of(get(t.body, path))[:9000],
            criteria="\n".join(f"{i + 1}. {c}" for i, c in enumerate(criteria)),
        )
        last_err = None
        for _ in range(3):
            try:
                resp = await client.aio.models.generate_content(
                    model=JUDGE_MODEL, contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0, response_mime_type="application/json"),
                )
                results = json.loads(resp.text)["results"]
                grades = []
                for i, c in enumerate(criteria):
                    r = results[i] if i < len(results) else {"pass": False, "reason": "judge skipped it"}
                    grades.append(Grade(f"judge: {c}", category, bool(r.get("pass")), r.get("reason", "")))
                return grades
            except Exception as err:  # retry transient judge failures; never pass on error
                last_err = err
        return [Grade(f"judge: {c}", category, False, f"judge error: {last_err}") for c in criteria]
    return g

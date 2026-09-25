"""Answer questions about an uploaded dataset by running SQL over all of it, not reading a sample.

The old query-dataset put the first 25 rows in the prompt, so totals, counts and rankings were
read off a sample — on a 320-row orders file it named the wrong top city. Here the model writes one
read-only SELECT, DuckDB runs it over every row of the uploaded file (up to 50 MB; the stored
500-row preview when the file can't be read), and the model explains the result.

Safety: each request gets its own in-memory DuckDB with external access disabled (no files, no
network, no extensions), a memory cap, and a locked configuration; the SQL must be a single
SELECT/WITH with no statement or table function that reaches outside the data; and it runs with a
timeout. Evals: rex.orders.* in apps/ai/evals.
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger("agents")

MAX_RESULT_ROWS = 200
QUERY_TIMEOUT_S = 10
_NULLS = {"", "n/a", "na", "null", "none", "-", "—", "nan"}


# ── Loading ──────────────────────────────────────────────────────────────────

def parse_number(raw) -> float | None:
    """'₹1,23,450', '$1,200.50', '12%', '(300)', '1299' → float. Same intent as the server's
    parseNumeric: strip currency, grouping and percent signs."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip()
    if s.lower() in _NULLS:
        return None
    negative = s.startswith("(") and s.endswith(")")
    s = re.sub(r"[₹$€£¥%\s()]|^rs\.?|inr", "", s, flags=re.I).replace(",", "")
    try:
        n = float(s)
    except ValueError:
        return None
    return -n if negative else n


_SLASH_DATE = r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b"


def parse_dates(col):
    """ISO dates (2026-01-11) are read strictly as year-month-day — a blanket dayfirst pass
    flipped 2026-01-11 into 1 November. Slash dates take their order from the column: any
    first part over 12 (25/06) means day-first, any second part over 12 (06/25) means
    month-first, and a column where every date is ambiguous is read day-first, as Indian
    exports write them. 'Jan-25' month labels read as January 2025."""
    import pandas as pd

    text = col.astype("string").str.strip()
    iso = text.str.match(r"^\d{4}-\d{1,2}-\d{1,2}", na=False)
    out = pd.to_datetime(text.where(iso), errors="coerce", format="ISO8601")
    month = ~iso & text.str.match(r"^[A-Za-z]{3,9}[-\s']\d{2}(\d{2})?$", na=False)
    if month.any():
        norm = text[month].str.replace(r"[\s']", "-", regex=True).str.title()
        out[month] = pd.to_datetime(
            norm.str[:3] + "-" + norm.str.split("-").str[-1].str[-2:], errors="coerce", format="%b-%y")
    rest = ~iso & ~month & text.notna()
    if rest.any():
        parts = text[rest].str.extract(_SLASH_DATE).astype("float")
        month_first = bool((parts[1] > 12).any()) and not bool((parts[0] > 12).any())
        out[rest] = pd.to_datetime(text[rest], errors="coerce", format="mixed", dayfirst=not month_first)
    return out.where(out.dt.year >= 1900)


def _is_blank(v) -> bool:
    return v is None or (isinstance(v, float) and v != v) or str(v).strip().lower() in _NULLS


def _typed(df, types: dict[str, str]):
    """Clean a frame of raw cells into typed columns. Blanks don't count against a column: it
    is typed if 80% of its filled cells parse, and kept as text otherwise."""
    import pandas as pd

    for h in df.columns:
        kind = types.get(h, "text")
        col = df[h]
        blank = col.map(_is_blank).astype(bool)
        filled = int((~blank).sum())
        if kind == "numeric":
            parsed = col.map(parse_number)
            if filled and parsed.notna().sum() >= 0.8 * filled:
                df[h] = pd.to_numeric(parsed, errors="coerce")
                continue
        elif kind == "date":
            parsed = parse_dates(col.where(~blank, None))
            if filled and parsed.notna().sum() >= 0.8 * filled:
                df[h] = parsed.dt.date
                continue
        df[h] = col.where(~blank, None).map(lambda v: None if v is None else str(v).strip())
    return df


def _preview_frame(sheet: dict):
    import pandas as pd

    headers = sheet.get("headers") or []
    rows = sheet.get("rows") or []
    df = pd.DataFrame([{h: r.get(h) for h in headers} for r in rows], columns=headers)
    return _typed(df, sheet.get("columnTypes") or {})


def _table_name(sheet_name: str, used: set[str]) -> str:
    base = re.sub(r"[^a-z0-9_]", "_", sheet_name.lower()).strip("_") or "sheet"
    if base[0].isdigit():
        base = "t_" + base
    name, i = base, 2
    while name in used:
        name, i = f"{base}_{i}", i + 1
    used.add(name)
    return name


@dataclass
class LoadedDataset:
    con: object
    tables: dict[str, str]   # table name → original sheet name
    schema_text: str
    total_rows: int
    whole_file: bool = False  # every row of the upload, not the stored preview


def _build(frames: dict[str, object], whole_file: bool) -> LoadedDataset:
    """One private DuckDB per request. A single sheet becomes table `data`."""
    import duckdb

    con = duckdb.connect(":memory:", config={"memory_limit": "1GB", "threads": 2})
    used: set[str] = set()
    tables: dict[str, str] = {}
    total = 0
    for sheet_name, df in frames.items():
        name = "data" if len(frames) == 1 else _table_name(sheet_name, used)
        con.register("_incoming", df)
        con.execute(f'CREATE TABLE "{name}" AS SELECT * FROM _incoming')
        con.unregister("_incoming")
        tables[name] = sheet_name
        total += len(df)
    # Lock it down only after loading: from here the SQL sees these tables and nothing else.
    con.execute("SET enable_external_access = false")
    con.execute("SET lock_configuration = true")
    return LoadedDataset(con=con, tables=tables, schema_text=_describe(con, tables),
                         total_rows=total, whole_file=whole_file)


def load(table: dict) -> LoadedDataset:
    """From the rows the server sent (the stored preview)."""
    sheets = table.get("sheets") or {"Dataset": table}
    return _build({name: _preview_frame(sheet) for name, sheet in sheets.items()}, whole_file=False)


# ── The whole upload ─────────────────────────────────────────────────────────
#
# The server stores only a preview of each upload (its first 500 rows) and sends a short-lived
# link to the original file. Reading it here means every row is counted. The preview says which
# columns exist and what type each is, so the file is read into exactly those columns.

MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_ROWS_PER_SHEET = 1_000_000
FILE_LOAD_TIMEOUT_S = 90


class FileUnusable(ValueError):
    """The upload can't be matched to its preview; answer from the preview instead."""


async def fetch_file(url: str) -> bytes:
    import httpx

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            declared = int(resp.headers.get("content-length") or 0)
            if declared > MAX_FILE_BYTES:
                raise FileUnusable(f"file is {declared // 2**20} MB; the limit is {MAX_FILE_BYTES // 2**20} MB")
            chunks, size = [], 0
            async for chunk in resp.aiter_bytes():
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    raise FileUnusable(f"file is over {MAX_FILE_BYTES // 2**20} MB")
                chunks.append(chunk)
    return b"".join(chunks)


async def fetch_dataset(organization_id: str, dataset_id: str) -> dict | None:
    """One of the org's datasets, as query-dataset needs it: {name, table, file_url?, file_name?}.
    Rex's chat uses this so a question typed into chat is answered from the file, like Ask REX."""
    import httpx

    from core.config import settings

    url = f"{settings.BRAND_KIT_SERVICE_URL}/api/v1/internal/rex/datasets/{organization_id}/{dataset_id}"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers={"x-internal-key": settings.INTERNAL_API_KEY})
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def _grids(data: bytes, file_name: str) -> dict[str, object]:
    """Every sheet as a grid of raw text cells, no header assumed."""
    import io

    import pandas as pd

    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext in ("csv", "tsv", "txt"):
        text = data.decode("utf-8-sig", errors="replace")
        if "�" in text:  # Excel "Save as CSV" on Windows writes cp1252
            text = data.decode("latin-1")
        sep = "\t" if ext == "tsv" else ","
        grid = pd.read_csv(io.StringIO(text), sep=sep, header=None, dtype=str,
                           keep_default_na=False, skip_blank_lines=True, on_bad_lines="skip")
        return {"Dataset": grid}
    if ext in ("xlsx", "xlsm", "xls"):
        return pd.read_excel(io.BytesIO(data), sheet_name=None, header=None, dtype=str,
                             engine="xlrd" if ext == "xls" else "openpyxl")
    raise FileUnusable(f"unsupported file type .{ext}")


def _match(grid, sheet: dict):
    """Find the preview's header row in the raw grid and cut the grid to those columns."""
    headers = [h for h in (sheet.get("headers") or []) if h]
    if not headers:
        raise FileUnusable("preview has no columns")
    for i in range(min(25, len(grid))):
        cells = [("" if _is_blank(v) else str(v).strip()) for v in grid.iloc[i].tolist()]
        positions: dict[str, int] = {}
        for h in headers:
            j = next((k for k, c in enumerate(cells) if c == h.strip() and k not in positions.values()), None)
            if j is not None:
                positions[h] = j
        if len(positions) >= max(1, 0.8 * len(headers)):
            body = grid.iloc[i + 1:, list(positions.values())].copy()
            body.columns = list(positions)
            body = body[~body.map(_is_blank).all(axis=1)]
            return body.head(MAX_ROWS_PER_SHEET).reset_index(drop=True)
    raise FileUnusable("could not find the header row the preview was read from")


def load_file(data: bytes, file_name: str, table: dict) -> LoadedDataset:
    """Every row of the upload, typed by the preview. Raises FileUnusable when the file and its
    preview don't line up, so the caller can fall back to the preview."""
    grids = _grids(data, file_name)
    preview_sheets = table.get("sheets") or {"Dataset": table}
    frames: dict[str, object] = {}
    for name, sheet in preview_sheets.items():
        if name in grids:
            candidates = [grids[name]]
        elif len(preview_sheets) == 1:
            candidates = list(grids.values())  # the server picked its best sheet; find it
        else:
            raise FileUnusable(f"sheet '{name}' is not in the file")
        for grid in candidates:
            try:
                frames[name] = _typed(_match(grid, sheet), sheet.get("columnTypes") or {})
                break
            except FileUnusable:
                continue
        if name not in frames:
            raise FileUnusable(f"no sheet matches the columns of '{name}'")
    return _build(frames, whole_file=True)


def _describe(con, tables: dict[str, str]) -> str:
    """Schema the model writes SQL against: columns, types, ranges, the values of low-cardinality
    columns (so it filters on 'Delivered', not 'delivered'), and a few rows."""
    parts = []
    for name, sheet in tables.items():
        rows = con.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]
        cols = con.execute(f"SELECT column_name, data_type FROM information_schema.columns "
                           f"WHERE table_name = '{name}' ORDER BY ordinal_position").fetchall()
        lines = [f'TABLE "{name}"' + (f" (sheet '{sheet}')" if sheet != "Dataset" else "") + f" — {rows} rows"]
        for col, dtype in cols:
            q = '"' + col.replace('"', '""') + '"'
            detail = ""
            if dtype in ("DOUBLE", "BIGINT", "INTEGER", "DATE", "TIMESTAMP"):
                lo, hi = con.execute(f'SELECT min({q}), max({q}) FROM "{name}"').fetchone()
                detail = f" range {lo} → {hi}"
            else:
                n = con.execute(f'SELECT count(DISTINCT {q}) FROM "{name}"').fetchone()[0]
                if n <= 25:
                    vals = [v for (v,) in con.execute(
                        f'SELECT DISTINCT {q} FROM "{name}" WHERE {q} IS NOT NULL ORDER BY 1').fetchall()]
                    detail = f" values {vals}"
                else:
                    detail = f" {n} distinct values"
            lines.append(f"  {q} {dtype}{detail}")
        sample = con.execute(f'SELECT * FROM "{name}" LIMIT 3').fetchall()
        lines.append("  sample rows: " + "; ".join(str(r) for r in sample))
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


# ── Running model-written SQL ────────────────────────────────────────────────

_FORBIDDEN = re.compile(
    r"\b(attach|detach|copy|install|load|pragma|create|insert|update|delete|drop|alter|export|"
    r"import|call|set|reset|checkpoint|vacuum|use|truncate|grant|"
    r"read_\w+|\w+_scan|glob|sniff_csv|getenv|query_table)\b|\bquery\s*\(", re.I)


PREVIEW_ROWS = 500  # the server's ROW_PREVIEW_LIMIT


def coverage_note(ds: LoadedDataset) -> str:
    """What the answer may claim about how much of the file it covers."""
    if ds.whole_file or ds.total_rows < PREVIEW_ROWS * len(ds.tables):
        return f"Do not say you only saw a sample: this covers all {ds.total_rows} rows."
    return (f"This covers the first {PREVIEW_ROWS} rows of each sheet only — the full file could "
            "not be read. Say so in one short clause so the customer knows.")


class UnsafeSQL(ValueError):
    pass


def check_sql(sql: str) -> str:
    """Accept one read-only SELECT/WITH, or raise UnsafeSQL."""
    s = re.sub(r"--[^\n]*|/\*.*?\*/", " ", sql or "", flags=re.S).strip().rstrip(";").strip()
    # Scan with literals and quoted identifiers blanked, so a column called "Set" is fine.
    bare = re.sub(r"'(?:[^']|'')*'|\"(?:[^\"]|\"\")*\"", "''", s)
    if not re.match(r"^(select|with)\b", bare, re.I):
        raise UnsafeSQL("must be a single SELECT or WITH query")
    if ";" in bare:
        raise UnsafeSQL("only one statement is allowed")
    hit = _FORBIDDEN.search(bare)
    if hit:
        raise UnsafeSQL(f"'{hit.group(0)}' is not allowed")
    return s


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[list]
    truncated: bool


async def run(ds: LoadedDataset, sql: str) -> QueryResult:
    safe = check_sql(sql)

    def _exec():
        cur = ds.con.execute(safe)
        cols = [d[0] for d in cur.description]
        rows = cur.fetchmany(MAX_RESULT_ROWS + 1)
        return QueryResult(cols, [list(r) for r in rows[:MAX_RESULT_ROWS]], len(rows) > MAX_RESULT_ROWS)

    try:
        return await asyncio.wait_for(asyncio.to_thread(_exec), timeout=QUERY_TIMEOUT_S)
    except asyncio.TimeoutError:
        ds.con.interrupt()
        raise TimeoutError(f"query took longer than {QUERY_TIMEOUT_S}s")


def result_text(res: QueryResult, limit: int = 60) -> str:
    def fmt(v):
        if isinstance(v, float):
            return f"{v:.4f}".rstrip("0").rstrip(".")
        return str(v)
    head = " | ".join(res.columns)
    body = "\n".join(" | ".join(fmt(v) for v in r) for r in res.rows[:limit])
    more = len(res.rows) - limit
    note = f"\n… {more} more rows" if more > 0 else ""
    note += " (result capped)" if res.truncated else ""
    return f"{head}\n{body}{note}" if res.rows else f"{head}\n(no rows)"


# ── The two model calls ──────────────────────────────────────────────────────

PLAN_PROMPT = """\
You are Rex, a data analyst. The customer uploaded "{name}" and asked a question about it. Write
ONE DuckDB SQL query that computes the answer from ALL the rows.

Schema:
{schema}

Question: {question}

Rules:
- One SELECT (or WITH … SELECT). Read-only. Only the tables above.
- Quote every column name with double quotes exactly as written, e.g. "Order Date".
- Filter on the exact values listed in the schema (they are case-sensitive).
- Numbers are already clean numerics; dates are DATE — use strftime/date_trunc/extract on them.
- Apply only the filters the question asks for.
- For rankings, return the top rows with their values (ORDER BY … DESC LIMIT 10) so the answer
  can show the margin. For a chart, return the grouped rows the chart needs (at most 20).
- If the question cannot be answered from these columns, or needs no computation (e.g. "what is
  this file?"), return "sql": null.
{retry}
Return JSON: {{"sql": "<query or null>"}}"""

ANSWER_PROMPT = """\
You are Rex, a data analyst. Answer the customer's question about "{name}" ({rows} rows) using the
query result below — it was computed over every row.

Question: {question}

SQL that was run:
{sql}

Result:
{result}

Respond with a JSON object:
- "answer": 2-5 sentences. Lead with the direct answer. Use only numbers that appear in the result
  (you may round). Rates stored as fractions (0.035) read as percentages (3.5%). Rupee amounts
  use Indian grouping (₹1,78,319) or lakh/crore. {coverage}
- "chart": null, unless the question asks for a chart/visualisation or one clearly helps. If
  included: {{"type": "bar"|"line"|"pie"|"scatter"|"table", "title": "...", "data": [rows from the
  result as objects, max 20], "xKey": "<field>", "yKeys": [{{"key": "<field>", "label": "...",
  "color": "<hex from {colors}>"}}]}}
Answer in the language the customer used (English, Hindi or Hinglish)."""

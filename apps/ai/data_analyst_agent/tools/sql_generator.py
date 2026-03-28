"""
tools/sql_generator.py

Uses the LLM to:
  1. classify_query         – SQL-answerable vs general knowledge question
  2. generate_sql           – produce a structured JSON {sql, chart, x_col, y_col}
  3. fix_sql                – auto-fix a broken SQL query given the error
  4. generate_insights_queries – produce N exploratory SQL queries for /insights
"""

import json
import logging

from data_analyst_agent.tools.llm_client import chat_completion

log = logging.getLogger("ai-analyst.sql_generator")


# ── Prompt builders ────────────────────────────────────────────────────────────

def _schema_block(schema: dict) -> str:
    col_lines = "\n".join(
        f"  - {col} ({dtype})"
        for col, dtype in schema["column_types"].items()
    )
    sample_json = json.dumps(schema["sample_rows"], indent=2, default=str)
    return (
        f"Table name  : {schema['table_name']}\n"
        f"Total rows  : {schema['row_count']}\n"
        f"Columns:\n{col_lines}\n\n"
        f"Sample rows (first {len(schema['sample_rows'])}):\n{sample_json}"
    )


CLASSIFY_SYSTEM = """
You are a strict and intelligent query classifier for a data analytics system.

You are given:
1. A dataset schema (tables + columns)
2. A user query

Your job is to decide whether the query can be answered using THIS dataset.

---

CLASSIFY AS {"type": "sql"} IF:
- The query refers to columns, metrics, or concepts present in the schema
- The query involves aggregations (sum, avg, count, top, trend, etc.)
- The query can reasonably be mapped to the dataset columns (even if wording differs slightly)
- The query is about analyzing, filtering, or comparing data

---

CLASSIFY AS {"type": "general"} IF:
- The query is clearly unrelated to the schema
  (e.g., asks about concepts not present in columns)
- It is general knowledge (e.g., "what is churn", "what is SQL")
- It is small talk (hello, hi, how are you)
- It asks for explanations without requiring dataset data

---

SCHEMA-AWARE RULES (VERY IMPORTANT):
- ONLY use SQL if the query can be answered using the given schema
- If key entities in the query are NOT present in schema → classify as {"type": "general"}
- Match synonyms loosely:
    e.g., "sales" ≈ "revenue", "customers" ≈ "users"
- Do NOT assume missing columns exist

---

BIAS RULE:
- If partially related → choose {"type": "sql"}
- If clearly unrelated → choose {"type": "general"}

---

Respond with EXACTLY one JSON object:
{"type": "sql"} OR {"type": "general"}

No explanation. No markdown. No extra text.
"""


SQL_SYSTEM = """\
You are an expert SQL analyst. Generate a single SQLite-compatible SELECT query \
for the user's question based on the dataset schema provided.

STRICT RULES:
  1. ONLY generate SELECT queries. Never use DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE.
  2. Use the exact table name provided in the schema.
  3. Qualify all column names to avoid ambiguity.
  4. Handle NULL values gracefully (use COALESCE where appropriate).
  5. SQLite date functions:
       - strftime('%Y', col)       instead of YEAR(col)
       - strftime('%m', col)       instead of MONTH(col)
       - strftime('%Y-%m', col)    for year-month grouping
       - julianday() for date arithmetic, DATE('now') for current date
     No PIVOT, no QUALIFY, no STDDEV(), no MEDIAN().
     Integer division: CAST(a AS REAL) / b for float result.
     String concatenation: use || operator.

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "sql"   : "<your SELECT query>",
  "chart" : "bar" | "line" | "pie" | "none",
  "x_col" : "<column name for X axis, or null>",
  "y_col" : "<column name for Y axis, or null>"
}

Choose chart="none" if the result is a single value or the query isn't visual.
Choose chart="pie" for categorical proportions (<10 categories).
Choose chart="line" for time-series data.
Choose chart="bar" for categorical comparisons."""


FIX_SQL_SYSTEM = """\
You are a SQLite SQL debugger. You will be given a broken SQL query, the error it produced, \
and the dataset schema. Fix the SQL so it executes correctly.

SQLite reminders:
  - Use strftime('%Y', col) not YEAR(col)
  - No PIVOT, no QUALIFY, no STDDEV(), no MEDIAN()
  - String concat uses || operator
  - Column names with spaces need double quotes
  - Integer division: CAST(a AS REAL) / b

Respond ONLY with the same JSON format (no markdown, no explanation):
{"sql": "<fixed SELECT query>", "chart": "...", "x_col": "...", "y_col": "..."}"""


INSIGHTS_SYSTEM = """\
You are a senior data analyst generating automatic exploratory insights for a new dataset.

Generate exactly 5 diverse SQL SELECT queries that surface the most actionable patterns.

Prioritize:
  1. Categorical breakdowns for high-cardinality columns
  2. Distribution / spread analysis for numeric columns
  3. Trend-over-time query if any date/time columns exist
  4. Top-N and bottom-N rankings
  5. Cross-column comparisons (e.g., avg metric by category)

All SQL must be SQLite-compatible. Use strftime('%Y', col) for date extraction.
No PIVOT, no STDDEV(), no MEDIAN(). Use COALESCE for NULLs.

Respond ONLY with a valid JSON array (no markdown, no explanation):
[
  {
    "title" : "Short insight title",
    "sql"   : "<SELECT query>",
    "chart" : "bar" | "line" | "pie" | "none",
    "x_col" : "<column or null>",
    "y_col" : "<column or null>"
  },
  ...
]"""


# ── Public functions ───────────────────────────────────────────────────────────

async def classify_query(*, query: str, schema: dict) -> str:
    """Returns 'sql' or 'general'."""
    messages = [
        {
            "role": "user",
            "content": (
                f"Dataset schema:\n{_schema_block(schema)}\n\n"
                f"User question: {query}"
            ),
        }
    ]
    raw = await chat_completion(system=CLASSIFY_SYSTEM, messages=messages, max_tokens=30)
    try:
        result = json.loads(raw)
        return result.get("type", "sql")
    except json.JSONDecodeError:
        log.warning("classify_query: failed to parse response %r, defaulting to sql", raw)
        return "sql"


async def generate_sql(*, query: str, schema: dict) -> dict:
    """
    Returns a dict: {sql, chart, x_col, y_col}
    """
    messages = [
        {
            "role": "user",
            "content": (
                f"Dataset schema:\n{_schema_block(schema)}\n\n"
                f"User question: {query}\n\n"
                "Generate the SQL query."
            ),
        }
    ]
    raw = await chat_completion(system=SQL_SYSTEM, messages=messages, max_tokens=600)

    # Strip accidental markdown fences
    clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    try:
        result = json.loads(clean)
        log.debug("LLM SQL output: %s", result)
        return result
    except json.JSONDecodeError as exc:
        log.error("generate_sql: JSON parse failed – %s\nRaw: %r", exc, raw)
        raise ValueError(f"LLM returned invalid JSON: {raw[:200]}") from exc


async def fix_sql(*, original_sql: str, error: str, schema: dict) -> dict:
    """
    Ask the LLM to repair a broken SQL query.

    Returns a dict: {sql, chart, x_col, y_col}
    Raises ValueError if the LLM response cannot be parsed.
    """
    messages = [
        {
            "role": "user",
            "content": (
                f"Dataset schema:\n{_schema_block(schema)}\n\n"
                f"Broken SQL:\n{original_sql}\n\n"
                f"Error:\n{error}\n\n"
                "Fix the SQL query."
            ),
        }
    ]
    raw = await chat_completion(system=FIX_SQL_SYSTEM, messages=messages, max_tokens=600)
    clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    try:
        result = json.loads(clean)
        log.info("fix_sql: repaired SQL: %s", result.get("sql", ""))
        return result
    except json.JSONDecodeError as exc:
        log.error("fix_sql: JSON parse failed – %s\nRaw: %r", exc, raw)
        raise ValueError(f"fix_sql: LLM returned invalid JSON: {raw[:200]}") from exc


async def generate_insights_queries(*, schema: dict, profile_summary: str = "") -> list[dict]:
    """
    Returns a list of insight dicts: [{title, sql, chart, x_col, y_col}, ...]
    """
    profile_section = (
        f"\nData profile summary:\n{profile_summary}\n" if profile_summary else ""
    )
    messages = [
        {
            "role": "user",
            "content": (
                f"Dataset schema:\n{_schema_block(schema)}"
                f"{profile_section}\n\n"
                "Generate 5 insightful exploratory SQL queries."
            ),
        }
    ]
    raw = await chat_completion(system=INSIGHTS_SYSTEM, messages=messages, max_tokens=1200)
    clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        log.warning("generate_insights_queries: failed to parse JSON, returning empty")
        return []

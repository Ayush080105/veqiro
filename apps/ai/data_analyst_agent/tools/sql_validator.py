"""
tools/sql_validator.py

Validates SQL queries before execution.

Strategy:
  1. Strip comments and normalize whitespace.
  2. Reject any query containing dangerous keywords.
  3. Ensure the query starts with SELECT.
"""

import logging
import re

log = logging.getLogger("ai-analyst.sql_validator")

# DML / DDL operations that must never be allowed
FORBIDDEN_KEYWORDS = {
    "DROP",
    "DELETE",
    "UPDATE",
    "INSERT",
    "ALTER",
    "TRUNCATE",
    "CREATE",
    "REPLACE",
    "MERGE",
    "EXEC",
    "EXECUTE",
    "GRANT",
    "REVOKE",
    "ATTACH",
    "DETACH",
    "COPY",
    "EXPORT",
    "IMPORT",
}

# Regex to strip SQL comments (-- single-line and /* multi-line */)
_COMMENT_RE = re.compile(
    r"--[^\n]*|/\*.*?\*/",
    re.DOTALL,
)


def _strip_comments(sql: str) -> str:
    return _COMMENT_RE.sub(" ", sql)


def _extract_keywords(sql: str) -> set[str]:
    """Return the set of SQL-token-like words (uppercase) found in the query."""
    tokens = re.findall(r"\b[A-Za-z_]+\b", sql)
    return {t.upper() for t in tokens}


def validate_sql(sql: str) -> tuple[bool, str | None]:
    """
    Validate that a SQL string is a safe SELECT query.

    Returns:
        (True, None)              if valid
        (False, error_message)    if invalid
    """
    if not sql or not sql.strip():
        return False, "SQL query is empty."

    cleaned = _strip_comments(sql).strip()
    keywords = _extract_keywords(cleaned)

    # Check for forbidden keywords
    found_forbidden = keywords & FORBIDDEN_KEYWORDS
    if found_forbidden:
        msg = f"Query contains forbidden keyword(s): {', '.join(sorted(found_forbidden))}."
        log.warning("SQL rejected – %s", msg)
        return False, msg

    # Must start with SELECT
    first_word = cleaned.split()[0].upper() if cleaned.split() else ""
    if first_word != "SELECT":
        msg = f"Only SELECT queries are allowed. Query starts with '{first_word}'."
        log.warning("SQL rejected – %s", msg)
        return False, msg

    log.debug("SQL passed validation: %s", sql[:120])
    return True, None
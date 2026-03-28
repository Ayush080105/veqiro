"""
tools/sql_executor.py

Executes a validated SELECT query against a SQLite database.

Each dataset is stored as a persistent SQLite DB at storage/<dataset_id>.db.
The table name inside the DB is always "dataset".
"""

import logging
import sqlite3
from pathlib import Path

import pandas as pd

log = logging.getLogger("ai-analyst.sql_executor")

TABLE_ALIAS = "dataset"


def execute_sql(
    *,
    db_path: Path,
    sql: str,
    max_rows: int = 1_000,
) -> tuple[pd.DataFrame | None, str | None]:
    """
    Execute a SQL SELECT query against a SQLite database.

    Args:
        db_path:  Path to the SQLite DB file.
        sql:      Validated SELECT query; must reference table as "dataset".
        max_rows: Hard cap on returned rows to prevent memory blowout.

    Returns:
        (DataFrame, None)         on success
        (None, error_message)     on failure
    """
    try:
        conn = sqlite3.connect(db_path, check_same_thread=False)
        df: pd.DataFrame = pd.read_sql_query(sql, conn)
        conn.close()

        if df.empty:
            log.info("SQL returned 0 rows.")
            return df, None

        if len(df) > max_rows:
            log.warning("Result truncated from %d to %d rows.", len(df), max_rows)
            df = df.head(max_rows)

        log.info("SQL returned %d rows, %d columns.", len(df), len(df.columns))
        return df, None

    except sqlite3.Error as exc:
        msg = f"SQLite execution error: {exc}"
        log.error(msg)
        return None, msg
    except Exception as exc:
        msg = f"Unexpected execution error: {exc}"
        log.exception(msg)
        return None, msg

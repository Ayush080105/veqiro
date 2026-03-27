"""
tools/sql_executor.py

Executes a validated SELECT query against a CSV file using DuckDB.

DuckDB can query CSV files directly via read_csv_auto(), which means:
  - No persistent database needed (fully stateless).
  - Fast columnar execution.
  - The table alias in SQL is "dataset" (set in schema_extractor).
"""

import logging
from pathlib import Path

import duckdb
import pandas as pd

log = logging.getLogger("ai-analyst.sql_executor")

# DuckDB reads the CSV under this alias
TABLE_ALIAS = "dataset"


def execute_sql(
    *,
    csv_path: Path,
    sql: str,
    max_rows: int = 1_000,
) -> tuple[pd.DataFrame | None, str | None]:
    """
    Execute a SQL SELECT query against a CSV file.

    Args:
        csv_path: Path to the CSV file.
        sql:      Validated SELECT query; must reference table as "dataset".
        max_rows: Hard cap on returned rows to prevent memory blowout.

    Returns:
        (DataFrame, None)         on success
        (None, error_message)     on failure
    """
    try:
        con = duckdb.connect(database=":memory:")

        # Register the CSV as a virtual table called "dataset"
        con.execute(
            f"CREATE VIEW {TABLE_ALIAS} AS SELECT * FROM read_csv_auto('{csv_path}')"
        )

        df: pd.DataFrame = con.execute(sql).df()
        con.close()

        if df.empty:
            log.info("SQL returned 0 rows.")
            return df, None

        if len(df) > max_rows:
            log.warning("Result truncated from %d to %d rows.", len(df), max_rows)
            df = df.head(max_rows)

        log.info("SQL returned %d rows, %d columns.", len(df), len(df.columns))
        return df, None

    except duckdb.Error as exc:
        msg = f"DuckDB execution error: {exc}"
        log.error(msg)
        return None, msg
    except Exception as exc:
        msg = f"Unexpected execution error: {exc}"
        log.exception(msg)
        return None, msg
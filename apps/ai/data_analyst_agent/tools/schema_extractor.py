"""
tools/schema_extractor.py

Extracts column names, inferred types, row count, and sample rows from a SQLite DB.
This context is passed to the LLM for accurate SQL generation.
"""

import logging
import sqlite3
from pathlib import Path

import pandas as pd

log = logging.getLogger("ai-analyst.schema_extractor")

SAMPLE_ROWS = 5  # Number of sample rows to surface in prompts


def extract_schema(db_path: Path) -> dict:
    """
    Read structural metadata from a SQLite dataset DB.

    Returns a dict with:
      - columns      : list of column names
      - column_types : dict of {column: dtype_string}
      - sample_rows  : list of dicts (first N rows)
      - row_count    : total number of rows
      - table_name   : canonical table alias used in queries ("dataset")
    """
    conn = sqlite3.connect(db_path, check_same_thread=False)

    df = pd.read_sql_query("SELECT * FROM dataset LIMIT 500", conn)
    row_count = int(
        pd.read_sql_query("SELECT COUNT(*) AS cnt FROM dataset", conn).iloc[0]["cnt"]
    )

    conn.close()

    schema = {
        "columns": list(df.columns),
        "column_types": {col: str(df[col].dtype) for col in df.columns},
        "sample_rows": df.head(SAMPLE_ROWS).fillna("").to_dict(orient="records"),
        "row_count": row_count,
        "table_name": "dataset",
    }

    log.debug(
        "Schema extracted: %d columns, %d rows from %s",
        len(schema["columns"]),
        schema["row_count"],
        db_path.name,
    )
    return schema

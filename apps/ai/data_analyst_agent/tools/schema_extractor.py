"""
tools/schema_extractor.py

Extracts column names, inferred types, row count, and sample rows from a CSV.
This context is passed to the LLM for accurate SQL generation.
"""

import logging
from pathlib import Path

import pandas as pd

log = logging.getLogger("ai-analyst.schema_extractor")

SAMPLE_ROWS = 5  # Number of sample rows to surface in prompts


def extract_schema(csv_path: Path) -> dict:
    """
    Load a CSV and return its structural metadata.

    Returns a dict with:
      - columns      : list of column names
      - column_types : dict of {column: dtype_string}
      - sample_rows  : list of dicts (first N rows)
      - row_count    : total number of rows
      - table_name   : canonical table alias used in DuckDB queries ("dataset")
    """
    df = pd.read_csv(csv_path, nrows=500)  # partial read for schema only

    # Full row count (cheap with DuckDB-style line count)
    with open(csv_path, "rb") as f:
        row_count = sum(1 for _ in f) - 1  # subtract header

    schema = {
        "columns": list(df.columns),
        "column_types": {col: str(df[col].dtype) for col in df.columns},
        "sample_rows": df.head(SAMPLE_ROWS).fillna("").to_dict(orient="records"),
        "row_count": max(row_count, 0),
        "table_name": "dataset",
    }

    log.debug(
        "Schema extracted: %d columns, %d rows from %s",
        len(schema["columns"]),
        schema["row_count"],
        csv_path.name,
    )
    return schema
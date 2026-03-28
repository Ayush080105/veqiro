"""
tools/data_profiler.py

Generates a statistical data quality profile for a SQLite dataset.
No external dependencies — uses sqlite3 + math only.

Returns per-column stats (missing %, min/max/mean/std for numerics,
top-10 values for categoricals) plus dataset-level duplicate count.
"""

import logging
import math
import sqlite3
from pathlib import Path

log = logging.getLogger("ai-analyst.data_profiler")

# SQLite affinities that map to numeric
_NUMERIC_AFFINITIES = {"INTEGER", "REAL", "NUMERIC"}


def _is_numeric(col_type: str) -> bool:
    return col_type.upper() in _NUMERIC_AFFINITIES


def profile_dataset(db_path: Path) -> dict:
    """
    Compute a statistical profile of the 'dataset' table.

    Returns:
    {
      "row_count"       : int,
      "duplicate_count" : int,
      "columns": {
        "<col>": {
          "dtype"        : "numeric" | "text",
          "missing_count": int,
          "missing_pct"  : float,
          # numeric only:
          "min"  : float,
          "max"  : float,
          "mean" : float,
          "std"  : float,
          # text only:
          "top_values": [{"value": str, "count": int}, ...]
        }
      }
    }
    """
    conn = sqlite3.connect(db_path, check_same_thread=False)

    # ── Table metadata ──────────────────────────────────────────────────
    pragma = conn.execute("PRAGMA table_info(dataset)").fetchall()
    # pragma columns: (cid, name, type, notnull, dflt_value, pk)
    columns = [(row[1], row[2]) for row in pragma]  # (name, type)

    row_count = conn.execute("SELECT COUNT(*) FROM dataset").fetchone()[0]

    distinct_rows = conn.execute(
        "SELECT COUNT(*) FROM (SELECT DISTINCT * FROM dataset)"
    ).fetchone()[0]
    duplicate_count = max(0, row_count - distinct_rows)

    profile: dict = {
        "row_count": row_count,
        "duplicate_count": duplicate_count,
        "columns": {},
    }

    for col_name, col_type in columns:
        safe_col = f'"{col_name}"'
        missing_count = conn.execute(
            f"SELECT COUNT(*) FROM dataset WHERE {safe_col} IS NULL OR TRIM(CAST({safe_col} AS TEXT)) = ''"
        ).fetchone()[0]
        missing_pct = round(missing_count / row_count * 100, 2) if row_count else 0.0

        if _is_numeric(col_type):
            row = conn.execute(
                f"SELECT MIN(CAST({safe_col} AS REAL)), MAX(CAST({safe_col} AS REAL)), "
                f"AVG(CAST({safe_col} AS REAL)) FROM dataset WHERE {safe_col} IS NOT NULL"
            ).fetchone()
            col_min, col_max, col_mean = row

            # Standard deviation via variance formula (no STDDEV in SQLite)
            if col_mean is not None:
                variance_row = conn.execute(
                    f"SELECT AVG((CAST({safe_col} AS REAL) - ?) * (CAST({safe_col} AS REAL) - ?)) "
                    f"FROM dataset WHERE {safe_col} IS NOT NULL",
                    (col_mean, col_mean),
                ).fetchone()
                variance = variance_row[0] or 0.0
                col_std = round(math.sqrt(variance), 4)
            else:
                col_std = 0.0

            profile["columns"][col_name] = {
                "dtype": "numeric",
                "missing_count": missing_count,
                "missing_pct": missing_pct,
                "min": round(col_min, 4) if col_min is not None else None,
                "max": round(col_max, 4) if col_max is not None else None,
                "mean": round(col_mean, 4) if col_mean is not None else None,
                "std": col_std,
            }
        else:
            top_values_rows = conn.execute(
                f"SELECT CAST({safe_col} AS TEXT) AS val, COUNT(*) AS freq "
                f"FROM dataset WHERE {safe_col} IS NOT NULL "
                f"GROUP BY val ORDER BY freq DESC LIMIT 10"
            ).fetchall()
            top_values = [{"value": str(r[0]), "count": r[1]} for r in top_values_rows]

            profile["columns"][col_name] = {
                "dtype": "text",
                "missing_count": missing_count,
                "missing_pct": missing_pct,
                "top_values": top_values,
            }

    conn.close()
    log.info(
        "Profiled dataset at %s: %d rows, %d dupes, %d columns",
        db_path.name,
        row_count,
        duplicate_count,
        len(columns),
    )
    return profile


def profile_summary_text(profile: dict) -> str:
    """
    Compact plain-text summary of a profile for LLM injection.
    Example line: "Revenue: numeric, min=0, max=50000, mean=12400, missing=3.2%"
    """
    lines = [
        f"Total rows: {profile['row_count']}  |  Duplicates: {profile['duplicate_count']}"
    ]
    for col, stats in profile["columns"].items():
        missing = f"missing={stats['missing_pct']}%"
        if stats["dtype"] == "numeric":
            lines.append(
                f"  {col}: numeric | min={stats['min']}, max={stats['max']}, "
                f"mean={stats['mean']}, std={stats['std']}, {missing}"
            )
        else:
            top = ", ".join(v["value"] for v in stats["top_values"][:5])
            lines.append(f"  {col}: text | top=[{top}], {missing}")
    return "\n".join(lines)

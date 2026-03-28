"""
dataset_registry.py

Persistent SQLite-backed registry for uploaded datasets.
Replaces the in-memory DATASETS dict so dataset registrations survive server restarts.

Storage: data_analyst_agent/storage/registry.db
Table  : datasets(dataset_id, db_path, name, row_count, schema_json, created_at)
"""

import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path

log = logging.getLogger("ai-analyst.dataset_registry")

STORAGE_DIR = Path(__file__).parent / "storage"
REGISTRY_DB = STORAGE_DIR / "registry.db"


def _init_registry() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(REGISTRY_DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS datasets (
                dataset_id  TEXT PRIMARY KEY,
                db_path     TEXT NOT NULL,
                name        TEXT NOT NULL,
                row_count   INTEGER,
                schema_json TEXT,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


# Initialise on import
_init_registry()


def register_dataset(
    dataset_id: str,
    db_path: Path,
    name: str,
    row_count: int,
    schema: dict,
) -> None:
    """Insert or replace a dataset entry in the registry."""
    with sqlite3.connect(REGISTRY_DB) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO datasets (dataset_id, db_path, name, row_count, schema_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                dataset_id,
                str(db_path),
                name,
                row_count,
                json.dumps(schema),
                datetime.utcnow().isoformat(),
            ),
        )
        conn.commit()
    log.info("Registered dataset %s (%s, %d rows)", dataset_id, name, row_count)


def get_dataset(dataset_id: str) -> dict | None:
    """
    Fetch a dataset entry by ID.
    Returns a dict with keys: dataset_id, db_path, name, row_count, schema, created_at
    or None if not found.
    """
    with sqlite3.connect(REGISTRY_DB) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM datasets WHERE dataset_id = ?", (dataset_id,)
        ).fetchone()

    if row is None:
        return None

    entry = dict(row)
    entry["db_path"] = Path(entry["db_path"])
    entry["schema"] = json.loads(entry.pop("schema_json") or "{}")
    return entry


def list_datasets() -> list[dict]:
    """Return all registered datasets ordered by creation date (newest first)."""
    with sqlite3.connect(REGISTRY_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM datasets ORDER BY created_at DESC"
        ).fetchall()

    result = []
    for row in rows:
        entry = dict(row)
        entry["db_path"] = str(entry["db_path"])
        entry.pop("schema_json", None)
        result.append(entry)
    return result


def dataset_exists(dataset_id: str) -> bool:
    """Return True if a dataset with the given ID is registered."""
    with sqlite3.connect(REGISTRY_DB) as conn:
        row = conn.execute(
            "SELECT 1 FROM datasets WHERE dataset_id = ?", (dataset_id,)
        ).fetchone()
    return row is not None

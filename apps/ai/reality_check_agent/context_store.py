import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "storage", "contexts.db")


def _get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS contexts (
            session_id TEXT PRIMARY KEY,
            data       TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def get_context(session_id: str) -> dict:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT data FROM contexts WHERE session_id = ?", (session_id,)
        ).fetchone()
    if row:
        return json.loads(row[0])
    return {}


def save_context(session_id: str, context: dict) -> None:
    data = json.dumps(context)
    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO contexts (session_id, data, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            """,
            (session_id, data, now),
        )
        conn.commit()

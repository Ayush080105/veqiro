"""A case is one thing a customer does, with how we know it went well."""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

FIXTURES = Path(__file__).parent / "fixtures"


@dataclass
class Case:
    id: str
    agent: str
    endpoint: str
    payload: dict
    graders: list[Callable]
    # Who the customer is and what they are trying to get done. The judge reads it, and it is
    # the first thing to read when a case fails.
    story: str
    # regression: works today and must keep working (gates a release).
    # capability: a known gap we are working towards; failing is expected, passing is progress.
    tier: str = "regression"
    known_issue: str | None = None
    latency_s: float = 45
    rag_chunks: list[dict] | None = None
    tags: tuple[str, ...] = field(default_factory=tuple)


# Datasets a case's customer has uploaded, by id — what the server's internal
# /internal/rex/datasets endpoint would return. The harness serves Rex's fetch_dataset from here.
DATASETS: dict[str, dict] = {}


def chat(agent: str, message: str, org: str = "", history: list[dict] | None = None,
         memory: str | None = None, conversation: str = "eval") -> tuple[str, dict]:
    """A chat turn exactly as the server forwards it."""
    return f"/ai/{agent}/chat", {
        "user_id": "eval_user",
        "organization_id": org,
        "conversation_id": conversation,
        "message": message,
        "history": history or [],
        "metadata": {"memory_context": memory} if memory else {},
    }


def table(csv_name: str, column_types: dict[str, str]) -> dict:
    """An uploaded CSV as the server sends it to Rex: raw string cells, first 500 rows."""
    with (FIXTURES / csv_name).open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        headers = reader.fieldnames or []
    return {"headers": headers, "rows": rows[:500], "columnTypes": column_types}


def read_rows(csv_name: str) -> list[dict[str, Any]]:
    with (FIXTURES / csv_name).open(encoding="utf-8") as f:
        return list(csv.DictReader(f))

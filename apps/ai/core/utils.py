"""Shared utility functions."""

from __future__ import annotations

import json
import re
from typing import Any


def strip_json_fences(raw: str) -> str:
    """Strip ```json ... ``` or ``` ... ``` markdown fences from LLM output."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _extract_json(s: str) -> dict | list | None:
    """Best-effort recovery of the first complete JSON object/array embedded in
    a string that may have leading/trailing prose. Returns None if none parses."""
    start = next((i for i, ch in enumerate(s) if ch in "{["), None)
    if start is None:
        return None
    # Shrink the suffix from the end until a valid JSON value parses. This
    # tolerates trailing prose while still requiring a structurally complete
    # object/array (so we never accept a mid-sentence truncation as success).
    for end in range(len(s), start, -1):
        if s[end - 1] not in "}]":
            continue
        try:
            return json.loads(s[start:end])
        except json.JSONDecodeError:
            continue
    return None


def safe_json_loads(raw: str) -> dict | list:
    """Parse JSON from LLM output.

    Strips markdown fences first, then (only if a strict parse fails) attempts
    to recover a complete JSON object/array embedded in surrounding prose.
    Raises json.JSONDecodeError if nothing valid can be recovered.
    """
    cleaned = strip_json_fences(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        recovered = _extract_json(cleaned)
        if recovered is not None:
            return recovered
        raise


def downsample_points(points: list[Any], max_points: int = 200) -> list[Any]:
    """Downsample a (chronological) series to at most ``max_points`` items,
    always preserving the first and last point and evenly spacing the rest.

    Used to cap how much raw time-series data is embedded in an LLM prompt so a
    large CSV (tens of thousands of rows) can't overflow the model's context.
    Analytics/charts continue to use the full series — only the prompt is capped.
    """
    n = len(points)
    if max_points < 2:
        return points[:1] if n else []
    if n <= max_points:
        return points
    step = (n - 1) / (max_points - 1)
    idxs = sorted({round(i * step) for i in range(max_points)})
    return [points[i] for i in idxs]

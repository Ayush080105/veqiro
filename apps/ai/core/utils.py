"""Shared utility functions."""

from __future__ import annotations

import json
import re


def strip_json_fences(raw: str) -> str:
    """Strip ```json ... ``` or ``` ... ``` markdown fences from LLM output."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def safe_json_loads(raw: str) -> dict | list:
    """Parse JSON from LLM output, stripping markdown fences first."""
    return json.loads(strip_json_fences(raw))

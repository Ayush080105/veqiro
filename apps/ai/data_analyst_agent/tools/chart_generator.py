"""
tools/chart_generator.py

Builds a chart configuration dict from the LLM's chart hint and the actual
result columns. The frontend/consumer uses this config to render charts
(e.g., with Chart.js, Recharts, Plotly, etc.).

No matplotlib/pyplot – no blocking calls, purely config generation.
"""

import logging

log = logging.getLogger("ai-analyst.chart_generator")

VALID_CHART_TYPES = {"bar", "line", "pie", "scatter", "none"}


def recommend_chart(
    *,
    hint: dict,
    columns: list[str],
) -> dict | None:
    """
    Produce a chart configuration dict, or None if no chart is appropriate.

    Args:
        hint    : LLM-suggested chart hint {type, x, y}.
        columns : Actual columns present in the query result.

    Returns:
        A chart config dict, e.g.:
          {"type": "bar", "x": "category", "y": "total_revenue"}
        Or None if type is "none" or columns are insufficient.
    """
    chart_type = (hint.get("type") or "none").lower()
    x_col = hint.get("x")
    y_col = hint.get("y")

    if chart_type not in VALID_CHART_TYPES or chart_type == "none":
        return None

    if not columns:
        return None

    # Validate/fallback for column references
    x_col = x_col if x_col in columns else (columns[0] if columns else None)
    y_col = y_col if y_col in columns else (columns[1] if len(columns) > 1 else columns[0] if columns else None)

    if not x_col or not y_col:
        log.debug("Insufficient columns for chart, skipping.")
        return None

    config = {
        "type": chart_type,
        "x": x_col,
        "y": y_col,
        "title": f"{y_col} by {x_col}",
    }

    log.debug("Chart config: %s", config)
    return config
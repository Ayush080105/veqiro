"""
agent.py – LLM orchestration layer.

Flow for /query:
  1. Extract schema from SQLite DB
  2. Classify query (SQL vs general)
  3. Generate SQL via LLM
  4. Validate + execute SQL, with up to 2 self-healing attempts via LLM
  6. Generate explanation via LLM
  7. Recommend chart config
  8. Return unified response

Flow for /insights:
  1. Extract schema + sample rows
  2. Ask LLM to surface top insights
"""

import logging
from pathlib import Path

from data_analyst_agent.tools.chart_generator import recommend_chart
from data_analyst_agent.tools.explaination import generate_explanation
from data_analyst_agent.tools.schema_extractor import extract_schema
from data_analyst_agent.tools.sql_executor import execute_sql
from data_analyst_agent.tools.sql_generator import (
    classify_query,
    fix_sql,
    generate_insights_queries,
    generate_sql,
)
from data_analyst_agent.tools.sql_validator import validate_sql

log = logging.getLogger("ai-analyst.agent")

MAX_ROWS = 1_000
MAX_HEAL = 2  # max self-healing retries per query


def _error_response(sql: str, message: str) -> dict:
    return {
        "query_type": "sql",
        "sql": sql,
        "data": [],
        "row_count": 0,
        "explanation": {
            "insight": "Query could not be executed.",
            "explanation": message,
            "key_observations": [],
            "recommendations": [],
        },
        "chart": None,
        "error": message,
    }


class AnalystAgent:
    """Stateless orchestrator – safe to share across requests."""

    async def run(self, *, db_path: Path, query: str) -> dict:
        # ── 1. Schema ──────────────────────────────────────────────────────────
        schema = extract_schema(db_path)

        # ── 2. Classify query ──────────────────────────────────────────────────
        query_type = await classify_query(query=query, schema=schema)
        log.info("Query classified as: %s", query_type)

        # ── 3. Generate SQL ────────────────────────────────────────────────────
        llm_output: dict = await generate_sql(query=query, schema=schema)
        sql: str = llm_output.get("sql", "")
        chart_hint: dict = {
            "type": llm_output.get("chart", "none"),
            "x": llm_output.get("x_col"),
            "y": llm_output.get("y_col"),
        }
        log.info("Generated SQL: %s", sql)

        # ── 4+5. Validate + Execute with self-healing ──────────────────────────
        df = None
        for attempt in range(MAX_HEAL + 1):
            is_valid, validation_error = validate_sql(sql)
            if not is_valid:
                log.warning("SQL validation failed (attempt %d): %s", attempt + 1, validation_error)
                if attempt < MAX_HEAL:
                    try:
                        healed = await fix_sql(original_sql=sql, error=validation_error, schema=schema)
                        sql = healed.get("sql", sql)
                        llm_output.update(healed)
                        chart_hint = {
                            "type": llm_output.get("chart", "none"),
                            "x": llm_output.get("x_col"),
                            "y": llm_output.get("y_col"),
                        }
                        continue
                    except Exception:
                        pass
                return _error_response(sql, validation_error)

            df, exec_error = execute_sql(db_path=db_path, sql=sql, max_rows=MAX_ROWS)
            if exec_error:
                log.error("SQL execution error (attempt %d): %s", attempt + 1, exec_error)
                if attempt < MAX_HEAL:
                    try:
                        healed = await fix_sql(original_sql=sql, error=exec_error, schema=schema)
                        sql = healed.get("sql", sql)
                        llm_output.update(healed)
                        chart_hint = {
                            "type": llm_output.get("chart", "none"),
                            "x": llm_output.get("x_col"),
                            "y": llm_output.get("y_col"),
                        }
                        continue
                    except Exception:
                        pass
                return _error_response(sql, exec_error)

            break  # success

        data_records = df.to_dict(orient="records") if df is not None else []

        # ── 6. Explanation ─────────────────────────────────────────────────────
        explanation = await generate_explanation(
            query=query,
            schema=schema,
            sql=sql,
            data=data_records[:20],
            mode="sql",
        )

        # ── 7. Chart config ────────────────────────────────────────────────────
        chart_config = recommend_chart(
            hint=chart_hint,
            columns=list(df.columns) if df is not None else [],
        )

        return {
            "query_type": "sql",
            "sql": sql,
            "data": data_records,
            "row_count": len(data_records),
            "explanation": explanation,
            "chart": chart_config,
        }

    async def auto_insights(self, *, db_path: Path) -> dict:
        """Surface automated insights from a dataset."""
        schema = extract_schema(db_path)
        insights_raw = await generate_insights_queries(schema=schema)
        insights = []

        for item in insights_raw:
            sql = item.get("sql", "")
            is_valid, _ = validate_sql(sql)
            if not is_valid:
                continue

            df, err = execute_sql(db_path=db_path, sql=sql, max_rows=100)
            if err or df is None or df.empty:
                continue

            insights.append(
                {
                    "title": item.get("title", "Insight"),
                    "sql": sql,
                    "data": df.to_dict(orient="records"),
                    "chart": recommend_chart(
                        hint={
                            "type": item.get("chart", "none"),
                            "x": item.get("x_col"),
                            "y": item.get("y_col"),
                        },
                        columns=list(df.columns),
                    ),
                }
            )

        return {"schema": schema, "insights": insights}

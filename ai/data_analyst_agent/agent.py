"""
agent.py – LLM orchestration layer.

Flow for /query:
  1. Extract schema from CSV
  2. Classify query (SQL vs general)
  3. Generate SQL via LLM
  4. Validate SQL
  5. Execute SQL with DuckDB
  6. Generate explanation via LLM
  7. Recommend chart config
  8. Return unified response

Flow for /insights:
  1. Extract schema + sample rows
  2. Ask LLM to surface top insights
"""

import json
import logging
from pathlib import Path

from data_analyst_agent.tools.chart_generator import recommend_chart
from data_analyst_agent.tools.explaination import generate_explanation
from data_analyst_agent.tools.schema_extractor import extract_schema
from data_analyst_agent.tools.sql_executor import execute_sql
from data_analyst_agent.tools.sql_generator import classify_query, generate_sql
from data_analyst_agent.tools.sql_validator import validate_sql

log = logging.getLogger("ai-analyst.agent")

# Maximum rows returned to the caller
MAX_ROWS = 1_000


class AnalystAgent:
    """Stateless orchestrator – safe to share across requests."""

    async def run(self, *, csv_path: Path, query: str) -> dict:
        # ── 1. Schema ──────────────────────────────────────────────────────────
        schema = extract_schema(csv_path)

        # ── 2. Classify query ──────────────────────────────────────────────────
        query_type = await classify_query(query=query, schema=schema)
        log.info("Query classified as: %s", query_type)

        # if query_type == "general":
        #     explanation = await generate_explanation(
        #         query=query,
        #         schema=schema,
        #         sql=None,
        #         data=None,
        #         mode="general",
        #     )
        #     return {
        #         "query_type": "general",
        #         "sql": None,
        #         "data": [],
        #         "row_count": 0,
        #         "explanation": explanation,
        #         "chart": None,
        #     }

        # ── 3. Generate SQL ────────────────────────────────────────────────────
        llm_output: dict = await generate_sql(query=query, schema=schema)
        sql: str = llm_output.get("sql", "")
        chart_hint: dict = {
            "type": llm_output.get("chart", "none"),
            "x": llm_output.get("x_col"),
            "y": llm_output.get("y_col"),
        }
        log.info("Generated SQL: %s", sql)

        # ── 4. Validate SQL ────────────────────────────────────────────────────
        is_valid, validation_error = validate_sql(sql)
        if not is_valid:
            log.warning("SQL validation failed: %s", validation_error)
            return {
                "query_type": "sql",
                "sql": sql,
                "data": [],
                "row_count": 0,
                "explanation": {
                    "insight": "Query could not be executed.",
                    "explanation": validation_error,
                    "key_observations": [],
                    "recommendations": [],
                },
                "chart": None,
                "error": validation_error,
            }

        # ── 5. Execute SQL ─────────────────────────────────────────────────────
        df, exec_error = execute_sql(csv_path=csv_path, sql=sql, max_rows=MAX_ROWS)
        if exec_error:
            log.error("SQL execution error: %s", exec_error)
            return {
                "query_type": "sql",
                "sql": sql,
                "data": [],
                "row_count": 0,
                "explanation": {
                    "insight": "SQL execution failed.",
                    "explanation": exec_error,
                    "key_observations": [],
                    "recommendations": [],
                },
                "chart": None,
                "error": exec_error,
            }

        data_records = df.to_dict(orient="records") if df is not None else []

        # ── 6. Explanation ─────────────────────────────────────────────────────
        explanation = await generate_explanation(
            query=query,
            schema=schema,
            sql=sql,
            data=data_records[:20],  # send sample to LLM, not full result
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

    async def auto_insights(self, *, csv_path: Path) -> dict:
        """Surface automated insights from a dataset."""
        from tools.sql_generator import generate_insights_queries
        from tools.sql_executor import execute_sql

        schema = extract_schema(csv_path)
        insights_raw = await generate_insights_queries(schema=schema)
        insights = []

        for item in insights_raw:
            sql = item.get("sql", "")
            is_valid, _ = validate_sql(sql)
            if not is_valid:
                continue

            df, err = execute_sql(csv_path=csv_path, sql=sql, max_rows=100)
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
"""
tools/explanation.py

Generates human-readable explanations and insights using the LLM.

Two modes:
  - "sql"     : explain query results with data context
  - "general" : answer a general knowledge question
"""

import json
import logging

from data_analyst_agent.tools.llm_client import chat_completion

log = logging.getLogger("ai-analyst.explanation")


SQL_EXPLANATION_SYSTEM = """\
You are a senior data analyst. Given a SQL query and its result data, produce a \
concise, insightful explanation for a business audience.

Respond ONLY with a valid JSON object (no markdown, no preamble):
{
  "insight"          : "One-sentence headline insight",
  "explanation"      : "2-3 sentence explanation of the data and what it means",
  "key_observations" : ["observation 1", "observation 2", "observation 3"],
  "recommendations"  : ["recommendation 1", "recommendation 2"]
}"""


GENERAL_EXPLANATION_SYSTEM = """\
You are a helpful data assistant. Answer the user's general question conversationally \
and briefly. 

Respond ONLY with a valid JSON object (no markdown, no preamble):
{
  "insight"          : "Direct answer to the question",
  "explanation"      : "Brief supporting explanation",
  "key_observations" : [],
  "recommendations"  : []
}"""


async def generate_explanation(
    *,
    query: str,
    schema: dict,
    sql: str | None,
    data: list[dict] | None,
    mode: str = "sql",
) -> dict:
    """
    Generate a structured explanation dict.

    Args:
        query   : Original user question.
        schema  : Dataset schema dict.
        sql     : The SQL that was executed (or None for general mode).
        data    : Sample of result rows (up to 20 rows recommended).
        mode    : "sql" or "general".

    Returns:
        dict with keys: insight, explanation, key_observations, recommendations
    """
    if mode == "general":
        system = GENERAL_EXPLANATION_SYSTEM
        user_content = f"User question: {query}"
    else:
        system = SQL_EXPLANATION_SYSTEM
        data_preview = json.dumps(data[:20] if data else [], indent=2, default=str)
        user_content = (
            f"User question: {query}\n\n"
            f"SQL executed:\n{sql}\n\n"
            f"Result data (first rows):\n{data_preview}"
        )

    messages = [{"role": "user", "content": user_content}]

    raw = await chat_completion(system=system, messages=messages, max_tokens=600)
    clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()

    try:
        result = json.loads(clean)
        return result
    except json.JSONDecodeError:
        log.warning("explanation: JSON parse failed, returning raw text")
        return {
            "insight": raw[:200],
            "explanation": "",
            "key_observations": [],
            "recommendations": [],
        }
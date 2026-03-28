"""
Auto Analysis Pipeline

Features:
- Intelligent question generation (profile-aware)
- Robust JSON parsing
- Retry logic for failed queries
- Parallel execution
- Logging + fallbacks
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from data_analyst_agent.tools.data_profiler import profile_dataset, profile_summary_text
from data_analyst_agent.tools.llm_client import chat_completion

log = logging.getLogger("auto-analysis")

MAX_QUESTIONS = 5
MAX_RETRIES = 2

GENERATE_QUESTIONS_SYSTEM = """\
You are a senior data analyst. Given a dataset schema and data profile, generate \
exactly {n} highly specific and practical business questions that can be answered \
via SQL against the dataset.

Rules:
- Focus on insights, trends, anomalies, and comparisons visible in the data
- Reference actual column names from the schema
- Must be answerable with a single SQLite SELECT query
- Mix easy and advanced questions
- No duplicates

Return ONLY a valid JSON array of strings. No markdown. No explanation.
Example: ["Q1?", "Q2?", "Q3?"]"""


def _safe_parse_questions(content: str) -> List[str]:
    """Safely parse a JSON array of strings from an LLM response."""
    try:
        content = content.strip()
        if content.startswith("```"):
            content = content.split("```")[1].strip()
        if content.lower().startswith("json"):
            content = content[4:].strip()
        parsed = json.loads(content)
        if not isinstance(parsed, list):
            raise ValueError("Parsed output is not a list")
        return [str(q) for q in parsed]
    except Exception as e:
        log.error("Question JSON parsing failed: %s | Raw: %s", str(e), content[:200])
        return [
            "What are the top trends in this dataset?",
            "Which category has the highest values?",
            "Are there patterns over time?",
            "Which segments perform best?",
            "What anomalies exist in the data?",
        ]


async def generate_questions(schema: dict, profile_summary: str = "") -> List[str]:
    """Ask the LLM to generate business questions tailored to the dataset."""
    schema_text = json.dumps(
        {
            "columns": schema.get("columns", []),
            "column_types": schema.get("column_types", {}),
            "row_count": schema.get("row_count", 0),
            "sample_rows": schema.get("sample_rows", [])[:3],
        },
        indent=2,
        default=str,
    )

    profile_section = (
        f"\nData profile:\n{profile_summary}\n" if profile_summary else ""
    )

    system = GENERATE_QUESTIONS_SYSTEM.format(n=MAX_QUESTIONS)
    messages = [
        {
            "role": "user",
            "content": (
                f"Dataset schema:\n{schema_text}"
                f"{profile_section}\n\n"
                f"Generate {MAX_QUESTIONS} insightful business questions."
            ),
        }
    ]

    try:
        content = await chat_completion(
            system=system,
            messages=messages,
            temperature=0.7,
            max_tokens=400,
        )
        questions = _safe_parse_questions(content)
        return questions[:MAX_QUESTIONS]
    except Exception as e:
        log.error("Question generation failed: %s", str(e))
        return [
            "What are the top performing categories?",
            "Which entries have the highest values?",
            "How does performance vary across segments?",
            "Are there trends over time?",
            "What are the key outliers?",
        ]


async def run_with_retry(agent, db_path: Path, question: str) -> Dict[str, Any]:
    """Execute one question against the agent with up to MAX_RETRIES attempts."""
    attempt = 0
    last_error = None

    while attempt <= MAX_RETRIES:
        try:
            query = question

            if attempt > 0:
                query = (
                    f"{question}\n\n"
                    "IMPORTANT:\n"
                    "- Fix any SQL errors\n"
                    "- Column names with spaces MUST use double quotes\n"
                    "- Use SQLite-compatible syntax (strftime for dates, || for string concat)\n"
                )

            result = await agent.run(db_path=db_path, query=query)

            if result.get("error"):
                raise Exception(result["error"])

            return {
                "question": question,
                "status": "success",
                "attempt": attempt + 1,
                "result": result,
            }

        except Exception as e:
            last_error = str(e)
            log.warning(
                "Attempt %d failed for '%s': %s",
                attempt + 1,
                question,
                last_error,
            )
            attempt += 1

    return {
        "question": question,
        "status": "error",
        "attempt": MAX_RETRIES + 1,
        "error": last_error,
    }


async def run_auto_analysis(
    agent,
    db_path: Path,
    schema: dict,
) -> List[Dict[str, Any]]:
    """
    Generate business questions from the schema + data profile,
    then execute them in parallel with retry logic.
    """
    # Compute profile to improve question quality
    try:
        profile = profile_dataset(db_path)
        summary = profile_summary_text(profile)
    except Exception as e:
        log.warning("Could not compute profile for question generation: %s", e)
        summary = ""

    questions = await generate_questions(schema, profile_summary=summary)

    if not questions:
        log.warning("No questions generated")
        return []

    log.info("Running auto-analysis for %d questions", len(questions))

    tasks = [run_with_retry(agent, db_path, q) for q in questions]
    results = await asyncio.gather(*tasks)

    return list(results)

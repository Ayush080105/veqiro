"""
Auto Analysis Helper (Production Ready)

Features:
- Intelligent question generation
- Robust JSON parsing
- Retry logic for failed queries
- Parallel execution
- Logging + fallbacks
"""

from typing import List, Dict, Any
from openai import AsyncOpenAI
import os
import json
import asyncio
import logging
from dotenv import load_dotenv

# ─────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────
load_dotenv()

log = logging.getLogger("auto-analysis")

client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

MAX_QUESTIONS = 5
LLM_TIMEOUT = 20
MAX_RETRIES = 2


# ─────────────────────────────────────────────
# Utils
# ─────────────────────────────────────────────
def safe_json_parse(content: str) -> List[str]:
    """
    Safely parse JSON from LLM response.
    Handles:
    - ```json blocks
    - 'json\n[...]'
    - malformed responses
    """
    try:
        content = content.strip()

        # Remove ```json blocks
        if content.startswith("```"):
            content = content.split("```")[1].strip()

        # Remove leading "json"
        if content.lower().startswith("json"):
            content = content[4:].strip()

        parsed = json.loads(content)

        if not isinstance(parsed, list):
            raise ValueError("Parsed output is not a list")

        return parsed

    except Exception as e:
        log.error("JSON parsing failed: %s | Raw: %s", str(e), content)

        # Fallback questions
        return [
            "What are the top trends in this dataset?",
            "Which category has the highest values?",
            "Are there patterns over time?",
            "Which segments perform best?",
            "What anomalies exist?"
        ]


# ─────────────────────────────────────────────
# 1. Generate Questions
# ─────────────────────────────────────────────
async def generate_questions(schema: str) -> List[str]:
    prompt = f"""
You are a senior data analyst.

Given this dataset schema:
{schema}

Generate {MAX_QUESTIONS} highly relevant and practical business questions.

Rules:
- Focus on insights, trends, comparisons
- Avoid generic or vague questions
- Must be answerable via SQL
- Mix easy + advanced
- Avoid duplicates

STRICT:
- Return ONLY a valid JSON array
- Do NOT include 'json'
- Do NOT use markdown

Example:
["Q1", "Q2", "Q3"]
"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            timeout=LLM_TIMEOUT,
        )

        content = response.choices[0].message.content
        questions = safe_json_parse(content)

        return questions[:MAX_QUESTIONS]

    except Exception as e:
        log.error("Question generation failed: %s", str(e))

        return [
            "What are the top performing categories?",
            "Which entries have the highest values?",
            "How does performance vary across segments?",
            "Are there trends over time?",
            "What are the key outliers?"
        ]


# ─────────────────────────────────────────────
# Retry Wrapper
# ─────────────────────────────────────────────
async def run_with_retry(agent, csv_path, question: str) -> Dict[str, Any]:
    attempt = 0
    last_error = None

    while attempt <= MAX_RETRIES:
        try:
            query = question

            # Add correction hint after first failure
            if attempt > 0:
                query = f"""
{question}

IMPORTANT:
- Fix SQL errors if any
- Column names with spaces MUST use double quotes
- Use valid DuckDB SQL syntax
"""

            result = await agent.run(
                csv_path=csv_path,
                query=query
            )

            # Agent-level error
            if result.get("error"):
                raise Exception(result["error"])

            return {
                "question": question,
                "status": "success",
                "attempt": attempt + 1,
                "result": result
            }

        except Exception as e:
            last_error = str(e)
            log.warning(
                "Attempt %d failed for '%s': %s",
                attempt + 1,
                question,
                last_error
            )
            attempt += 1

    return {
        "question": question,
        "status": "error",
        "attempt": MAX_RETRIES + 1,
        "error": last_error
    }


# ─────────────────────────────────────────────
# 2. Main Pipeline
# ─────────────────────────────────────────────
async def run_auto_analysis(
    agent,
    csv_path,
    schema: str
) -> List[Dict[str, Any]]:

    questions = await generate_questions(schema)

    if not questions:
        log.warning("No questions generated")
        return []

    log.info("Running analysis for %d questions", len(questions))

    # Parallel execution with retry
    tasks = [
        run_with_retry(agent, csv_path, q)
        for q in questions
    ]

    results = await asyncio.gather(*tasks)

    return results
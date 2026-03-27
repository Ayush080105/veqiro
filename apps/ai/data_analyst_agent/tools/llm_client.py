"""
tools/llm_client.py

Thin async wrapper around the OpenAI Chat Completions API.
Loads API key from environment (via .env).

Centralising all LLM calls here makes it easy to:
  - Swap to another provider (Anthropic, Groq, Mistral…)
  - Add retry logic
  - Add cost tracking / logging
"""

import logging
import os

from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAIError

load_dotenv()

log = logging.getLogger("ai-analyst.llm_client")

_client: AsyncOpenAI | None = None

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. "
                "Add it to your .env file or environment variables."
            )
        _client = AsyncOpenAI(api_key=api_key)
    return _client


async def chat_completion(
    *,
    system: str,
    messages: list[dict],
    max_tokens: int = 800,
    temperature: float = 0.0,
    model: str | None = None,
) -> str:
    """
    Call the OpenAI Chat API and return the assistant's text response.

    Args:
        system      : System prompt string.
        messages    : List of {"role": ..., "content": ...} dicts.
        max_tokens  : Maximum tokens to generate.
        temperature : Sampling temperature (0 = deterministic).
        model       : Override model (defaults to DEFAULT_MODEL env var).

    Returns:
        The assistant's text content as a string.

    Raises:
        RuntimeError: On API or parsing failure.
    """
    resolved_model = model or DEFAULT_MODEL
    full_messages = [{"role": "system", "content": system}] + messages

    try:
        client = _get_client()
        response = await client.chat.completions.create(
            model=resolved_model,
            messages=full_messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = response.choices[0].message.content or ""
        log.debug(
            "LLM call complete | model=%s | tokens_used=%s",
            resolved_model,
            response.usage.total_tokens if response.usage else "?",
        )
        return content

    except OpenAIError as exc:
        log.error("OpenAI API error: %s", exc)
        raise RuntimeError(f"LLM call failed: {exc}") from exc
"""Live check that the main model (Claude) answers through every LLMClient path.

    cd apps/ai && ./venv/Scripts/python scripts/anthropic_smoke.py

Needs ANTHROPIC_API_KEY in apps/ai/.env. Makes 6 small real requests (a few cents) and
prints PASS/FAIL per path; exits 1 if any failed. Nothing touches the database.
"""

import asyncio
import os
import sys
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parents[1]
os.chdir(AI_ROOT)  # core.config reads .env relative to the cwd
sys.path.insert(0, str(AI_ROOT))
os.environ["MOCK_MODE"] = "false"
os.environ["LANGFUSE_PUBLIC_KEY"] = ""
os.environ["LANGFUSE_SECRET_KEY"] = ""

from core.config import settings  # noqa: E402
from core.llm import LLMClient, MAIN_MODEL  # noqa: E402
from core.tools import ToolDefinition, ToolParameter, format_tool_result_messages, ToolResult  # noqa: E402

USER = [{"role": "user", "content": "Reply with exactly the word: pong"}]
ECHO = ToolDefinition(
    name="echo",
    description="Echo a word back. Use it whenever the user asks you to echo something.",
    parameters=[ToolParameter(name="word", type="string", description="The word to echo")],
)


async def main() -> int:
    if settings.ANTHROPIC_API_KEY in ("", "mock-key"):
        print("ANTHROPIC_API_KEY is not set in apps/ai/.env")
        return 1
    provider, model = MAIN_MODEL
    print(f"main model: {provider} / {model}\n")
    llm = LLMClient()
    failures = 0

    async def check(name, coro, ok):
        nonlocal failures
        try:
            out = await coro
            if ok(out):
                print(f"PASS {name}: {str(out)[:80]!r}")
                return out
            print(f"FAIL {name}: unexpected {out!r}")
        except Exception as e:
            print(f"FAIL {name}: {type(e).__name__}: {e}")
        failures += 1
        return None

    await check("complete", llm.complete(provider, model, "Be terse.", USER), lambda o: "pong" in o.lower())

    await check(
        "complete_json",
        llm.complete_json(provider, model, 'Return {"status": "ok"}.', [{"role": "user", "content": "status?"}]),
        lambda o: isinstance(o, dict) and o.get("status") == "ok",
    )

    async def collect():
        return "".join([t async for t in llm.stream(provider, model, "Be terse.", USER)])
    await check("stream", collect(), lambda o: "pong" in o.lower())

    ask = [{"role": "user", "content": "Echo the word banana using the echo tool."}]
    first = await check(
        "complete_with_tools (call)",
        llm.complete_with_tools(provider, model, "Use tools when asked.", ask, [ECHO]),
        lambda r: r.finish_reason == "tool_calls" and r.tool_calls[0].name == "echo",
    )
    if first:
        tc = first.tool_calls[0]
        history = ask + format_tool_result_messages(
            provider, [tc], [ToolResult(tool_call_id=tc.id, name="echo", content=str(tc.arguments.get("word")))]
        )
        await check(
            "complete_with_tools (answer after result)",
            llm.complete_with_tools(provider, model, "Use tools when asked.", history, [ECHO]),
            lambda r: r.finish_reason == "stop" and "banana" in (r.content or "").lower(),
        )
        # The agent tool loop's circuit breaker: a final text answer over tool history,
        # with no tools passed.
        await check(
            "complete over tool history (no tools)",
            llm.complete(provider, model, "Answer in one word.", history + [
                {"role": "user", "content": "Which word did the tool echo?"}
            ]),
            lambda o: "banana" in o.lower(),
        )

    print(f"\n{'ALL PASS' if not failures else f'{failures} FAILED'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

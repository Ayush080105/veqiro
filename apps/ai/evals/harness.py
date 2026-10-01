"""Runs cases against the real FastAPI app, in-process, the way the server calls it.

Isolation — an eval must never touch anything a customer can see:
  - no database: the pool raises, and RAG returns the case's own fixture chunks;
  - no Langfuse traces, no Sentry, no brand-kit fetches from the live server;
  - no image or video generation: images return a 1px stub, video raises. (Cost, and none of
    the cases grade pixels.)

Call setup_env() before importing anything from core/ or agents/: settings are read at import.
"""
from __future__ import annotations

import asyncio
import contextvars
import json
import os
import sys
import time
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parent.parent
INTERNAL_KEY = "eval-internal-key"

_current = contextvars.ContextVar("eval_trial", default=None)

# $ per 1M tokens (input, output). Unknown models report tokens without a cost.
PRICES = {
    "gpt-6-luna": (0.10, 0.50),
    "gpt-5.6-luna": (0.20, 1.20),
    "gpt-6-sol": (2.0, 10.0),
}

_TINY_PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def setup_env() -> None:
    os.chdir(AI_ROOT)                 # core.config reads .env relative to the cwd
    sys.path.insert(0, str(AI_ROOT))
    os.environ.update({
        "MOCK_MODE": "false",
        "INTERNAL_API_KEY": INTERNAL_KEY,
        "LANGFUSE_PUBLIC_KEY": "",
        "LANGFUSE_SECRET_KEY": "",
        "SENTRY_DSN": "",
        # Unreachable on purpose: nothing in an eval may read or write a real database or server.
        "DATABASE_URL": "postgresql://evals:disabled@127.0.0.1:9/evals_have_no_database",
        "BRAND_KIT_SERVICE_URL": "http://127.0.0.1:9",
    })


def install_stubs(model_override: str | None) -> None:
    import core.brand_kit as brand_kit
    import core.db as db
    import core.llm as llm
    import core.rag as rag
    from evals.personas import BRAND_KITS
    from openai.resources.chat.completions import AsyncCompletions

    for org, kit in BRAND_KITS.items():
        brand_kit._cache[org] = (kit, float("inf"))

    async def no_db(*_a, **_k):
        raise RuntimeError("database is disabled in evals")
    db.get_pool = no_db

    async def fixture_retrieve(self, user_id, query, top_k=5, *a, **k):
        state = _current.get()
        return list((state or {}).get("rag_chunks") or [])[:top_k]

    async def fixture_by_source(self, user_id, source_id, *a, **k):
        state = _current.get()
        return list((state or {}).get("rag_chunks") or [])
    rag.RAGService.retrieve = fixture_retrieve
    rag.RAGService.retrieve_by_source = fixture_by_source

    async def stub_image(self, *a, **k):
        state = _current.get()
        if state is not None:
            state["images_stubbed"] += 1
        return _TINY_PNG
    for name in ("generate_image", "generate_image_with_reference",
                 "generate_image_with_references", "generate_image_with_image_bytes"):
        setattr(llm.LLMClient, name, stub_image)

    async def no_video(*_a, **_k):
        raise RuntimeError("video generation is disabled in evals")
    llm.LLMClient.generate_video = no_video
    try:
        import core.video_gen as video_gen
        video_gen.generate_maya_video = no_video
        video_gen.generate_video_storyboard = no_video
    except ImportError:
        pass

    # Uploads: production sends a presigned R2 link; cases send fixture://<file> instead.
    import agents.rex.dataset_sql as dataset_sql
    real_fetch = dataset_sql.fetch_file

    async def fetch_fixture(url: str) -> bytes:
        if url.startswith("fixture://"):
            path = AI_ROOT / "evals" / "fixtures" / url[len("fixture://"):]
            if not path.exists():
                raise FileNotFoundError(f"404 for {url}")
            return path.read_bytes()
        return await real_fetch(url)
    dataset_sql.fetch_file = fetch_fixture

    async def fetch_case_dataset(organization_id: str, dataset_id: str):
        from evals.case import DATASETS
        return DATASETS.get(dataset_id)
    dataset_sql.fetch_dataset = fetch_case_dataset

    original_create = AsyncCompletions.create

    async def create(self, *args, **kwargs):
        if model_override and str(kwargs.get("model", "")).startswith("gpt-"):
            kwargs["model"] = model_override
        resp = await original_create(self, *args, **kwargs)
        state = _current.get()
        usage = getattr(resp, "usage", None)
        if state is not None and usage is not None:
            m = kwargs.get("model", "?")
            state["tokens"].setdefault(m, [0, 0])
            state["tokens"][m][0] += usage.prompt_tokens or 0
            state["tokens"][m][1] += usage.completion_tokens or 0
        return resp
    AsyncCompletions.create = create


def cost_of(tokens: dict[str, list[int]]) -> float | None:
    total = 0.0
    for model, (tin, tout) in tokens.items():
        if model not in PRICES:
            return None
        pin, pout = PRICES[model]
        total += tin / 1e6 * pin + tout / 1e6 * pout
    return total


async def run_trial(client, case, trial_no: int) -> dict:
    from evals.graders import Grade, Trial, http_ok, within

    state = {"rag_chunks": case.rag_chunks, "tokens": {}, "images_stubbed": 0}
    token = _current.set(state)
    t0 = time.perf_counter()
    try:
        resp = await client.post(case.endpoint, json=case.payload, timeout=max(180, case.latency_s * 3))
        status = resp.status_code
        try:
            body = resp.json()
        except ValueError:
            body = resp.text
    except Exception as err:  # the app raised instead of answering
        status, body = 599, f"{type(err).__name__}: {err}"
    latency = time.perf_counter() - t0
    _current.reset(token)
    if case.endpoint.endswith("/chat") and isinstance(body, dict):
        # What the customer sees in chat: the reply, plus any card an action produced.
        card = body.get("action_result")
        body["_visible"] = (body.get("response") or "") + (
            "\n\n" + json.dumps(card, ensure_ascii=False) if card else "")

    trial = Trial(case=case, request=case.payload, status=status, body=body, latency_s=latency)
    grades: list[Grade] = [http_ok()(trial), within(case.latency_s)(trial)]
    if status == 200:
        for grader in case.graders:
            try:
                out = grader(trial)
                if asyncio.iscoroutine(out):
                    out = await out
            except Exception as err:  # a broken grader fails its check, never the run
                out = Grade(getattr(grader, "__qualname__", "grader"), "harness", False,
                            f"grader crashed: {type(err).__name__}: {err}")
            grades.extend(out if isinstance(out, list) else [out])
    return {
        "case": case.id, "trial": trial_no, "status": status, "latency_s": round(latency, 2),
        "passed": all(g.passed for g in grades),
        "grades": [g.__dict__ for g in grades],
        "tokens": state["tokens"], "cost_usd": cost_of(state["tokens"]),
        "images_stubbed": state["images_stubbed"],
        "response": body,
    }


async def run_all(cases, trials: int, concurrency: int, on_done=None) -> list[dict]:
    import httpx
    from api.main import app

    sem = asyncio.Semaphore(concurrency)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://evals",
                                 headers={"x-internal-api-key": INTERNAL_KEY}) as client:
        async def one(case, i):
            async with sem:
                r = await run_trial(client, case, i)
            if on_done:
                on_done(case, r)
            return r
        return await asyncio.gather(*[one(c, i) for c in cases for i in range(1, trials + 1)])


def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False, default=str), encoding="utf-8")

"""How the executor talks to run state.

Node owns the `agent_run` tables and every authorisation decision; this service
owns planning and execution. The executor therefore never touches Postgres —
it reports transitions over the internal REST channel, the same pattern
core/mcp/client.py already uses for tool calls.

Expressed as a Protocol so executor tests run against InMemoryRunStore with no
network at all. That matters: the DAG scheduling logic is the part most worth
testing exhaustively, and it should not need a live Node to do it.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from core.config import settings

logger = logging.getLogger("run_store")


@dataclass
class WriteRequest:
    """A write an executing step wants to perform."""

    connection_id: str
    tool_name: str
    arguments: dict
    summary: str


@dataclass
class WriteResult:
    """Node's verdict on a write.

    `requires_approval` means the write was not in the plan the user approved,
    so nothing was created and the run must pause rather than proceed.
    """

    executed: bool
    result: Any = None
    error: str | None = None
    pending_action_id: str | None = None
    requires_approval: bool = False


class RunStore(Protocol):
    async def update_step(self, run_id: str, key: str, **fields: Any) -> None: ...

    async def heartbeat(self, run_id: str, tool_calls_used: int) -> dict: ...

    async def execute_write(
        self, run_id: str, key: str, call: WriteRequest
    ) -> WriteResult: ...

    async def finish(
        self, run_id: str, status: str, summary: str, error: str | None = None
    ) -> None: ...


class HttpRunStore:
    """Real implementation, talking to Node's internal run routes."""

    def __init__(self, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(timeout=20)

    def _url(self, path: str) -> str:
        return f"{settings.BRAND_KIT_SERVICE_URL}/api/v1/internal/runs/{path}"

    async def _post(self, path: str, payload: dict) -> dict:
        resp = await self._client.post(
            self._url(path),
            json=payload,
            headers={"x-internal-key": settings.INTERNAL_API_KEY},
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"run store {path} failed: {resp.status_code} {resp.text[:200]}")
        return resp.json() if resp.content else {}

    async def update_step(self, run_id: str, key: str, **fields: Any) -> None:
        # Status reporting must never take the run down with it — the step
        # itself already succeeded or failed on its own terms.
        try:
            await self._post(f"{run_id}/steps/{key}", fields)
        except Exception:
            logger.warning("step update failed | run=%s step=%s", run_id, key, exc_info=True)

    async def heartbeat(self, run_id: str, tool_calls_used: int) -> dict:
        try:
            return await self._post(f"{run_id}/heartbeat", {"toolCallsUsed": tool_calls_used})
        except Exception:
            # A missed heartbeat is recoverable: the sweeper only re-dispatches
            # after minutes of silence.
            logger.warning("heartbeat failed | run=%s", run_id, exc_info=True)
            return {}

    async def execute_write(self, run_id: str, key: str, call: WriteRequest) -> WriteResult:
        try:
            data = await self._post(
                f"{run_id}/steps/{key}/write",
                {
                    "connectionId": call.connection_id,
                    "toolName": call.tool_name,
                    "arguments": call.arguments,
                    "summary": call.summary,
                },
            )
        except Exception as exc:
            return WriteResult(executed=False, error=str(exc))
        return WriteResult(
            executed=bool(data.get("executed")),
            result=data.get("result"),
            error=data.get("error"),
            pending_action_id=data.get("pendingActionId"),
            requires_approval=bool(data.get("requiresApproval")),
        )

    async def finish(
        self, run_id: str, status: str, summary: str, error: str | None = None
    ) -> None:
        try:
            await self._post(
                f"{run_id}/finish",
                {"status": status, "summary": summary, "errorMessage": error},
            )
        except Exception:
            logger.error("finish failed | run=%s status=%s", run_id, status, exc_info=True)


@dataclass
class InMemoryRunStore:
    """Test double. Records everything and answers writes from a script."""

    steps: dict[str, dict] = field(default_factory=dict)
    heartbeats: list[int] = field(default_factory=list)
    writes: list[tuple[str, WriteRequest]] = field(default_factory=list)
    finished: dict | None = None
    #: Set to True to make the next heartbeat report the run as cancelled.
    cancelled: bool = False
    #: key -> WriteResult, consulted by execute_write.
    write_results: dict[str, WriteResult] = field(default_factory=dict)

    async def update_step(self, run_id: str, key: str, **fields: Any) -> None:
        self.steps.setdefault(key, {}).update(fields)

    async def heartbeat(self, run_id: str, tool_calls_used: int) -> dict:
        self.heartbeats.append(tool_calls_used)
        return {"cancelled": self.cancelled}

    async def execute_write(self, run_id: str, key: str, call: WriteRequest) -> WriteResult:
        self.writes.append((key, call))
        return self.write_results.get(key, WriteResult(executed=True, result={"ok": True}))

    async def finish(
        self, run_id: str, status: str, summary: str, error: str | None = None
    ) -> None:
        self.finished = {"status": status, "summary": summary, "error": error}

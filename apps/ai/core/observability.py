import logging
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("llm.observability")


@dataclass
class LLMObsContext:
    org_id: str = ""
    agent_slug: str = ""
    conversation_id: str = ""
    trace_id: Optional[str] = None  # set lazily on first LLM call per turn


_llm_context: ContextVar[LLMObsContext] = ContextVar(
    "llm_obs_context", default=LLMObsContext()
)


def set_llm_context(org_id: str = "", agent_slug: str = "", conversation_id: str = "") -> None:
    _llm_context.set(LLMObsContext(org_id=org_id, agent_slug=agent_slug, conversation_id=conversation_id))


def get_llm_context() -> LLMObsContext:
    return _llm_context.get()


_langfuse = None
_langfuse_initialized = False


def get_langfuse():
    global _langfuse, _langfuse_initialized
    if _langfuse_initialized:
        return _langfuse
    _langfuse_initialized = True
    try:
        from core.config import settings
        if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
            return None
        from langfuse import Langfuse
        _langfuse = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
        )
        logger.info("Langfuse observability initialized")
    except Exception as e:
        logger.warning(f"Langfuse init failed (observability disabled): {e}")
        _langfuse = None
    return _langfuse

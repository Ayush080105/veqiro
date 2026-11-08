"""The main chat model is chosen by settings, and defaults to Claude."""

from core.config import Settings


def test_defaults_point_at_anthropic():
    s = Settings(_env_file=None)
    assert s.MAIN_LLM_PROVIDER == "anthropic"
    assert s.MAIN_LLM_MODEL == "claude-opus-5-5"
    assert s.ANTHROPIC_EFFORT == "medium"
    assert s.ANTHROPIC_MIN_MAX_TOKENS == 16000
    assert s.ANTHROPIC_FALLBACKS is True
    assert s.ANTHROPIC_API_KEY == "mock-key"
    assert not hasattr(s, "SCOUT_MODEL")
    assert not hasattr(s, "SAGE_MODEL")


def test_main_model_can_be_rolled_back_to_openai(monkeypatch):
    monkeypatch.setenv("MAIN_LLM_PROVIDER", "openai")
    monkeypatch.setenv("MAIN_LLM_MODEL", "gpt-6-luna")
    s = Settings(_env_file=None)
    assert (s.MAIN_LLM_PROVIDER, s.MAIN_LLM_MODEL) == ("openai", "gpt-6-luna")


def test_no_hardcoded_openai_chat_model():
    """Every chat call site reads the model from settings; only the OpenAI rollback
    tuning in core/llm.py and the rollback note in core/config.py may name gpt-6-luna."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    allowed = {root / "core" / "llm.py", root / "core" / "config.py"}
    files = [root / "briefing.py", *(root / "agents").rglob("*.py"), *(root / "core").rglob("*.py")]
    offenders = [
        str(f.relative_to(root))
        for f in files
        if f not in allowed and "gpt-6-luna" in f.read_text(encoding="utf-8")
    ]
    assert offenders == []


def test_every_agent_uses_the_main_model():
    import importlib

    from core.config import settings
    from core.llm import MAIN_MODEL

    assert MAIN_MODEL == (settings.MAIN_LLM_PROVIDER, settings.MAIN_LLM_MODEL)
    for slug, cls in [("lex", "LexAgent"), ("maya", "MayaAgent"), ("rex", "RexAgent"),
                      ("sage", "SageAgent"), ("scout", "ScoutAgent"), ("vega", "VegaAgent")]:
        agent_cls = getattr(importlib.import_module(f"agents.{slug}.agent"), cls)
        assert (agent_cls.default_provider, agent_cls.default_model) == MAIN_MODEL, slug


def test_missing_anthropic_key_is_detected(monkeypatch):
    from core.config import main_llm_key_missing

    for k in ("ANTHROPIC_API_KEY", "MAIN_LLM_PROVIDER", "MOCK_MODE"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("MOCK_MODE", "false")
    assert main_llm_key_missing(Settings(_env_file=None)) is True
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-real")
    assert main_llm_key_missing(Settings(_env_file=None)) is False
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("MAIN_LLM_PROVIDER", "openai")  # rolled back: Claude key not needed
    assert main_llm_key_missing(Settings(_env_file=None)) is False
    monkeypatch.setenv("MAIN_LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("MOCK_MODE", "true")  # mock mode never calls the API
    assert main_llm_key_missing(Settings(_env_file=None)) is False


def test_ready_reports_missing_anthropic_key(monkeypatch):
    import asyncio

    import api.main as main
    from core.config import settings

    monkeypatch.setattr(settings, "MOCK_MODE", False)
    monkeypatch.setattr(settings, "MAIN_LLM_PROVIDER", "anthropic")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "mock-key")
    assert asyncio.run(main.ready())["anthropic"] is False
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-real")
    assert asyncio.run(main.ready())["anthropic"] is True

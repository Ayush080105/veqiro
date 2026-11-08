"""LLMClient's "anthropic" provider, against a fake SDK client (no network)."""

from types import SimpleNamespace

import pytest

import core.llm as llm_mod
from core.config import settings
from core.exceptions import LLMError
from core.llm import LLMClient
from core.tools import ToolDefinition, ToolParameter

pytestmark = pytest.mark.asyncio

MODEL = "claude-opus-5-5"


def _text(t):
    return SimpleNamespace(type="text", text=t)


def _thinking():
    return SimpleNamespace(type="thinking", thinking="", signature="sig")


def _tool_use(id_, name, input_):
    return SimpleNamespace(type="tool_use", id=id_, name=name, input=input_)


def _message(content, stop_reason="end_turn", category=None):
    return SimpleNamespace(
        content=content,
        stop_reason=stop_reason,
        stop_details=SimpleNamespace(category=category) if category else None,
        usage=SimpleNamespace(input_tokens=11, output_tokens=7),
    )


class _Stream:
    def __init__(self, message):
        self._message = message

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    @property
    def text_stream(self):
        async def gen():
            for b in self._message.content:
                if b.type == "text":
                    yield b.text
        return gen()

    async def get_final_message(self):
        return self._message


class FakeAnthropic:
    """Records every request; answers with the queued messages in order."""

    def __init__(self, *messages):
        self.queue = list(messages)
        self.calls: list[dict] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    def _stream(self, **kwargs):
        self.calls.append(kwargs)
        msg = self.queue.pop(0) if len(self.queue) > 1 else self.queue[0]
        return _Stream(msg)


@pytest.fixture
def fake(monkeypatch):
    monkeypatch.setattr(settings, "MOCK_MODE", False)
    monkeypatch.setattr(settings, "ANTHROPIC_FALLBACKS", True)
    import core.observability as obs
    monkeypatch.setattr(obs, "get_langfuse", lambda: None)

    def install(*messages):
        client = FakeAnthropic(*messages)
        monkeypatch.setattr(llm_mod, "_anthropic_client", lambda: client)
        return client
    return install


async def test_no_sampling_params_sent(fake):
    client = fake(_message([_text("hi")]))
    out = await LLMClient().complete("anthropic", MODEL, "sys", [{"role": "user", "content": "q"}], temperature=0.9)
    assert out == "hi"
    sent = client.calls[0]
    assert "temperature" not in sent and "thinking" not in sent
    assert sent["model"] == MODEL
    assert sent["system"] == "sys"
    assert sent["output_config"] == {"effort": settings.ANTHROPIC_EFFORT}
    assert sent["messages"] == [{"role": "user", "content": [{"type": "text", "text": "q"}]}]
    assert sent["fallbacks"] == "default"
    assert sent["betas"] == ["server-side-fallback-2026-07-01"]


async def test_fallbacks_can_be_turned_off(fake, monkeypatch):
    client = fake(_message([_text("hi")]))
    monkeypatch.setattr(settings, "ANTHROPIC_FALLBACKS", False)
    await LLMClient().complete("anthropic", MODEL, "sys", [{"role": "user", "content": "q"}])
    assert "fallbacks" not in client.calls[0] and "betas" not in client.calls[0]


async def test_empty_system_is_omitted(fake):
    client = fake(_message([_text("hi")]))
    await LLMClient().complete("anthropic", MODEL, "", [{"role": "user", "content": "q"}])
    assert "system" not in client.calls[0]


async def test_max_tokens_floor(fake):
    client = fake(_message([_text("a")]))
    await LLMClient().complete("anthropic", MODEL, "s", [{"role": "user", "content": "q"}], max_tokens=4096)
    await LLMClient().complete("anthropic", MODEL, "s", [{"role": "user", "content": "q"}], max_tokens=20000)
    assert [c["max_tokens"] for c in client.calls] == [16000, 20000]


async def test_text_read_by_block_type(fake):
    fake(_message([_thinking(), _text("hello")]))
    out = await LLMClient().complete("anthropic", MODEL, "s", [{"role": "user", "content": "q"}])
    assert out == "hello"


async def test_json_mode_adds_instruction(fake):
    client = fake(_message([_text('{"a": 1}')]))
    out = await LLMClient().complete_json("anthropic", MODEL, "Return the data.", [{"role": "user", "content": "q"}])
    assert out == {"a": 1}
    assert client.calls[0]["system"].startswith("Return the data.")
    assert "Respond with only a single valid JSON value" in client.calls[0]["system"]


async def test_response_format_on_complete_is_json_mode(fake):
    client = fake(_message([_text("{}")]))
    await LLMClient().complete(
        "anthropic", MODEL, "s", [{"role": "user", "content": "q"}], response_format={"type": "json_object"}
    )
    assert "Respond with only a single valid JSON value" in client.calls[0]["system"]


async def test_stream_yields_text(fake):
    fake(_message([_thinking(), _text("one "), _text("two")]))
    tokens = [t async for t in LLMClient().stream("anthropic", MODEL, "s", [{"role": "user", "content": "q"}])]
    assert "".join(tokens) == "one two"


def _tools():
    return [ToolDefinition(name="search", description="d", parameters=[ToolParameter(name="q", type="string", description="q")])]


async def test_tools_round_trip(fake):
    client = fake(_message([_thinking(), _tool_use("toolu_1", "search", {"q": "x"})], stop_reason="tool_use"))
    resp = await LLMClient().complete_with_tools("anthropic", MODEL, "s", [{"role": "user", "content": "q"}], _tools())
    assert resp.finish_reason == "tool_calls"
    assert resp.tool_calls[0].id == "toolu_1"
    assert resp.tool_calls[0].arguments == {"q": "x"}
    assert client.calls[0]["tool_choice"] == {"type": "auto"}
    assert client.calls[0]["tools"][0]["name"] == "search"


async def test_tool_choice_none(fake):
    client = fake(_message([_text("final")]))
    resp = await LLMClient().complete_with_tools(
        "anthropic", MODEL, "s", [{"role": "user", "content": "q"}], _tools(), tool_choice="none"
    )
    assert resp.finish_reason == "stop" and resp.content == "final"
    assert client.calls[0]["tool_choice"] == {"type": "none"}


async def test_refusal_raises_without_retry(fake):
    client = fake(_message([], stop_reason="refusal", category="cyber"))
    with pytest.raises(LLMError, match="declined"):
        await LLMClient().complete("anthropic", MODEL, "s", [{"role": "user", "content": "q"}])
    assert len(client.calls) == 1


async def test_refusal_in_complete_json_not_retried(fake):
    client = fake(_message([], stop_reason="refusal", category="bio"))
    with pytest.raises(LLMError, match="declined"):
        await LLMClient().complete_json("anthropic", MODEL, "s", [{"role": "user", "content": "q"}])
    assert len(client.calls) == 1


async def test_openai_path_untouched(fake, monkeypatch):
    client = fake(_message([_text("x")]))
    seen = {}

    async def fake_openai(self, model, *a, **k):
        seen["model"] = model
        return "from-openai", 1, 1
    monkeypatch.setattr(LLMClient, "_openai_complete", fake_openai)
    out = await LLMClient().complete("openai", "gpt-6-luna", "s", [{"role": "user", "content": "q"}])
    assert out == "from-openai" and seen["model"] == "gpt-6-luna"
    assert client.calls == []

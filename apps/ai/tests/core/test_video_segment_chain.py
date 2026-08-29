"""Covers the 10s-segment extension chain in LLMClient.generate_video (core/llm.py).

Longer videos are built by chaining extensions: each call renders one 10-second segment off
`previous_interaction_id` and returns the CUMULATIVE clip, so the last interaction holds the
whole video. Two properties matter enough to pin down here, because both cost real money to
get wrong:

  * retries are scoped to ONE segment, not the whole chain. Each segment is a separate billed
    render (~$1), so a failure on segment 3 of 4 must re-render only segment 3 — restarting
    from the top would re-pay for the two that already succeeded.
  * a retry must RESUME: its `previous_interaction_id` still has to point at the last
    successful segment, otherwise the "cheap" retry silently produces a 10s video instead of
    continuing the 40s one.
"""

import asyncio
import base64

import pytest

from core import llm as llm_module
from core.llm import LLMClient


class _FakeVideo:
    def __init__(self, data: str):
        self.data = data
        self.uri = None


class _FakeInteraction:
    def __init__(self, ident: str, data: str):
        self.id = ident
        self.status = "completed"
        self.output_video = _FakeVideo(data)


class _FakeInteractions:
    """Records every create call so the test can assert what was re-rendered."""

    def __init__(self, fail_on: dict[int, int] | None = None):
        # {0-based call index of a segment: how many times it should fail first}
        self.fail_on = fail_on or {}
        self.calls: list[dict] = []
        self._segment_index = 0

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        index = self._segment_index
        remaining = self.fail_on.get(index, 0)
        if remaining:
            self.fail_on[index] = remaining - 1
            raise RuntimeError(f"transient failure on segment {index + 1}")
        self._segment_index += 1
        payload = base64.b64encode(f"segment-{index + 1}".encode()).decode()
        return _FakeInteraction(f"id-seg-{index + 1}", payload)


class _FakeAio:
    def __init__(self, interactions):
        self.interactions = interactions
        self.files = None


class _FakeClient:
    def __init__(self, interactions):
        self.aio = _FakeAio(interactions)


@pytest.fixture
def live_video(monkeypatch):
    """generate_video short-circuits in MOCK_MODE, so the chain needs it off."""
    monkeypatch.setattr(llm_module.settings, "MOCK_MODE", False, raising=False)
    monkeypatch.setattr(llm_module.settings, "GEMINI_API_KEY", "test-key", raising=False)
    # No backoff sleeps — the retry path is exercised, not its wall-clock. The real sleep is
    # captured first: llm_module.asyncio IS the asyncio module, so a lambda that called
    # asyncio.sleep by name would recurse into its own patch.
    real_sleep = asyncio.sleep
    monkeypatch.setattr(llm_module.asyncio, "sleep", lambda *_a, **_k: real_sleep(0))


def _run(fake_interactions, segments=4):
    client = _FakeClient(fake_interactions)
    import google.genai as genai

    original = genai.Client
    genai.Client = lambda **_kwargs: client
    try:
        return asyncio.run(
            LLMClient().generate_video(
                segment_prompts=[f"segment {i + 1}" for i in range(segments)],
                aspect_ratio="9:16",
            )
        )
    finally:
        genai.Client = original


def test_chain_renders_one_call_per_segment(live_video):
    fake = _FakeInteractions()
    video = _run(fake, segments=4)

    assert len(fake.calls) == 4
    # The last interaction carries the cumulative clip.
    assert video == b"segment-4"

    # Only the opening shot may set aspect_ratio or carry images; extensions are rejected
    # by the API if they do, and must chain off the previous interaction instead.
    assert "aspect_ratio" in fake.calls[0]["response_format"]
    assert "previous_interaction_id" not in fake.calls[0]
    for call in fake.calls[1:]:
        assert "aspect_ratio" not in call["response_format"]
        assert call["previous_interaction_id"] is not None
    # store=True is what makes an interaction chainable at all.
    assert all(call["store"] is True for call in fake.calls)


def test_failed_segment_retries_alone_and_resumes(live_video):
    """Segment 3 fails once. Only segment 3 re-renders, and it resumes from segment 2."""
    fake = _FakeInteractions(fail_on={2: 1})
    video = _run(fake, segments=4)

    # 4 segments + exactly 1 retry — not a restart of the whole chain (which would be 7+).
    assert len(fake.calls) == 5
    assert video == b"segment-4"

    # The retry is the 4th call; it must continue from segment 2, not start over.
    retry = fake.calls[3]
    assert retry["previous_interaction_id"] == "id-seg-2"
    # And it must still be an extension, never a fresh opening shot.
    assert "aspect_ratio" not in retry["response_format"]


def test_segment_failure_gives_up_without_restarting_the_chain(live_video):
    """A segment that exhausts its attempts fails the render — it does not restart it."""
    fake = _FakeInteractions(fail_on={1: llm_module.VIDEO_SEGMENT_ATTEMPTS})

    with pytest.raises(llm_module.LLMError, match="segment 2/3"):
        _run(fake, segments=3)

    # 1 opening shot + exactly the allowed attempts on segment 2, then stop.
    assert len(fake.calls) == 1 + llm_module.VIDEO_SEGMENT_ATTEMPTS
    # Every attempt resumed from the opening shot rather than re-rendering it.
    for call in fake.calls[1:]:
        assert call["previous_interaction_id"] == "id-seg-1"

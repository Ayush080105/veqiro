"""Covers the speech-timing contract that keeps generated audio from being clipped.

The rendered audio is cut dead at the end of every 10-second segment — at a join between two
extensions exactly as hard as at the end of the film. The picture survives that (the model is
already told to end on a settled frame); speech does not, which is why a finished video reads
as "video ends fine, the last words are missing".

The fix is a timing budget rather than a plea: a lead-in, a speakable window, and a mandatory
speech-free tail on EVERY segment, with the word budget derived from the window instead of the
runtime. Three properties are worth pinning down, because each one silently reintroduces the
defect if it drifts:

  * the budget must be physically deliverable — words that only fit at a rushed pace produce
    the other half of the complaint ("it feels rushed") even when nothing is cut off;
  * the tail has to be stated to the RENDER model on every segment, not just the last, and not
    only to the planner — a plan that respects it and a renderer that never hears about it
    still yields a clipped seam;
  * the tail is speech-free, not silent: ambience has to run through the final frame, or the
    ending trades a clipped word for the sound dropping out.

Since the structured-plan pipeline, the planner is core/video_director.py and the render
prompts come from core/video_prompt_compiler.py; LLMClient.generate_video sends them verbatim.
"""

import asyncio
import base64

import pytest

from core import llm as llm_module
from core import video_director
from core.llm import (
    LLMClient,
    MAX_WORDS_PER_LINE,
    MAX_WORDS_PER_SEGMENT,
    SPEECH_CUTOFF_SECONDS,
    SPEECH_LEAD_IN_SECONDS,
    SPEECH_TAIL_SECONDS,
    SPEECH_WINDOW_SECONDS,
    SPEECH_WORDS_PER_SECOND,
    VIDEO_DURATION_OPTIONS,
    VIDEO_SEGMENT_SECONDS,
)
from core.video_prompt_compiler import compile_segment_prompts


# ── the budget has to be physically speakable ────────────────────────────────

def test_speech_window_leaves_a_real_tail():
    assert SPEECH_LEAD_IN_SECONDS + SPEECH_WINDOW_SECONDS == SPEECH_CUTOFF_SECONDS
    assert SPEECH_CUTOFF_SECONDS + SPEECH_TAIL_SECONDS == VIDEO_SEGMENT_SECONDS
    # A tail under a second is inside the model's own timing jitter — it would not survive a
    # line that starts a beat late, which is the case this whole contract exists for.
    assert SPEECH_TAIL_SECONDS >= 1.5


def test_word_budget_fits_the_window_at_an_unhurried_pace():
    """Every cap must be deliverable inside the window at the pace we claim, with air spare.

    Budgeting at read-aloud speed is what produced clipped endings: the words technically
    "fit" only if the speaker never breathes.
    """
    assert SPEECH_WORDS_PER_SECOND <= 2.2, "faster than unhurried commercial delivery"
    assert MAX_WORDS_PER_SEGMENT / SPEECH_WORDS_PER_SECOND <= SPEECH_WINDOW_SECONDS
    # One line may not eat the whole window, or a second line has nowhere to go and the film
    # ends on the tail of the only thing anyone said.
    assert MAX_WORDS_PER_LINE / SPEECH_WORDS_PER_SECOND <= SPEECH_WINDOW_SECONDS * 0.7
    assert MAX_WORDS_PER_LINE < MAX_WORDS_PER_SEGMENT


@pytest.mark.parametrize("duration", VIDEO_DURATION_OPTIONS)
def test_film_budget_never_exceeds_what_the_segments_can_carry(duration):
    segments = video_director.segments_for(duration)
    words, lines = video_director._speech_budget(segments)
    assert words <= MAX_WORDS_PER_SEGMENT * segments
    assert lines >= 1


# ── the director is told the same numbers, at every duration ─────────────────

@pytest.mark.parametrize("duration", VIDEO_DURATION_OPTIONS)
def test_director_prompt_states_the_tail_at_every_duration(duration):
    segments = video_director.segments_for(duration)
    system = video_director.build_director_system(duration, segments)
    assert f"{SPEECH_TAIL_SECONDS:g} second" in system
    assert f"{SPEECH_CUTOFF_SECONDS:g}-second mark" in system
    assert str(MAX_WORDS_PER_LINE) in system
    # "Finish sooner" without "use fewer words" is an instruction to speed-read, which reads
    # as abrupt for a different reason. Both halves have to be in the brief.
    assert "faster" in system.lower()
    assert f"EXACTLY {segments} segment" in system


# ── the RENDER prompts carry it too, on every segment ────────────────────────

def _prompts_for(num_segments: int) -> list[str]:
    plan = video_director.fallback_plan("a bottle of cold brew", num_segments, has_product=True)
    return compile_segment_prompts(
        plan, aspect_ratio="9:16", has_product_references=True, logo_attached=False
    )


def test_every_segment_is_told_to_stop_speaking_before_it_ends():
    """Not just the last one: a seam clips a running line inside the finished film."""
    prompts = _prompts_for(4)
    assert len(prompts) == 4
    for prompt in prompts:
        assert f"{SPEECH_TAIL_SECONDS:g} seconds carry no speech" in prompt
        assert f"{SPEECH_CUTOFF_SECONDS:g} seconds in" in prompt

    # The final segment resolves; the earlier ones hand off mid-motion but must still have
    # finished talking.
    *earlier, final = prompts
    assert "ENDING:" in final
    assert "HARD AUDIO CUT" not in final
    for prompt in earlier:
        assert "DO NOT END HERE" in prompt
        assert "HARD AUDIO CUT" in prompt
        assert "ENDING:" not in prompt


def test_final_segment_requires_sound_through_the_last_frame():
    """A speech-free tail must not become a silent one — that is a different abrupt ending."""
    final = _prompts_for(1)[-1]
    assert "THE SOUND RUNS TO THE VERY END" in final
    assert "ambience" in final.lower()
    # Shortening the line is the sanctioned fix; speeding it up is explicitly not.
    assert "SHORTEN" in final
    assert "double speed" in final


def test_extensions_start_a_new_line_rather_than_finishing_the_previous_one():
    """The previous segment stopped talking early on purpose — the extension must not try to
    pick that sentence back up, which would render as a stutter across the join."""
    _opening, *extensions = _prompts_for(3)
    assert "NEW line" not in _opening
    for prompt in extensions:
        assert "never open mid-sentence" in prompt
        assert "NEW line that starts and finishes inside this take" in prompt


# ── the API call itself, where the model actually reads it ───────────────────

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
    def __init__(self):
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        index = len(self.calls)
        return _FakeInteraction(
            f"id-seg-{index}", base64.b64encode(f"segment-{index}".encode()).decode()
        )


class _FakeClient:
    def __init__(self, interactions):
        self.aio = type("_Aio", (), {"interactions": interactions, "files": None})()


def test_compiled_prompts_reach_the_model_verbatim(monkeypatch):
    """generate_video must not append its own audio/continuity text on top of the compiled
    prompt: that is how the same rules used to reach the model three times over."""
    monkeypatch.setattr(llm_module.settings, "MOCK_MODE", False, raising=False)
    monkeypatch.setattr(llm_module.settings, "GEMINI_API_KEY", "test-key", raising=False)
    prompts = _prompts_for(3)
    fake = _FakeInteractions()
    import google.genai as genai

    original = genai.Client
    genai.Client = lambda **_kwargs: _FakeClient(fake)
    try:
        asyncio.run(
            LLMClient().generate_video(
                segment_prompts=prompts,
                images=[(b"img", "image/png")],
                aspect_ratio="9:16",
            )
        )
    finally:
        genai.Client = original

    assert len(fake.calls) == 3
    sent = [call["input"][-1]["text"] for call in fake.calls]
    assert sent == prompts
    # Images ride on the opening only; extensions are text alone.
    assert fake.calls[0]["input"][0]["type"] == "image"
    for call in fake.calls[1:]:
        assert [part["type"] for part in call["input"]] == ["text"]

"""Covers the structured video plan: validation, the speech budget it enforces, and the
director's retry-then-fallback path.

The director is an LLM, so everything a render depends on is enforced here in code rather
than trusted to the prompt: the exact segment count, dialogue that fits the speakable window,
and a continuity chain from one take to the next. None of these tests make a model call.
"""

import asyncio
import json

import pytest

from core import video_director
from core.llm import MAX_WORDS_PER_LINE, MAX_WORDS_PER_SEGMENT, VIDEO_DURATION_OPTIONS
from core.video_director import (
    FINAL_LINE_MAX_WORDS,
    PlanInvalid,
    VideoPlan,
    fallback_plan,
    parse_client_plan,
    plan_display_segments,
    plan_video,
    segments_for,
    validate_plan,
)


def _segment(action: str, **extra) -> dict:
    return {"primary_action": action, **extra}


def _raw(num_segments: int, **extra) -> dict:
    return {
        "format": "product_film",
        "concept": "a perfume bottle catching light",
        "product": {"description": "tall clear glass bottle, gold cap", "identity_cues": ["gold cap"]},
        "audio": {"ambience": "quiet studio room tone", "dialogue_mode": "none"},
        "segments": [
            _segment(f"action {i + 1}", shot_size="close-up", end_state=f"end {i + 1}")
            for i in range(num_segments)
        ],
        **extra,
    }


# ── structure ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("duration", VIDEO_DURATION_OPTIONS)
def test_segment_count_follows_duration(duration):
    n = segments_for(duration)
    assert n == duration // 10
    plan = validate_plan(_raw(n), n)
    assert len(plan.segments) == n
    assert [s.index for s in plan.segments] == list(range(1, n + 1))


def test_too_few_segments_is_invalid_rather_than_padded():
    """Padding by repeating the last segment renders the same shot twice."""
    with pytest.raises(PlanInvalid):
        validate_plan(_raw(2), 4)


def test_extra_segments_are_trimmed():
    plan = validate_plan(_raw(5), 3)
    assert [s.primary_action for s in plan.segments] == ["action 1", "action 2", "action 3"]


def test_segments_without_an_action_do_not_count():
    raw = _raw(2)
    raw["segments"].insert(1, {"primary_action": "   "})
    plan = validate_plan(raw, 2)
    assert [s.primary_action for s in plan.segments] == ["action 1", "action 2"]


def test_non_object_output_is_invalid():
    with pytest.raises(PlanInvalid):
        validate_plan(["not", "a", "plan"], 1)


def test_unknown_fields_and_bad_enums_degrade_instead_of_failing():
    raw = _raw(1, format="music video", surprise="ignored")
    raw["audio"]["dialogue_mode"] = "shouting"
    plan = validate_plan(raw, 1)
    assert plan.format == "product_film"
    assert plan.audio.dialogue_mode == "none"


def test_placeholder_values_are_treated_as_empty():
    raw = _raw(1)
    raw["segments"][0]["continuity"] = "N/A"
    raw["cast"] = "none"
    plan = validate_plan(raw, 1)
    assert plan.segments[0].continuity is None
    assert plan.cast is None


def test_strict_validation_rejects_a_sequenced_action():
    raw = _raw(2)
    raw["segments"][1]["primary_action"] = "dad pours granola into a bowl, then adds milk"
    with pytest.raises(PlanInvalid, match="more than one action"):
        validate_plan(raw, 2, strict=True)
    # Lenient (the corrective retry's second answer) accepts it rather than discarding the plan.
    assert validate_plan(raw, 2).segments[1].primary_action.endswith("adds milk")
    # A word that merely contains "then" is not a sequence.
    raw["segments"][1]["primary_action"] = "light strengthens across the bottle"
    validate_plan(raw, 2, strict=True)


def test_sequenced_action_triggers_the_corrective_retry():
    sequenced = _raw(1)
    sequenced["segments"][0]["primary_action"] = "she opens the jar, then smells it"
    llm = _FakeLLM([sequenced, _raw(1)])
    plan = _plan(llm, duration=10)
    assert len(llm.json_calls) == 2
    assert "more than one action" in llm.json_calls[1]["messages"][0]["content"]
    assert plan.segments[0].primary_action == "action 1"


def test_director_is_told_not_to_invent_product_details_without_photos():
    llm = _FakeLLM([_raw(1)])
    _plan(llm, duration=10)
    assert "No product photos are provided" in llm.json_calls[0]["messages"][0]["content"]


def test_fields_are_length_capped():
    raw = _raw(1)
    raw["segments"][0]["lens"] = "85mm " * 200
    plan = validate_plan(raw, 1)
    assert len(plan.segments[0].lens) <= 160


def test_continuity_chain_fills_start_state_from_previous_end_state():
    raw = _raw(3)
    raw["segments"][2]["start_state"] = "explicit start"
    plan = validate_plan(raw, 3)
    assert plan.segments[0].start_state is None
    assert plan.segments[1].start_state == "end 1"
    assert plan.segments[2].start_state == "explicit start"


# ── dialogue budget ──────────────────────────────────────────────────────────

def _words(n: int) -> str:
    return " ".join(["word"] * n)


def test_dialogue_is_stripped_when_the_plan_has_no_dialogue_mode():
    raw = _raw(1)
    raw["segments"][0]["dialogue"] = [{"speaker": "Ana", "line": "hello there"}]
    plan = validate_plan(raw, 1)
    assert plan.segments[0].dialogue == []


def test_over_long_lines_and_segment_overflow_are_dropped():
    raw = _raw(2)
    raw["audio"]["dialogue_mode"] = "on_camera"
    raw["segments"][0]["dialogue"] = [
        {"line": _words(MAX_WORDS_PER_LINE + 1)},   # too long for one line
        {"line": _words(MAX_WORDS_PER_LINE)},        # fits
        {"line": _words(MAX_WORDS_PER_LINE)},        # would overflow the segment budget
    ]
    plan = validate_plan(raw, 2)
    kept = plan.segments[0].dialogue
    assert sum(len(d.line.split()) for d in kept) <= MAX_WORDS_PER_SEGMENT
    assert all(len(d.line.split()) <= MAX_WORDS_PER_LINE for d in kept)
    assert len(kept) == (2 if MAX_WORDS_PER_LINE * 2 <= MAX_WORDS_PER_SEGMENT else 1)


def test_closing_line_of_the_film_has_the_tightest_budget():
    raw = _raw(2)
    raw["audio"]["dialogue_mode"] = "voiceover"
    raw["segments"][1]["dialogue"] = ["Shop now", _words(FINAL_LINE_MAX_WORDS + 1)]
    plan = validate_plan(raw, 2)
    assert [d.line for d in plan.segments[1].dialogue] == ["Shop now"]


# ── round trip and fallback ──────────────────────────────────────────────────

def test_plan_round_trips_as_a_json_string():
    """The preview hands the plan back as a string so Node cannot camelize its keys."""
    plan = validate_plan(_raw(2), 2)
    again = parse_client_plan(plan.model_dump_json(), 2)
    assert again == plan


def test_client_plan_for_a_different_duration_is_rejected():
    plan = validate_plan(_raw(2), 2)
    assert parse_client_plan(plan.model_dump_json(), 4) is None
    assert parse_client_plan("not json", 1) is None
    assert parse_client_plan(None, 1) is None


@pytest.mark.parametrize("n", [1, 2, 3, 4])
def test_fallback_plan_is_valid_with_distinct_shots(n):
    plan = fallback_plan("a brief", n, has_product=True)
    assert validate_plan(plan, n) == plan
    actions = [s.primary_action for s in plan.segments]
    assert len(set(actions)) == len(actions), "fallback must not repeat a shot"


def test_display_segments_are_one_line_per_segment():
    lines = plan_display_segments(validate_plan(_raw(3), 3))
    assert len(lines) == 3
    assert lines[0].startswith("Close-up")


class _FakeLLM:
    """Records director calls; returns queued responses (dicts, or exceptions to raise)."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.json_calls: list[dict] = []
        self.vision_calls: list[dict] = []

    async def complete_json(self, provider, model, system, messages, temperature=0.3, max_tokens=0):
        self.json_calls.append({"system": system, "messages": messages})
        return self._next()

    async def complete_with_vision_multi(self, files, prompt, json_mode=False):
        self.vision_calls.append({"files": files, "prompt": prompt, "json_mode": json_mode})
        return json.dumps(self._next())

    def _next(self):
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _plan(llm, **kwargs):
    return asyncio.run(plan_video(
        llm, brief="perfume film", duration_seconds=kwargs.pop("duration", 20),
        aspect_ratio="9:16", platform="instagram", **kwargs,
    ))


def test_director_makes_one_call_when_the_plan_is_valid():
    llm = _FakeLLM([_raw(2)])
    plan = _plan(llm)
    assert len(llm.json_calls) == 1
    assert len(plan.segments) == 2


def test_director_retries_once_with_the_reason_then_succeeds():
    llm = _FakeLLM([_raw(1), _raw(2)])
    plan = _plan(llm)
    assert len(llm.json_calls) == 2
    assert "REJECTED" in llm.json_calls[1]["messages"][0]["content"]
    assert [s.primary_action for s in plan.segments] == ["action 1", "action 2"]


def test_director_falls_back_after_two_failures_without_duplicating_segments():
    llm = _FakeLLM([RuntimeError("provider down"), _raw(1)])
    plan = _plan(llm, duration=40)
    assert len(llm.json_calls) == 2
    assert len(plan.segments) == 4
    actions = [s.primary_action for s in plan.segments]
    assert len(set(actions)) == 4


def test_product_images_use_vision_and_storyboard_sheets_go_to_the_director_only():
    llm = _FakeLLM([_raw(1)])
    product = [(b"p1", "image/jpeg"), (b"p2", "image/jpeg")]
    sheets = [(b"s1", "image/png")]
    _plan(llm, duration=10, product_images=product, storyboard_beats=["beat one"], storyboard_images=sheets)
    assert not llm.json_calls
    call = llm.vision_calls[0]
    assert call["json_mode"] is True
    assert call["files"] == product + sheets
    assert "beat one" in call["prompt"]
    assert "first 2 attached image(s) are photos of the REAL product" in call["prompt"]


def test_brand_placeholder_name_is_not_passed_to_the_director():
    from core.brand_kit import BrandKit

    assert "My Company" not in video_director._brand_context(BrandKit(), "instagram")
    assert "Acme" in video_director._brand_context(BrandKit(company_name="Acme"), "instagram")


def test_director_prompt_carries_the_core_directing_rules():
    system = video_director.build_director_system(30, 3)
    for rule in (
        "ONE PRIMARY VISUAL ACTION PER SEGMENT",
        "THE BRIEF OUTRANKS EVERY DEFAULT",
        "It cannot render reliable text",
        "shot_size",
        "lens",
        "depth_of_field",
        "start_state must describe exactly where",
    ):
        assert rule in system


def test_detail_lock_is_validated_and_capped():
    raw = _raw(1)
    raw["product"]["detail_lock"] = ["eyes closed", "  ", "N/A"] + [f"detail {i}" for i in range(40)]
    raw["product"]["static_artwork"] = "true"
    plan = validate_plan(raw, 1)
    assert plan.product.detail_lock[0] == "eyes closed"
    assert "N/A" not in plan.product.detail_lock
    assert len(plan.product.detail_lock) <= 24
    assert plan.product.static_artwork is True


def test_director_prompt_requires_a_micro_detail_lock_and_product_safe_shots():
    system = video_director.build_director_system(20, 2)
    for rule in ("MICRO-DETAIL LOCK", "detail_lock", "static_artwork", "PRODUCT-SAFE CINEMATOGRAPHY",
                 "only from angles the photos actually show"):
        assert rule in system

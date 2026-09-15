"""Covers the Omni prompt compiler: every instruction exactly once, in a fixed order, and no
prompt claiming something that is not true of the request it is sent with.

The old pipeline stated product fidelity twice per segment, appended the audio rules a third
time in llm.py, and told extensions to study reference images that were only ever attached
to the opening take. These tests pin the fixes.
"""

import asyncio

import pytest

from core.video_director import validate_plan
from core.video_prompt_compiler import compile_segment_prompts


def _plan(num_segments: int, *, dialogue: bool = False, cast: str | None = None):
    segments = []
    for i in range(num_segments):
        seg = {
            "shot_type": "macro product beauty shot",
            "primary_action": f"a condensation droplet runs down the bottle ({i + 1})",
            "shot_size": "extreme close-up",
            "camera_angle": "low-angle",
            "camera_movement": "slow lateral dolly",
            "movement_speed": "slow",
            "lens": "100mm macro",
            "depth_of_field": "shallow depth of field",
            "focus": "rack focus from droplet to label",
            "lighting": "hard rim light from camera left",
            "environment": "black marble plinth",
            "materials": "glass refraction, beaded condensation",
            "color_treatment": "deep blacks, warm gold highlights",
            "sound": "soft glass resonance",
            "end_state": f"droplet halfway down ({i + 1})",
            "continuity": "same plinth",
        }
        if dialogue:
            seg["dialogue"] = [{"speaker": "Narrator", "line": "Made for evenings"}]
        segments.append(seg)
    return validate_plan({
        "format": "product_film",
        "concept": "a perfume bottle catching light",
        "product": {"description": "tall clear glass bottle with a gold cap", "identity_cues": ["gold cap"]},
        "cast": cast,
        "setting": "dark studio",
        "look": {"color_treatment": "moody", "lighting_style": "low key"},
        "audio": {"ambience": "quiet studio room tone", "dialogue_mode": "voiceover" if dialogue else "none"},
        "segments": segments,
    }, num_segments)


def _compile(num_segments=3, *, refs=True, logo=False, aspect="9:16", **plan_kwargs):
    return compile_segment_prompts(
        _plan(num_segments, **plan_kwargs),
        aspect_ratio=aspect,
        has_product_references=refs,
        logo_attached=logo,
    )


ORDER = [
    "SHOT", "PRODUCT:", "PRODUCT FIDELITY", "ACTION", "FRAMING", "CAMERA", "LENS & FOCUS",
    "LIGHTING", "ENVIRONMENT", "MATERIALS & PHYSICS", "LOOK", "TEXT", "AUDIO",
]


def test_sections_follow_the_canonical_order():
    for prompt in _compile(3):
        positions = [prompt.index(label) for label in ORDER]
        assert positions == sorted(positions), prompt
        # Continuity (extensions) and the ending/handoff always come last.
        tail = prompt.index("ENDING:") if "ENDING:" in prompt else prompt.index("HANDOFF:")
        assert tail > prompt.index("AUDIO")
        if "CONTINUITY:" in prompt:
            assert prompt.index("AUDIO") < prompt.index("CONTINUITY:") < tail


@pytest.mark.parametrize("logo", [False, True])
def test_product_fidelity_appears_exactly_once_per_segment(logo):
    for prompt in _compile(4, logo=logo):
        assert prompt.count("PRODUCT FIDELITY") == 1


def test_no_fidelity_instruction_without_product_references():
    for prompt in _compile(2, refs=False):
        assert "PRODUCT FIDELITY" not in prompt


@pytest.mark.parametrize("logo", [False, True])
def test_extensions_never_refer_to_attached_images(logo):
    opening, *extensions = _compile(4, logo=logo)
    assert "attached reference photos" in opening
    for prompt in extensions:
        lowered = prompt.lower()
        assert "attached" not in lowered
        assert "reference photo" not in lowered
        assert "reference image" not in lowered


def test_final_segment_ends_and_earlier_segments_hand_off():
    *earlier, final = _compile(4)
    assert final.count("ENDING:") == 1
    assert "HANDOFF:" not in final
    for prompt in earlier:
        assert prompt.count("HANDOFF:") == 1
        assert "ENDING:" not in prompt


def test_single_segment_is_a_complete_take_with_an_ending():
    (only,) = _compile(1)
    assert only.startswith("SHOT:")
    assert "ENDING:" in only and "HANDOFF:" not in only
    assert "CONTINUITY:" not in only


def test_extensions_carry_continuity_and_the_previous_end_state():
    opening, second, third = _compile(3, cast="woman in her 30s, short black hair, navy linen shirt")
    assert "CONTINUITY:" not in opening
    assert "CONCEPT:" in opening and "CONCEPT:" not in second
    assert "Opens on: droplet halfway down (1)" in second
    assert "Opens on: droplet halfway down (2)" in third
    # The recurring person is re-described on every extension, or the model recasts them.
    for prompt in (second, third):
        assert "short black hair" in prompt


@pytest.mark.parametrize("dialogue", [False, True])
def test_audio_is_a_single_block_with_timing_on_every_segment(dialogue):
    for prompt in _compile(3, dialogue=dialogue):
        assert prompt.count("AUDIO:") == 1
        assert "Timing:" in prompt
        if dialogue:
            assert '"Made for evenings."' in prompt
            assert '."."' not in prompt and '.".' not in prompt
            assert "No dialogue" not in prompt
        else:
            assert "No dialogue or voiceover" in prompt


def test_text_rule_forbids_generated_captions_once():
    for prompt in _compile(2):
        assert prompt.count("TEXT:") == 1
        assert "No captions" in prompt


def test_logo_instruction_appears_once_and_only_when_attached():
    opening, extension = _compile(2, logo=True)
    assert opening.count("LOGO:") == 1 and extension.count("LOGO:") == 1
    assert "last attached image is the brand logo" in opening
    assert "already appears in the footage" in extension
    assert "every image except the last" in opening
    for prompt in _compile(2, logo=False):
        assert "LOGO:" not in prompt
        assert "logo watermark" not in prompt


def test_vertical_framing_note_only_for_vertical_video():
    assert all("middle band" in p for p in _compile(2, aspect="9:16"))
    assert not any("middle band" in p for p in _compile(2, aspect="16:9"))


def test_camera_speed_is_not_repeated():
    (only,) = compile_segment_prompts(
        validate_plan({"segments": [{"primary_action": "x", "camera_movement": "slow push-in",
                                     "movement_speed": "slow"}]}, 1),
        aspect_ratio="16:9", has_product_references=False, logo_attached=False,
    )
    assert "CAMERA: slow push-in." in only

    (locked,) = compile_segment_prompts(
        validate_plan({"segments": [{"primary_action": "x", "camera_movement": "locked-off",
                                     "movement_speed": "still"}]}, 1),
        aspect_ratio="16:9", has_product_references=False, logo_attached=False,
    )
    assert "CAMERA: locked-off." in locked


def test_empty_fields_are_skipped_not_padded():
    (only,) = compile_segment_prompts(
        validate_plan({"segments": [{"primary_action": "steam rises from a coffee cup"}]}, 1),
        aspect_ratio="16:9", has_product_references=False, logo_attached=False,
    )
    for label in ("LENS & FOCUS", "LIGHTING", "MATERIALS & PHYSICS", "CAMERA", "PRODUCT"):
        assert label not in only
    assert "ACTION (the single action of this take): steam rises from a coffee cup." in only


def test_logo_animation_prompt_states_audio_and_ending_once():
    from core.video_gen import LOGO_ANIMATION_STYLES, build_logo_animation_prompt

    prompt, name = build_logo_animation_prompt(1, "9:16")
    assert name == LOGO_ANIMATION_STYLES[0]["name"]
    assert prompt.count("AUDIO:") == 1
    assert prompt.count("ENDING") == 1
    assert "LOGO FIDELITY" in prompt
    with pytest.raises(ValueError):
        build_logo_animation_prompt(len(LOGO_ANIMATION_STYLES) + 1, "9:16")


# ── route wiring: storyboard sheets never reach Omni ─────────────────────────

def test_campaign_video_sends_only_product_photos_and_logo_to_omni(monkeypatch):
    from agents.maya import routes

    product = [(b"product", "image/jpeg")]
    sheets = [(b"sheet", "image/png")]
    logo = (b"logo", "image/png")
    seen: dict = {}

    async def fake_fetch_images(urls):
        return sheets if urls and "sheet" in urls[0] else product

    async def fake_logo(_brand_kit):
        return logo

    async def fake_brand_kit(*_args):
        return None

    async def fake_plan_video(_llm, **kwargs):
        seen["director_storyboard_images"] = kwargs["storyboard_images"]
        return _plan(1)

    async def fake_render(segment_prompts, images, aspect_ratio):
        seen["omni_images"] = images
        seen["prompts"] = segment_prompts
        from core.models import VideoResult
        return VideoResult(video_base64="", prompt_used="")

    monkeypatch.setattr(routes, "_fetch_images", fake_fetch_images)
    monkeypatch.setattr(routes, "_fetch_logo_image", fake_logo)
    monkeypatch.setattr(routes, "_load_brand_kit_safe", fake_brand_kit)
    monkeypatch.setattr(routes, "plan_video", fake_plan_video)
    monkeypatch.setattr(routes, "_generate_video_guarded", fake_render)

    request = routes.CampaignVideoRequest(
        user_id="u", product_image_urls=["https://x/product.jpg"], campaign_brief="brief",
        duration_seconds=10, use_logo=True, storyboard_beats=["beat"],
        storyboard_image_urls=["https://x/sheet.png"],
    )
    asyncio.run(routes.campaign_video_endpoint(request))

    assert seen["director_storyboard_images"] == sheets
    assert seen["omni_images"] == product + [logo]
    assert len(seen["prompts"]) == 1


def test_campaign_video_renders_the_previewed_plan_without_replanning(monkeypatch):
    from agents.maya import routes

    async def no_images(_urls):
        return []

    async def fake_brand_kit(*_args):
        return None

    async def must_not_plan(*_args, **_kwargs):
        raise AssertionError("a valid previewed plan must not be re-planned")

    seen: dict = {}

    async def fake_render(segment_prompts, images, aspect_ratio):
        seen["prompts"] = segment_prompts
        from core.models import VideoResult
        return VideoResult(video_base64="", prompt_used="")

    monkeypatch.setattr(routes, "_fetch_images", no_images)
    monkeypatch.setattr(routes, "_load_brand_kit_safe", fake_brand_kit)
    monkeypatch.setattr(routes, "plan_video", must_not_plan)
    monkeypatch.setattr(routes, "_generate_video_guarded", fake_render)

    request = routes.CampaignVideoRequest(
        user_id="u", product_image_urls=["https://x/p.jpg"], campaign_brief="brief",
        duration_seconds=20, video_plan=_plan(2).model_dump_json(),
    )
    asyncio.run(routes.campaign_video_endpoint(request))
    assert len(seen["prompts"]) == 2
    assert "droplet" in seen["prompts"][0]

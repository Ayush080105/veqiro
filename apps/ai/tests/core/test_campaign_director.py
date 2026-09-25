"""Covers the campaign director and its prompt compiler.

The old campaign pipeline planned every photo without ever seeing the product, forced a
problem -> relief story onto every category, stacked eight overlapping instruction blocks per
photo, and told the image model to render artwork "from a noticeably different perspective".
These tests pin the replacement: one plan, validated in code, compiled into one scene-first
prompt per photo that states each instruction once.
"""

import asyncio

import pytest

from core import campaign_director as cd
from core.campaign_prompt_compiler import compile_shot_prompt
from core.config import settings
from core.image_gen import _MAX_PROMPT_CHARS, product_identity_instructions


def _raw(photo_count: int, *, flat: bool = True, labels: list[str] | None = None) -> dict:
    labels = labels or [f"setting number {i + 1}" for i in range(photo_count)]
    return {
        "product": {
            "category": "devotional wall art",
            "description": "gold-leaf canvas of Shiva in profile, black ink linework, red tilak",
            "is_flat_artwork": flat,
            "detail_lock": ["eyes fully closed", "three red horizontal tilak lines", "facing right"],
            "context": "Shiva worship, home altar",
        },
        "world": {
            "concept": "Stillness of Mahadev in a warm home altar",
            "setting": "Indian home puja spaces",
            "prop_kit": ["brass diya", "rudraksha mala", "trishul"],
            "lighting": "warm lamp light with soft window shafts",
            "palette": "gold, deep brown, vermilion",
            "grade": "warm, rich shadows",
        },
        "shots": [
            {
                "purpose": "cover",
                "scene": f"canvas on a carved wooden altar ({i + 1})",
                "environment_label": labels[i],
                "props": ["brass diya", "rudraksha mala"],
                "product_placement": "leaning against the wall, facing camera",
                "shot_size": "medium", "camera_angle": "eye-level", "lens": "50mm",
                "depth_of_field": "shallow", "composition": "rule of thirds",
                "lighting": "diya glow from left", "mood": "devotional calm",
                "headline": f"Silence Takes Shape {i + 1}", "subtext": "",
            }
            for i in range(photo_count)
        ],
    }


def _compile(plan, shot=None, **kw):
    defaults = dict(photo_count=len(plan.shots), platform="instagram", aspect_ratio="1:1",
                    num_product_refs=1)
    defaults.update(kw)
    return compile_shot_prompt(plan, shot or plan.shots[0], **defaults)


# ── validate_plan ────────────────────────────────────────────────────────────

def test_too_few_shots_is_invalid():
    with pytest.raises(cd.PlanInvalid):
        cd.validate_plan(_raw(2), 4)


def test_extra_shots_are_trimmed_and_indexed():
    plan = cd.validate_plan(_raw(6), 4)
    assert [s.index for s in plan.shots] == [1, 2, 3, 4]


def test_strict_rejects_repeated_settings_but_retry_accepts_them():
    raw = _raw(3, labels=["Carved Altar", "carved  altar", "reading nook"])
    with pytest.raises(cd.PlanInvalid):
        cd.validate_plan(raw, 3, strict=True)
    assert len(cd.validate_plan(raw, 3).shots) == 3


def test_headline_is_capped_and_placeholders_dropped():
    raw = _raw(1)
    raw["shots"][0]["headline"] = "one two three four five six seven"
    raw["shots"][0]["subject"] = "N/A"
    shot = cd.validate_plan(raw, 1).shots[0]
    assert shot.headline == "one two three four five"
    assert shot.subject is None


def test_is_flat_artwork_accepts_string_true():
    raw = _raw(1)
    raw["product"]["is_flat_artwork"] = "true"
    assert cd.validate_plan(raw, 1).product.is_flat_artwork is True


@pytest.mark.parametrize("count", [1, 2, 3, 4, 6])
def test_fallback_plan_has_distinct_shots_and_no_invented_problem_story(count):
    plan = cd.fallback_plan("brief", count)
    assert len(plan.shots) == count
    assert len({s.environment_label for s in plan.shots}) == count
    text = " ".join(s.scene.lower() for s in plan.shots)
    assert "problem" not in text and "relief" not in text


# ── plan_campaign ────────────────────────────────────────────────────────────

class _FakeLLM:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls: list[dict] = []

    async def complete_with_vision_multi(self, files, prompt, json_mode=False):
        self.calls.append({"files": files, "prompt": prompt, "json_mode": json_mode})
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def _run_plan(llm, count=4):
    return asyncio.run(cd.plan_campaign(
        llm, brief="Launch our Shiva canvas", photo_count=count, platform="instagram",
        aspect_ratio="1:1", product_images=[(b"img", "image/jpeg")],
    ))


def test_director_sees_the_product_photos_in_one_call(monkeypatch):
    import json
    monkeypatch.setattr(settings, "MOCK_MODE", False)
    llm = _FakeLLM([json.dumps(_raw(4))])
    plan = _run_plan(llm)
    assert len(llm.calls) == 1
    assert llm.calls[0]["files"] == [(b"img", "image/jpeg")]
    assert llm.calls[0]["json_mode"] is True
    assert plan.product.is_flat_artwork


def test_director_retries_once_with_the_rejection_then_falls_back(monkeypatch):
    import json
    monkeypatch.setattr(settings, "MOCK_MODE", False)
    llm = _FakeLLM([json.dumps(_raw(2)), RuntimeError("provider down")])
    plan = _run_plan(llm)
    assert len(llm.calls) == 2
    assert "YOUR PREVIOUS PLAN WAS REJECTED" in llm.calls[1]["prompt"]
    assert len(plan.shots) == 4
    assert plan.shots[0].scene == cd.fallback_plan("x", 4).shots[0].scene


def test_director_prompt_asks_for_the_products_world_not_a_problem_arc():
    system = cd.build_director_system(4)
    assert "EXACTLY 4 photo(s)" in system
    assert "is_flat_artwork" in system and "detail_lock" in system
    assert "Never force a \"problem, then relief\" story" in system


# ── compiler ─────────────────────────────────────────────────────────────────

def test_prompt_leads_with_the_scene_and_states_fidelity_once():
    plan = cd.validate_plan(_raw(4), 4)
    prompt = _compile(plan)
    assert prompt.index("SCENE:") < prompt.index("CAMERA:") < prompt.index("THE PRODUCT:")
    assert prompt.count(product_identity_instructions(1)) == 1
    assert prompt.count("THE ARTWORK IS FIXED") == 1
    assert "eyes fully closed" in prompt
    assert '"Silence Takes Shape 1"' in prompt
    assert "image 1 of 4" in prompt


def test_non_artwork_products_get_no_artwork_lock():
    plan = cd.validate_plan(_raw(1, flat=False), 1)
    assert "THE ARTWORK IS FIXED" not in _compile(plan)


def test_identity_text_no_longer_asks_for_a_different_perspective():
    text = product_identity_instructions(1)
    assert "noticeably different perspective" not in text
    assert "never redrawn" in text


def test_no_headline_means_no_added_text():
    raw = _raw(1)
    raw["shots"][0]["headline"] = ""
    prompt = _compile(cd.validate_plan(raw, 1))
    assert "add no text" in prompt


def test_asset_reference_numbers_follow_attachment_order():
    plan = cd.validate_plan(_raw(1), 1)
    prompt = _compile(plan, num_product_refs=2, logo_ref=3, mascot_ref=4,
                      brand_image_refs=[(5, "a gold foil pattern")])
    assert "Reference images 1-2 show a flat artwork" in prompt
    assert "Reference image 3 is the brand logo" in prompt
    assert "Reference image 4 is the brand mascot" in prompt
    assert "Reference image 5: a gold foil pattern" in prompt


def test_compact_sheds_context_but_keeps_scene_product_and_text():
    raw = _raw(1)
    raw["product"]["detail_lock"] = [f"detail {i}" for i in range(10)]
    raw["shots"][0]["subtext"] = "Crafted in gold"
    plan = cd.validate_plan(raw, 1)
    full, compact = _compile(plan), _compile(plan, compact=2)
    assert len(compact) < len(full)
    assert "detail 9" in full and "detail 9" not in compact
    assert "Crafted in gold" not in compact
    for kept in ("SCENE:", "THE ARTWORK IS FIXED", "Silence Takes Shape"):
        assert kept in compact


def test_worst_case_plan_stays_well_inside_the_image_prompt_budget():
    long = "x" * 2000
    raw = _raw(1)
    raw["product"].update(description=long, detail_lock=[long] * 20, context=long)
    raw["world"].update(concept=long, lighting=long, palette=long, grade=long,
                        visual_style=long, typography=long)
    raw["shots"][0].update({k: long for k in (
        "scene", "product_placement", "subject", "shot_size", "camera_angle", "lens",
        "depth_of_field", "composition", "lighting", "mood", "headline", "subtext",
        "idea", "text_treatment",
    )}, props=[long] * 20)
    plan = cd.validate_plan(raw, 1)
    prompt = _compile(plan, num_product_refs=5, logo_ref=6, mascot_ref=7,
                      brand_image_refs=[(8, None)])
    # Compiled prompts are never middle-clamped (that would cut the product lock), so even a
    # plan with every field maxed out must fit on its own.
    assert len(prompt) < _MAX_PROMPT_CHARS, len(prompt)


# ── route wiring ─────────────────────────────────────────────────────────────

def test_campaign_route_fetches_once_and_renders_every_shot_with_all_references(monkeypatch):
    from agents.maya import routes

    monkeypatch.setattr(settings, "MOCK_MODE", False)
    seen: dict = {"renders": []}

    class _Kit:
        logo_url = "https://x/logo.png"
        mascot_url = None

    async def fake_brand_kit(_org):
        return _Kit()

    async def fake_fetch_images(urls):
        seen["product_fetches"] = seen.get("product_fetches", 0) + 1
        return [(b"product", "image/jpeg")]

    async def fake_fetch_one(url):
        return (b"logo", "image/png")

    async def fake_plan(_llm, **kwargs):
        seen["plan_images"] = kwargs["product_images"]
        return cd.validate_plan(_raw(4), 4)

    async def fake_render(prompt, images, aspect_ratio="1:1"):
        seen["renders"].append((prompt, images))
        return "b64"

    monkeypatch.setattr(routes, "load_brand_kit", fake_brand_kit)
    monkeypatch.setattr(routes, "_fetch_images", fake_fetch_images)
    monkeypatch.setattr(routes, "_fetch_image_with_mime", fake_fetch_one)
    monkeypatch.setattr(routes, "plan_campaign", fake_plan)
    monkeypatch.setattr(routes._llm, "generate_image_with_image_bytes", fake_render)

    request = routes.CampaignRequest(
        user_id="u", organization_id="org", product_image_urls=["https://x/p.jpg"],
        campaign_brief="Shiva canvas launch", photo_count=4, use_logo=True, use_mascot=True,
    )
    result = asyncio.run(routes.create_campaign(request))

    assert len(result.photos) == 4
    assert seen["product_fetches"] == 1
    assert seen["plan_images"] == [(b"product", "image/jpeg")]
    assert all(images == [b"product", b"logo"] for _, images in seen["renders"])
    assert all("Reference image 2 is the brand logo" in p for p, _ in seen["renders"])
    assert len({p for p, _ in seen["renders"]}) == 4


# ── creative direction ───────────────────────────────────────────────────────

def test_type_comes_from_the_campaign_not_a_fixed_bold_face():
    raw = _raw(2)
    raw["world"]["typography"] = "high-contrast serif in warm gold leaf"
    raw["shots"][0]["text_treatment"] = "embossed on the cream mount below the art"
    plan = cd.validate_plan(raw, 2)
    first, second = _compile(plan), _compile(plan, shot=plan.shots[1])
    assert "high-contrast serif in warm gold leaf" in first
    assert "embossed on the cream mount below the art" in first
    assert "embossed on the cream mount" not in second
    assert "clean, bold" not in first


def test_an_illustrated_campaign_is_not_told_to_be_a_photograph_but_keeps_the_artwork():
    raw = _raw(1)
    raw["world"]["visual_style"] = "warm storybook illustration, gouache textures"
    prompt = _compile(cd.validate_plan(raw, 1))
    assert "made as: warm storybook illustration" in prompt
    assert "real photograph" not in prompt
    assert "stays the exact reference picture" in prompt
    assert "THE ARTWORK IS FIXED" in prompt


def test_photographic_by_default_and_each_frame_states_its_idea():
    raw = _raw(1)
    raw["shots"][0]["idea"] = "the flute rests where the gaze falls"
    prompt = _compile(cd.validate_plan(raw, 1))
    assert "real photograph" in prompt
    assert "This frame's idea: the flute rests where the gaze falls." in prompt


def test_director_asks_for_ideas_variety_and_real_copy():
    system = cd.build_director_system(4)
    for asked in ("visual_style", "typography", "text_treatment", "idea",
                  "No two shots share a setting type", "adjective plus a noun", "bansuri"):
        assert asked in system, asked


def test_first_plan_keeping_most_shots_at_home_is_retried_but_second_is_accepted():
    raw = _raw(4)
    for shot in raw["shots"][:3]:
        shot["in_home"] = True
    with pytest.raises(cd.PlanInvalid, match="inside a home"):
        cd.validate_plan(raw, 4, strict=True)
    assert len(cd.validate_plan(raw, 4).shots) == 4


def test_logo_spelling_is_named_when_known():
    plan = cd.validate_plan(_raw(1), 1)
    prompt = _compile(plan, logo_ref=2, logo_text="Kalakari")
    assert 'Its lettering reads exactly "Kalakari"' in prompt
    assert "lettering reads" not in _compile(plan, logo_ref=2)

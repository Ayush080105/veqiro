"""Guards the prompt size that campaign image generation actually renders at.

Measured against gemini-2.5-flash-image with real reference images, holding everything else
constant (same model, same code path, byte-identical references):

    chars   guardrails   result
      867   n/a          image returned
    8,301   present      image returned
   11,043   absent       image returned
   11,043   present      IMAGE_OTHER
   12,701   present      IMAGE_OTHER
   27,776   present      IMAGE_OTHER  (what production was sending; 20/20 failures)

So neither length alone nor the guardrails alone is the trigger — it is instruction DENSITY.
The guardrail block is the densest rules-per-character text in the prompt, so it consumes the
most headroom; past the threshold the model returns an empty candidate with no safety block
and no text, which is Gemini's way of saying the prompt read as a rulebook, not a scene.

The failure is silent and costs a full render each time, so the caps are pinned here. If a
future prompt addition pushes past them, this test fails instead of production.
"""

import pytest

from core import image_gen as ig


class _BrandKit:
    company_name = "Test Brand"
    brand_colors = {"primary": "#8C1C13", "secondary": "#D4AF37", "accent": "#0B0B0B"}
    brand_fonts = {"heading": "Playfair Display", "body": "Inter"}
    brand_voice = "elegant, heritage-rooted, artisanal and warm"
    key_differentiators = "handcrafted brass, traditional craft"
    industry = "jewellery"
    target_audience = "women 25-45 buying gifts"
    platform_tones = {"instagram": "warm, aspirational, tactile"}
    logo_url = "https://example.invalid/logo.png"
    mascot_url = None


def _components(size: int = 200) -> dict:
    return {k: "x" * size for k in ("subject", "setting", "style", "lighting", "camera_angle")}


def _build(context_hints: str = "", **kw) -> str:
    defaults = dict(
        topic="A heritage jewellery campaign for festive gifting",
        platform="instagram",
        brand_kit=_BrandKit(),
        aspect_ratio="1:1",
        context_hints=context_hints,
        text_spec={"headline": "Worn For Generations"},
        components=_components(),
        campaign_shot_type="Side profile at 70mm, necklace suspended from a tall ribbed pot.",
        use_brand_colors=True,
        product_locked=True,
    )
    defaults.update(kw)
    return ig._build_base_prompt(**defaults)


# ── the caps themselves ──────────────────────────────────────────────────────

def test_budget_is_below_the_measured_failure_point():
    """8,301 chars rendered; 11,043 with guardrails did not. Stay under with margin."""
    assert ig._MAX_PROMPT_CHARS <= 9000
    assert ig._MAX_CONTEXT_HINT_CHARS < ig._MAX_PROMPT_CHARS


def test_context_hints_are_clamped():
    """context_hints is assembled per campaign by an LLM — nothing upstream bounds it, and it
    is what took the deployed prompt to 27,776 chars."""
    huge = "\n".join(f"line {i} " + "y" * 100 for i in range(200))
    assert len(huge) > 10_000
    built = _build(context_hints=huge)
    assert len(built) < 10_000, "an unbounded context_hints reached the prompt"


def test_enforce_prompt_budget_clamps_and_is_idempotent():
    over = "\n\n".join(f"paragraph {i} " + "z" * 500 for i in range(60))
    assert len(over) > ig._MAX_PROMPT_CHARS
    clamped = ig.enforce_prompt_budget(over, "test")
    assert len(clamped) <= ig._MAX_PROMPT_CHARS
    assert ig.enforce_prompt_budget(clamped, "test") == clamped


def test_enforce_prompt_budget_keeps_head_and_tail():
    """The head carries the mandates and the tail the guardrails; both are load-bearing, so
    the clamp must cut the narrative middle rather than truncating one end."""
    body = "\n\n".join(f"middle {i} " + "m" * 400 for i in range(60))
    prompt = "HEAD MANDATE\n\n" + body + "\n\nTAIL GUARDRAILS"
    clamped = ig.enforce_prompt_budget(prompt)
    assert clamped.startswith("HEAD MANDATE")
    assert clamped.endswith("TAIL GUARDRAILS")


def test_enforce_prompt_budget_leaves_a_fitting_prompt_alone():
    small = "a fitting prompt"
    assert ig.enforce_prompt_budget(small) is small


# ── the assembled campaign prompt, end to end ────────────────────────────────

def test_realistic_campaign_prompt_fits_the_budget():
    """The shape production actually sends: mandates + base + campaign para + identity block."""
    hints = "\n".join(f"guidance line {i} " + "h" * 120 for i in range(40))
    assembled = (
        ig._asset_mandate(True, False)
        + _build(context_hints=hints)
        + "\n\n"
        + ig.product_identity_instructions(2)
    )
    assert len(ig.enforce_prompt_budget(assembled, "test")) <= ig._MAX_PROMPT_CHARS


def test_product_fidelity_is_stated_once_not_four_times():
    """The rules were previously repeated across the lock, the campaign paragraph, the
    identity instructions and the campaign hints — ~5k characters of headroom spent saying
    one thing four times, which is what pushed the prompt over the line."""
    built = _build()
    # The rules are STATED once. The composition block may still cross-reference the lock by
    # name to settle precedence against its SUBJECT field, which is a pointer, not a restatement.
    assert built.count("PRODUCT IDENTITY LOCK —") == 1
    assert built.count("reference photos of the real product are attached") == 1


@pytest.mark.parametrize("count", [1, 2, 5])
def test_product_identity_instructions_stay_compact(count):
    text = ig.product_identity_instructions(count)
    assert text, "product fidelity must still be stated"
    # Previously ~1,270 chars for a single reference and linear in count.
    assert len(text) < 1200


def test_guardrails_survive_the_slimming():
    """Slimmed, not deleted — these are the failures worth spending density on."""
    built = _build()
    lowered = built.lower()
    assert "hex" in lowered
    assert "out of focus" in lowered
    assert "#8C1C13" in built, "injected brand hexes must still be named as do-not-print"

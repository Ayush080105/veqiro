"""Compiles a campaign plan shot into the prompt the image model reads.

The previous campaign prompt stacked eight independently written blocks — style lock, campaign
system prompt, story-arc shot text, a blind creative concept, a blind 5-component breakdown,
the platform style, generic composition rules and a forbidden-environments list — then clamped
the result from the middle, which is exactly where the scene lived. The model received a
rulebook with contradictions in it instead of a scene.

Here each instruction has one home and appears once, in the order a photo is set up: the scene,
the camera, the light, the product's fidelity, the text, the brand assets. Empty plan fields are
skipped rather than padded.

This module is pure: no I/O, no LLM calls. Its output is sent to the model verbatim.
"""

from __future__ import annotations

from core.campaign_director import CampaignPlan, ShotPlan
from core.image_gen import product_identity_instructions

# Joined-list caps. Field caps bound each item; these bound the list, so a director that
# returns eight long props cannot tip the prompt from a scene into a wall of text.
_PROPS_CHARS = 360
_DETAILS_CHARS = 900
_COMPACT_DETAILS = 5


def _join(*parts: str | None, sep: str = "; ") -> str:
    return sep.join(p.strip().rstrip(".") for p in parts if p and p.strip())


def _line(label: str, *parts: str | None) -> str | None:
    body = _join(*parts)
    return f"{label}: {body}." if body else None


def _cap_join(items: list[str], limit: int, sep: str = "; ") -> str:
    out: list[str] = []
    used = 0
    for item in items:
        item = item.strip().rstrip(".")
        if not item:
            continue
        if used + len(item) + len(sep) > limit:
            break
        out.append(item)
        used += len(item) + len(sep)
    return sep.join(out)


def _refs(start: int, count: int) -> str:
    if count == 1:
        return f"Reference image {start}"
    return f"Reference images {start}-{start + count - 1}"


def artwork_fidelity(num_product_refs: int) -> str:
    """The flat-artwork lock: the picture is the product, so only the object may move."""
    refs = _refs(1, num_product_refs) + (" shows" if num_product_refs == 1 else " show")
    return (
        f"THE ARTWORK IS FIXED. {refs} a flat artwork whose picture IS the product. "
        "Reproduce that picture exactly — same figure, face, profile or frontal view, pose, "
        "expression, eyes, linework, brushwork, colours and composition — as a real physical "
        "canvas or print sitting in this scene. Change only where it sits, the angle it is seen "
        "from and the light falling on it. Keep the picture's own background exactly as in the "
        "reference (a plain or unpainted ground stays plain) and add nothing inside the picture "
        "— no extra objects, symbols, weapons, borders or text. Never redraw, restyle, re-pose "
        "or re-crop it, and never replace it with a different picture of the same subject."
    )


def _product_block(plan: CampaignPlan, num_product_refs: int, compact: int) -> str:
    product = plan.product
    parts = []
    if product.description:
        parts.append(
            f"THE PRODUCT: {product.description.rstrip('.')}."
        )
    parts.append(product_identity_instructions(num_product_refs))
    if product.is_flat_artwork:
        parts.append(artwork_fidelity(num_product_refs))
    details = product.detail_lock[:_COMPACT_DETAILS] if compact >= 2 else product.detail_lock
    locked = _cap_join(details, _DETAILS_CHARS)
    if locked:
        parts.append(f"These details must match the reference exactly: {locked}.")
    return " ".join(parts)


def _text_block(shot: ShotPlan, compact: int) -> str:
    headline = shot.headline.strip()
    subtext = shot.subtext.strip() if compact < 2 else ""
    if not headline:
        return (
            "TEXT: add no text to the image. Only lettering physically printed on the real "
            "product may appear, exactly as in the reference."
        )
    sub = f', with "{subtext}" as a smaller line beneath it' if subtext else ""
    return (
        f'TEXT: render exactly "{headline}" as the headline{sub}, letter for letter, in a '
        "clean, bold, highly legible typeface placed in calm negative space so it never covers "
        "the product. No other added text, signs, captions or labels anywhere; any lettering "
        "too small to render correctly stays soft and out of focus rather than invented."
    )


def _assets_block(
    logo_ref: int | None,
    mascot_ref: int | None,
    brand_image_refs: list[tuple[int, str | None]],
) -> str | None:
    parts = []
    if logo_ref:
        parts.append(
            f"Reference image {logo_ref} is the brand logo: it must appear, small (8-12% of the "
            "image width) in a corner or integrated into the scene, with its exact shape and "
            "colours and without its background box."
        )
    if mascot_ref:
        parts.append(
            f"Reference image {mascot_ref} is the brand mascot: it must appear as a small "
            "supporting element; the product stays the hero."
        )
    for idx, note in brand_image_refs:
        parts.append(
            f"Reference image {idx}: {note.rstrip('.')} — incorporate it visibly."
            if note else
            f"Reference image {idx} is a brand asset that must appear, incorporated naturally "
            "into the scene."
        )
    return " ".join(parts) if parts else None


def compile_shot_prompt(
    plan: CampaignPlan,
    shot: ShotPlan,
    *,
    photo_count: int,
    platform: str,
    aspect_ratio: str,
    num_product_refs: int,
    logo_ref: int | None = None,
    mascot_ref: int | None = None,
    brand_image_refs: list[tuple[int, str | None]] | None = None,
    compact: int = 0,
) -> str:
    """One photo's prompt. `compact` sheds the least load-bearing context on retries after
    IMAGE_OTHER: level 1 drops shared-world colour, level 2 also trims details and subtext.
    The scene, the product lock and the text are never dropped."""
    world = plan.world
    opener = (
        f"A premium {platform} product campaign photograph, {aspect_ratio}"
        + (f" — photo {shot.index} of {photo_count} in one campaign" if photo_count > 1 else "")
        + "."
        + (f" Campaign idea: {world.concept.rstrip('.')}." if world.concept else "")
    )

    props = _cap_join(shot.props, _PROPS_CHARS, sep=", ")
    scene_lines = [
        f"SCENE: {shot.scene.rstrip('.')}.",
        _line("PROPS", props) if props else None,
        _line("PRODUCT PLACEMENT", shot.product_placement),
        _line("PERSON", shot.subject),
    ]
    camera = _line(
        "CAMERA", shot.shot_size, shot.camera_angle, shot.lens, shot.depth_of_field,
        shot.composition if compact < 1 else None,
    )
    light = _line(
        "LIGHT AND GRADE", shot.lighting or world.lighting,
        world.palette if compact < 1 else None,
        world.grade if compact < 1 else None,
        f"mood: {shot.mood}" if shot.mood and compact < 1 else None,
    )

    blocks = [
        opener,
        "\n".join(l for l in scene_lines if l),
        "\n".join(l for l in (camera, light) if l),
        _product_block(plan, num_product_refs, compact),
        _text_block(shot, compact),
        _assets_block(logo_ref, mascot_ref, brand_image_refs or []),
        "Render it as a real photograph with natural depth, true materials and physically "
        "plausible scale — not a poster, mockup template or graphic layout.",
    ]
    return "\n\n".join(b for b in blocks if b)

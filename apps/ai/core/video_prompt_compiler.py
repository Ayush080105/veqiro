"""Compiles a structured video plan into the prompts Gemini Omni reads.

The previous prompt was the concept, then the narrative, then five or six overlapping
"NON-NEGOTIABLE" blocks — product fidelity twice, audio rules restated in llm.py, and
extension prompts telling the model to study reference images that were never attached to
extensions. The visual direction was buried under the repetition.

Here every instruction has exactly one home and appears once per prompt, in a fixed order
that reads the way a shot is set up: what the shot is, what is in it, what happens, how it is
framed and lit, what it sounds like, how it joins the next one. Empty plan fields are skipped
rather than padded.

This module is pure: no I/O, no LLM calls. Its output is sent to the model verbatim.
"""

from __future__ import annotations

from core.llm import (
    SPEECH_CUTOFF_SECONDS,
    SPEECH_LEAD_IN_SECONDS,
    SPEECH_TAIL_SECONDS,
    VIDEO_SEGMENT_SECONDS,
)
from core.video_director import DialogueLine, SegmentPlan, VideoPlan

_FORMAT_LABEL = {
    "product_film": "premium product commercial",
    "lifestyle": "lifestyle commercial",
    "ugc": "creator-style (UGC) ad",
    "demo": "product demonstration ad",
    "narrative": "narrative commercial",
    "atmospheric": "atmospheric brand film",
}


def _join(*parts: str | None, sep: str = "; ") -> str:
    return sep.join(p.strip().rstrip(".") for p in parts if p and p.strip())


def _line(label: str, *parts: str | None) -> str | None:
    body = _join(*parts)
    return f"{label}: {body}." if body else None


# ── Single-source instruction blocks ─────────────────────────────────────────


def product_fidelity_block(*, opening: bool, logo_attached: bool) -> str:
    """The one product-fidelity instruction. Only the opening take has images attached, so
    only the opening take is told to look at them."""
    if opening:
        which = (
            "The attached reference photos (every image except the last, which is the logo)"
            if logo_attached
            else "The attached reference photos"
        )
        return (
            f"PRODUCT FIDELITY: {which} show the real product. Reproduce it exactly in every "
            "frame: shape, proportions, colours, materials, finish, logo and printed text. "
            "Never redesign, relabel or simplify it; ignore the photos' own lighting, background "
            "and angle."
        )
    return (
        "PRODUCT FIDELITY: Keep the product identical to how it already appears in the footage "
        "so far: same shape, proportions, colours, materials, logo and printed text. No drift."
    )


def text_block(*, has_product: bool, logo_attached: bool) -> str:
    exception = " apart from the brand logo watermark" if logo_attached else ""
    product_text = (
        " The only legible text is what is printed on the product itself, spelled exactly; if it "
        "cannot be rendered exactly, keep it soft-focus rather than guess."
        if has_product
        else ""
    )
    return (
        f"TEXT: No captions, titles, subtitles, graphics or added on-screen text{exception}."
        f"{product_text}"
    )


def logo_block(*, opening: bool) -> str:
    if opening:
        return (
            "LOGO: The last attached image is the brand logo. Show it as a small watermark in the "
            "bottom-right corner, about 10% of the frame width, reproduced exactly in shape, "
            "colour and spelling, never covering the subject."
        )
    return (
        "LOGO: Keep the brand logo watermark exactly as it already appears in the footage: same "
        "corner, size, colours and spelling."
    )


def _terminated(line: str) -> str:
    line = line.strip()
    return line if line[-1:] in (".", "!", "?", "…") else f"{line}."


def _speaker_label(line: DialogueLine, mode: str) -> str:
    who = line.speaker or ("Voiceover" if mode == "voiceover" else "On camera")
    if mode == "voiceover" and line.speaker:
        who = f"{line.speaker} (voiceover)"
    return who


def audio_block(
    *,
    ambience: str | None = None,
    music: str | None = None,
    sound: str | None = None,
    dialogue: list[DialogueLine] | None = None,
    dialogue_mode: str = "none",
) -> str:
    """Audio direction, kept apart from the picture. The timing line is stated on every take:
    the sound is cut dead at every 10-second join, not only at the end of the film."""
    sound_world = _join(sound, ambience, music) or "natural, realistic ambience that fits the scene"
    if dialogue and dialogue_mode != "none":
        lines = " ".join(
            f'{_speaker_label(d, dialogue_mode)}: "{_terminated(d.line)}"' for d in dialogue
        )
        speech = f"Dialogue, spoken at a relaxed, natural pace: {lines}"
    else:
        speech = "No dialogue or voiceover."
    timing = (
        f"Timing: nobody speaks in the first {SPEECH_LEAD_IN_SECONDS:g} second; every word is "
        f"finished by {SPEECH_CUTOFF_SECONDS:g} seconds in; the final {SPEECH_TAIL_SECONDS:g} "
        "seconds carry no speech while the ambience keeps running. If a line will not fit at a "
        "relaxed pace, SHORTEN it; never rush it or deliver it at double speed."
    )
    # Quoted lines already end in their own punctuation; a trailing "." would double it.
    return f"AUDIO: {sound_world}. {speech} {timing}"


def ending_block(*, final: bool, end_state: str | None = None) -> str:
    """Exactly one of these closes every prompt."""
    if final:
        frame = f" on: {end_state.rstrip('.')}" if end_state else ""
        return (
            f"ENDING: This take ends the film. All action and camera movement resolve before the "
            f"final {SPEECH_TAIL_SECONDS:g} seconds, which hold a settled, well-composed hero "
            f"frame{frame}. THE SOUND RUNS TO THE VERY END: ambience continues through the last "
            "frame. No fade, no cut to black, nothing new starting."
        )
    frame = f" on: {end_state.rstrip('.')}" if end_state else ""
    return (
        f"HANDOFF: DO NOT END HERE. This take ends IN MOTION{frame}; the next take continues from "
        "this exact frame. Never settle, fade, cut to black or resolve the story. The join is a "
        f"HARD AUDIO CUT, so the final {SPEECH_TAIL_SECONDS:g} seconds carry no speech."
    )


def continuity_block(plan: VideoPlan, seg: SegmentPlan) -> str:
    """Extensions only. States where the footage left off and what must not change — without
    restarting the concept or pretending images are attached."""
    opens = f" Opens on: {seg.start_state.rstrip('.')}." if seg.start_state else ""
    locks = _join(
        f"person: {plan.cast}" if plan.cast else None,
        f"setting: {plan.setting}" if plan.setting else None,
        seg.continuity,
    )
    lock_text = f" Hold unchanged: {locks}." if locks else ""
    return (
        "CONTINUITY: Continue seamlessly from the final frame of the footage so far, with the "
        f"same subject, setting, lighting, colour grade and sound world.{opens}{lock_text} Any "
        "speech is a NEW line that starts and finishes inside this take; never open mid-sentence "
        "or finish a line from before."
    )


# ── Compiler ─────────────────────────────────────────────────────────────────


def compile_segment_prompt(
    plan: VideoPlan,
    index: int,
    *,
    aspect_ratio: str,
    has_product_references: bool,
    logo_attached: bool,
) -> str:
    seg = plan.segments[index]
    total = len(plan.segments)
    opening = index == 0
    final = index == total - 1
    label = _FORMAT_LABEL.get(plan.format, "commercial")
    has_product = bool(plan.product and plan.product.description) or has_product_references

    if total == 1:
        shot = f"SHOT: {seg.shot_type or label}, one continuous {VIDEO_SEGMENT_SECONDS}-second take of a {label}."
    else:
        shot = (
            f"SHOT {index + 1} OF {total}: {seg.shot_type or label}, part of one continuous "
            f"{total * VIDEO_SEGMENT_SECONDS}-second {label}."
        )

    lines: list[str | None] = [shot]
    if opening:
        lines.append(_line("CONCEPT", plan.concept))
        lines.append(_line("OPENS ON", seg.start_state))
    lines.append(_line("SUBJECT", seg.subject, plan.cast if opening else None))
    if plan.product and (plan.product.description or plan.product.identity_cues):
        cues = ", ".join(plan.product.identity_cues)
        lines.append(_line(
            "PRODUCT",
            plan.product.description,
            f"identity cues: {cues}" if cues else None,
            f"state: {seg.product_state}" if seg.product_state else None,
        ))
    elif seg.product_state:
        lines.append(_line("PRODUCT", f"state: {seg.product_state}"))
    if has_product_references:
        lines.append(product_fidelity_block(opening=opening, logo_attached=logo_attached))

    lines.append(_line("ACTION (the single action of this take)", seg.primary_action))
    vertical = (
        "vertical 9:16, subject in the middle band, clear of the top and bottom edges"
        if aspect_ratio == "9:16" else None
    )
    lines.append(_line("FRAMING", seg.shot_size, seg.camera_angle, seg.composition, vertical))
    speed = seg.movement_speed
    movement = (seg.camera_movement or "").lower()
    if speed and (
        speed.lower() in movement  # "slow push-in; slow" says it twice
        or speed.lower() in ("still", "static", "none")
        or "locked" in movement  # a locked-off camera has no speed
    ):
        speed = None
    lines.append(_line("CAMERA", seg.camera_movement, f"{speed} speed" if speed else None))
    lines.append(_line("LENS & FOCUS", seg.lens, seg.depth_of_field, seg.focus))
    lines.append(_line("LIGHTING", seg.lighting or plan.look.lighting_style))
    lines.append(_line("ENVIRONMENT", seg.environment or plan.setting, seg.atmosphere))
    lines.append(_line("MATERIALS & PHYSICS", seg.materials))
    lines.append(_line(
        "LOOK",
        seg.color_treatment or plan.look.color_treatment,
        seg.pacing,
        "photoreal, premium commercial finish",
    ))
    lines.append(text_block(has_product=has_product, logo_attached=logo_attached))
    if logo_attached:
        lines.append(logo_block(opening=opening))
    lines.append(audio_block(
        ambience=plan.audio.ambience,
        music=plan.audio.music,
        sound=seg.sound,
        dialogue=seg.dialogue,
        dialogue_mode=plan.audio.dialogue_mode,
    ))
    if not opening:
        lines.append(continuity_block(plan, seg))
    lines.append(ending_block(final=final, end_state=seg.end_state))
    return "\n".join(line for line in lines if line)


def compile_segment_prompts(
    plan: VideoPlan,
    *,
    aspect_ratio: str,
    has_product_references: bool,
    logo_attached: bool,
) -> list[str]:
    """One prompt per 10-second segment, in render order."""
    return [
        compile_segment_prompt(
            plan, i,
            aspect_ratio=aspect_ratio,
            has_product_references=has_product_references,
            logo_attached=logo_attached,
        )
        for i in range(len(plan.segments))
    ]

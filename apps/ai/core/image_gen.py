import io
import base64
import colorsys
import logging

from core.models import ImageResult
from core.config import settings

logger = logging.getLogger("image_gen")

_PLACEHOLDER_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
)

_PLATFORM_STYLE = {
    "linkedin": (
        "award-winning corporate editorial photography — the look of a Wired or Fast Company cover shoot: "
        "architectural depth, deliberate negative space, long directional shadows, "
        "raking late-afternoon window light across textured surfaces; "
        "16:9 landscape with one commanding subject occupying the right two-thirds — "
        "left third is intentional empty space that reads as authority, not emptiness; "
        "typography: one ultra-bold sans-serif headline anchored left, generous tracking; "
        "color palette: exactly 2 brand tones plus near-white, zero gradients, zero noise; "
        "the overall image feels like it was commissioned, not generated"
    ),
    "instagram": (
        "cinematic lifestyle photography with a deliberate, intentional colour grade — "
        "choose ONE signature treatment: teal-and-orange film-stock warmth, bleached muted fashion editorial, "
        "or high-key luminous white with one jewel-tone accent; "
        "shallow depth of field f/1.8 feel, subject at a rule-of-thirds intersection; "
        "include ONE unexpected texture, colour, or prop detail that breaks the predictable composition "
        "and earns a second look — something that reframes the subject or deepens the narrative; "
        "typography: single oversized headline, lower-third or upper-third only, never centred; "
        "the image must communicate a feeling before the text is read; "
        "square 1:1 with rich visual texture in the background — never a flat solid fill"
    ),
    "twitter": (
        "poster-art boldness: ONE idea, ruthlessly edited — cut everything that does not serve it; "
        "the image communicates its entire message in under 0.3 seconds at thumbnail scale; "
        "maximum contrast, single dominant brand colour at full saturation, hard-edge geometric shapes; "
        "typography occupies 35-45% of frame as the PRIMARY visual element — not a caption, a design object; "
        "16:9 landscape with immediate left-to-right visual momentum; "
        "if photographic elements are used, apply a high-contrast duotone treatment so they read as graphic, not photographic; "
        "the result should feel closer to a protest poster or album cover than a corporate social post"
    ),
}

_ASPECT_FOR_PLATFORM = {
    "linkedin": "16:9",
    "instagram": "1:1",
    "twitter":  "16:9",
}

# Hue angle thresholds → color name (colorsys HSV hue is 0-1, multiply by 360 for degrees)
_HUE_STOPS: list[tuple[float, str]] = [
    (15,  "red"),
    (38,  "orange"),
    (65,  "yellow"),
    (150, "green"),
    (190, "teal"),
    (255, "blue"),
    (285, "violet"),
    (325, "magenta"),
    (360, "red"),
]


def product_identity_instructions(count: int) -> str:
    """Shared product-fidelity/identity-lock instruction block for any reference-image-driven
    generation (campaign photos, video storyboards). Kept in one place so image, storyboard, and
    video prompts describe product fidelity identically instead of drifting apart."""
    multi_ref_note = (
        f"Reference images 1-{count} are different photos/materials the user uploaded "
        f"of this real product — do NOT assume they are simply the same physical object seen from "
        f"different camera angles if they visually look like different things (e.g. one may show the "
        f"loose item itself, another may show its packaging, box, or printed label art). Study each: "
        f"from whichever reference(s) show the physical item, take its exact color, shape, material, "
        f"and surface details; from whichever reference(s) show packaging/label/box art, take its "
        f"exact brand name, logo, and any printed text/colors verbatim and reflect them faithfully. "
        f"Never drop the real brand name or packaging identity just because one reference shows the "
        f"item without it. "
        if count > 1 else ""
    )
    return multi_ref_note + "\n".join(
        f"Reference image {i + 1} contains the product — treat it as a possibly rough, hand-taken "
        f"snapshot: study it carefully to separate the TRUE PRODUCT (exact shape, colors, materials, "
        f"proportions, any visible brand name/logo/printed text) from incidental artifacts of how it "
        f"was casually captured (poor lighting, an awkward angle, blur, glare, clutter). Preserve the "
        f"former faithfully — including any visible brand name, logo, or printed text, reproduced "
        f"verbatim, never invented or substituted — while ignoring the latter entirely. If the label "
        f"is visible but would naturally be too small/distant to read at this shot's scale, render it "
        f"soft and out-of-focus with the right colors/layout rather than inventing legible-looking "
        f"but fake or garbled characters — fabricated label text is never acceptable. "
        f"Keep the product clearly recognizable as the same product from the reference. "
        f"DO NOT recreate the reference image's composition, camera angle, pose, lighting quality, background, or framing. "
        f"Generate a fresh campaign image where the product is confidently and competently rendered from a noticeably different pose, orientation, and camera perspective — inferring its plausible full form even where the reference only shows one side — while maintaining the same product identity."
        for i in range(count)
    )


def _hex_to_color_name(hex_code: str) -> str:
    """Convert a CSS hex color code to a human-readable name for safe prompt injection."""
    if not hex_code:
        return ""
    h = hex_code.strip().lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    if len(h) != 6:
        return h  # unknown format — return without the # at minimum
    try:
        r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
        hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
        # Achromatic cases
        if val < 0.12:
            return "near-black"
        if val > 0.92 and sat < 0.08:
            return "near-white"
        if sat < 0.12:
            return "dark gray" if val < 0.5 else "light gray"
        # Map hue angle to name
        hue_deg = hue * 360
        name = "red"
        for threshold, color in _HUE_STOPS:
            if hue_deg <= threshold:
                name = color
                break
        # Lightness qualifier
        if val < 0.35:
            return f"deep {name}"
        if val > 0.82 and sat < 0.55:
            return f"light {name}"
        if sat > 0.75 and val > 0.6:
            return f"vivid {name}"
        return name
    except Exception:
        return h


async def _fetch_asset(url: str) -> bytes | None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=settings.R2_FETCH_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception as exc:
        logger.warning("_fetch_asset failed | url=%s error=%s", url, exc)
        return None


async def _elaborate_prompt_5component(
    visual_description: str,
    platform: str,
    brand_kit,
    tone: str = "",
    extra_context: str = "",
    campaign_shot_type: str = "",
    product_locked: bool = False,
) -> dict | None:
    """Elaborates a visual description into a 6-component Gemini prompt template.

    Calls a fast Gemini text model to expand the description into Subject,
    Setting, Style, Lighting, Camera Angle, and a Text Overlay spec — the
    structure that produces the most specific, professional image outputs.
    Returns None on failure so callers fall back gracefully.
    """
    if settings.MOCK_MODE:
        return None
    try:
        import json as _json
        from google import genai
        from google.genai import types

        platform_context = {
            "linkedin": (
                "B2B corporate editorial: controlled studio or office lighting, authoritative typography "
                "using sans-serif at bold weight, restrained 2-color palette, subject positioned right-of-center "
                "with text block anchored left, neutral 5000K color temperature. "
                "TEXT SAFE ZONE: compose so the LEFT THIRD of the frame stays visually quiet (clean tone, "
                "soft falloff, no busy detail) — that is where the headline will sit"
            ),
            "instagram": (
                "lifestyle photography: shallow focus f/1.8-2.8 feel, natural or golden-hour light, "
                "vivid saturated palette with vibrance pushed +20-30%, subject slightly off-center at "
                "a rule-of-thirds intersection, minimal headline text overlay. "
                "TEXT SAFE ZONE: keep either the upper third or lower third visually quiet — even tone, "
                "out-of-focus or negative space — so the headline reads without fighting the subject"
            ),
            "twitter": (
                "bold graphic design: maximum contrast, large typographic element occupying 35-45% of frame, "
                "single dominant brand color at full saturation, strong diagonal or left-to-right visual flow, "
                "16:9 landscape with immediate visual impact. "
                "TEXT SAFE ZONE: the typographic block IS the composition — plan the photographic/graphic "
                "elements around it, never behind it"
            ),
        }.get(platform.lower(), "professional social media editorial, clean neutral lighting, clear visual hierarchy")

        brand_context_parts = []
        if brand_kit:
            if brand_kit.company_name:
                brand_context_parts.append(f"company: {brand_kit.company_name}")
            if getattr(brand_kit, "company_description", None):
                brand_context_parts.append(f"what they do: {brand_kit.company_description[:200]}")
            if getattr(brand_kit, "value_proposition", None):
                brand_context_parts.append(f"value prop: {brand_kit.value_proposition[:150]}")
            if brand_kit.brand_voice:
                brand_context_parts.append(f"brand voice: {brand_kit.brand_voice}")
            if brand_kit.industry:
                brand_context_parts.append(f"industry: {brand_kit.industry}")
            if brand_kit.target_audience:
                brand_context_parts.append(f"target audience: {brand_kit.target_audience}")
            if getattr(brand_kit, "key_differentiators", None):
                brand_context_parts.append(f"differentiator: {brand_kit.key_differentiators[:120]}")
        brand_context = "; ".join(brand_context_parts)

        system_prompt = (
            "You are a world-class image art director and Gemini prompt specialist. "
            "Your outputs have one job: produce the technical precision blueprint that makes an AI generate a breathtaking, "
            "scroll-stopping image — not a competent one, a stunning one.\n\n"
            "Given a creative concept and context, break it into 5 cinematic technical components.\n\n"
            "Return ONLY a valid JSON object with exactly these 5 keys:\n"
            '  "subject": The main subject with hyper-specific visual details — exact appearance, texture, material, '
            'expression, action, or configuration. Name the specific type, not a category '
            '(not "a person" — "a woman in her 40s in a tailored charcoal suit, mid-gesture, one hand raised, '
            'eyes focused off-camera left, a faint reflection visible in the glass surface beneath her").\n'
            '  "setting": A specific named environment with materials, time of day, and background depth '
            '(not "an office" — "a glass-walled corner boardroom at dusk, floor-to-ceiling windows smearing '
            'the city into orange and indigo behind the subject, a single architect\'s lamp pooling warm light '
            'on a matte-black conference table, shallow focus blurring the cityscape into bokeh").\n'
            '  "style": Name a visual movement or master photographer\'s aesthetic, then add 2-3 execution specifics '
            '(e.g., "editorial fashion photography in the style of Annie Leibovitz — strong directional shadow, '
            'slight film grain at ISO 800, desaturated midtones with rich shadow retention" or '
            '"Bauhaus graphic design — hard geometric shapes, primary color restriction, no decoration beyond function").\n'
            '  "lighting": Name a SPECIFIC lighting technique (Rembrandt, split, rim, motivated practical source, '
            'backlit silhouette, hard single-source from above). Describe direction (angle, side), color temperature '
            '(cool/warm/neutral), shadow hardness (hard/feathered/soft), and the emotional mood it creates.\n'
            '  "camera_angle": Precise perspective — focal length equivalent (28mm wide drama, 85mm portrait compression, '
            '200mm isolating telephoto), exact angle (eye-level, 15° low-angle authority, bird\'s-eye, Dutch 12°), '
            'and a named composition technique (rule of thirds with subject right, deliberate negative space left, '
            'leading lines from lower-left corner, subject breaking the right-side frame edge).\n\n'
            "Rules:\n"
            "- EVERY component must be 2-3 rich, specific sentences — never a single phrase or a list\n"
            "- If the input concept is already specific, make it MORE specific — add materials, surface qualities, light direction\n"
            "- Do NOT invent brand names or details not provided in the input\n"
            "- NEVER use these words: beautiful, stunning, amazing, professional, modern, elegant — show it, don't label it\n"
            "- BANNED VISUAL CLICHÉS — never write these into any component: glowing holograms or floating "
            "translucent UI, blue-tinted 'tech' light washes, robot hands, brains made of circuits, "
            "lightbulbs standing for ideas, rockets standing for growth, chess pieces standing for strategy, "
            "handshake close-ups, generic diverse teams high-fiving at laptops\n"
            "- If the content context below explicitly names a specific subject (e.g. a human model, a person doing "
            "something), a specific prop, or a named theme/motif, that element MUST be written explicitly into the "
            "'subject' and/or 'setting' field in concrete visual detail — do not translate it into an abstract mood, "
            "color, or symbolic object instead of the literal thing requested\n"
            "- A required subject AND the product must be described at normal, physically plausible scale, "
            "proportion, and position, as a real photograph would show them — never shrunk into another object, "
            "nor the product warped into an impossible container/architecture, as a substitute for a normal shot\n"
            + (
                "- PRODUCT IDENTITY IS FIXED BY AN UPLOADED REFERENCE PHOTO — do NOT invent, redesign, reimagine, "
                "or substitute a different device/object/packaging to represent the product, even if the brief's "
                "language is abstract or futuristic (e.g. 'intelligent health', 'future of wellness'). The 'subject' "
                "field must refer to the exact product from the reference image (describe it generically — 'the "
                "product from the reference photo' — do not guess new colors, materials, or shape for it) and "
                "describe only how it is staged, held, or positioned. Any futuristic/abstract mood from the brief "
                "must be expressed through setting, lighting, and props around the unchanged product — never by "
                "turning the product itself into a sci-fi device, hologram, or symbolic object\n"
                if product_locked else ""
            )
            + "- If the content context names several distinct settings/activities or asks for a 'collage', describe "
            "the 'setting' field as genuinely separate photographic panels in a real grid/split-frame layout, not "
            "one fused impossible scene. If it asks for people/customers (especially 'diverse' ones), the 'subject' "
            "field must describe actual visible human figures — faces and bodies — not just hands\n"
            "- Return ONLY the JSON — no markdown, no explanation, no code fences"
        )

        user_prompt = (
            f"Visual description: {visual_description}\n"
            f"Platform: {platform} ({platform_context})\n"
            + (f"Brand context: {brand_context}\n" if brand_context else "")
            + (f"Tone: {tone}\n" if tone else "")
            + (
                f"Content context (this is the MOST IMPORTANT creative brief — use it to align the visual concept, "
                f"mood, and subject with this specific post angle; ANY explicitly named subject, prop, or theme in "
                f"here MUST appear literally in the subject/setting fields, not just as ambient mood): "
                f"{extra_context[:900]}\n"
                if extra_context else ""
            )
            + (
                f"MANDATORY SHOT TYPE — the camera_angle field MUST match this exactly: {campaign_shot_type}\n"
                if campaign_shot_type else ""
            )
            + (
                "PRODUCT REFERENCE PHOTO PROVIDED — the product's real appearance is fixed by an uploaded photo "
                "you cannot see here; do not describe or invent what it looks like. Write the 'subject' field as "
                "how the (unseen, already-fixed) product is staged/held/positioned in the scene, not what it is.\n"
                if product_locked else ""
            )
        )

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        required = {"subject", "setting", "style", "lighting", "camera_angle"}
        attempt_prompt = user_prompt
        last_reason = "unknown"
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=attempt_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.5,
                        max_output_tokens=1024,
                        response_mime_type="application/json",
                        # Disable thinking — pure JSON extraction needs no reasoning chain,
                        # and thinking tokens would consume the output budget before the JSON starts.
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                text = (response.text or "").strip()
                if not text:
                    last_reason = "empty response"
                    continue
                # Strip code fences if the model added them despite instructions
                if text.startswith("```"):
                    text = text.split("```", 2)[1]
                    if text.startswith("json"):
                        text = text[4:]
                    text = text.rstrip("```").strip()
                components = _json.loads(text)
                if not required.issubset(components.keys()):
                    last_reason = f"missing keys: {set(components.keys())}"
                    continue
                # Depth check — reject shallow components that would downgrade the original prompt.
                # Any component under 60 chars is likely a placeholder ("a product", "natural light")
                # that overrides the richer original description without adding value.
                min_len = min(len(v) for v in components.values() if isinstance(v, str))
                if min_len < 60:
                    last_reason = f"too shallow (min_component_len={min_len})"
                    attempt_prompt = (
                        user_prompt
                        + "\n\nYour previous output was too shallow — EVERY field must be 2-3 full, "
                        "richly specific sentences with materials, light direction, and surface detail."
                    )
                    continue
                logger.info("5-component elaboration done | platform=%s min_len=%d attempt=%d", platform, min_len, attempt + 1)
                return components
            except Exception as exc:
                last_reason = str(exc)
        logger.error("image_pipeline_degraded=elaboration | falling back to plain prompt after retry | reason=%s", last_reason)
        return None
    except Exception as exc:
        logger.error("image_pipeline_degraded=elaboration | setup failed: %s", exc)
        return None


async def _generate_creative_concept(
    topic: str,
    platform: str,
    brand_kit,
    tone: str = "",
    extra_context: str = "",
    product_locked: bool = False,
    campaign_shot_type: str = "",
) -> str | None:
    """Invents a specific, unexpected cinematic visual concept before elaboration.

    Called BEFORE _elaborate_prompt_5component so the 5-component breakdown
    builds precision on top of a genuinely creative idea rather than just the
    user's brief. Falls back gracefully to None on any failure.
    """
    if settings.MOCK_MODE:
        return None
    try:
        from google import genai
        from google.genai import types

        platform_energy = {
            "linkedin": "authoritative, thought-leadership, premium B2B — surprising but credible",
            "instagram": "emotionally resonant, visually arresting, scroll-stopping in a feed of thousands",
            "twitter":  "instant impact, poster-art clarity, one idea communicated in a single glance",
        }.get(platform.lower(), "professional social media, visually distinctive")

        brand_parts: list[str] = []
        if brand_kit:
            if brand_kit.company_name:
                brand_parts.append(f"brand: {brand_kit.company_name}")
            if getattr(brand_kit, "company_description", None):
                brand_parts.append(f"what they do: {brand_kit.company_description[:200]}")
            if getattr(brand_kit, "value_proposition", None):
                brand_parts.append(f"value prop: {brand_kit.value_proposition[:150]}")
            if brand_kit.brand_voice:
                brand_parts.append(f"brand voice: {brand_kit.brand_voice}")
            if brand_kit.industry:
                brand_parts.append(f"industry: {brand_kit.industry}")
            if brand_kit.target_audience:
                brand_parts.append(f"target audience: {brand_kit.target_audience}")
            if getattr(brand_kit, "key_differentiators", None):
                brand_parts.append(f"differentiator: {brand_kit.key_differentiators[:120]}")
        brand_context = "; ".join(brand_parts)

        system_prompt = (
            "You are a creative director at a world-class advertising agency (Droga5, Wieden+Kennedy, BBDO). "
            "Your single job: for any brief, invent ONE specific, unexpected, cinematic visual concept for a single social media image.\n\n"
            "This is NOT a prompt template. This is a creative concept — a director's vision statement for THE image.\n\n"
            "Rules:\n"
            "1. SPECIFIC — not 'a person working' but 'a woman in a white lab coat leaning over a glass table, "
            "her reflection perfectly mirrored below, holding a glowing vial that casts teal light across her face'\n"
            "2. UNEXPECTED — reject your first idea, it is the cliché. Push past it to something that earns genuine "
            "attention in a feed of thousands. Ask yourself: what is the LAST image anyone would expect for this brief? "
            "Now make it feel inevitable. Think of it as a single frame from an award-winning print campaign: "
            "one focal subject, one idea, one twist.\n"
            "2b. FORBIDDEN CLICHÉS — these are instant failures, never propose them: glowing holograms or "
            "floating translucent UI, blue-tinted 'tech' lighting washes, robot hands, brains made of circuits, "
            "a lightbulb standing for an idea, a rocket standing for growth, chess pieces standing for strategy, "
            "a handshake close-up, a generic diverse team high-fiving around laptops, a maze standing for "
            "complexity, climbing a mountain standing for ambition.\n"
            "3. ONE concept only — no alternatives, no lists, no 'or you could...'\n"
            "4. Describe THE IMAGE — the exact scene. Not a direction, not a mood board. Paint the specific moment.\n"
            "5. ACHIEVABLE — must be possible for an AI image generator to produce in a single shot.\n"
            "6. MEANINGFULLY CONNECTED — the concept must authentically illuminate the topic and brand. "
            "A viewer who knows the brief should feel 'of course — that's exactly right.'\n"
            "7. MANDATORY REQUESTED ELEMENTS — if the post context below explicitly names a specific subject "
            "(e.g. 'use a model', 'a person journaling'), a specific prop, or a named theme/motif the product is "
            "built around, that element is a NON-NEGOTIABLE requirement, not raw material to abstract away. "
            "Your unexpected angle must come from HOW you stage that required element (framing, action, environment) — "
            "never from replacing or omitting it with a symbolic stand-in.\n"
            "8. STAGE IT FOR REAL, NOT AS A METAPHOR FOR IT — every required subject AND the product itself must "
            "exist at normal, physically plausible scale, proportion, and position, exactly as a real camera would "
            "capture it. Find your 'unexpected' angle in framing, action, light, or environment — never by warping "
            "the product into an impossible container/architecture, shrinking a subject into another object, or "
            "fusing multiple scenes into one physically impossible object. Any surreal or symbolic device is only "
            "ever an addition alongside subjects and product appearing normally, never a replacement for that.\n"
            "9. MULTIPLE SETTINGS OR PEOPLE — if the brief names several distinct settings/activities (or asks for "
            "a 'collage'), realize that as genuinely separate photographic panels — a real grid or split-frame "
            "collage of distinct shots — not one fused, impossible scene trying to hold all of them at once. If "
            "the brief asks for people/customers (especially 'diverse' ones), show actual distinct human figures — "
            "faces and bodies, not just disembodied hands standing in for a person.\n\n"
            + (
                "10. PRODUCT IS A REAL, ALREADY-PHOTOGRAPHED OBJECT YOU CANNOT SEE — an uploaded reference photo "
                "fixes its exact appearance (shape, color, material, packaging). Do NOT design, redesign, or invent "
                "what the product looks like, and do NOT translate abstract/futuristic brief language ('intelligent "
                "health', 'future of wellness', 'AI-powered') into a new-looking device, gadget, hologram, or "
                "symbolic object standing in for the product. That language is a MOOD to express through setting, "
                "lighting, props, and human action around the unchanged, ordinary-looking product — never a design "
                "brief for reinventing the product's form. Describe the product only as 'the product' being staged "
                "in your scene, never describe new visual attributes for it.\n\n"
                if product_locked else ""
            )
            + "Output: 2-3 sentences painting the exact scene. No preamble, no labels, no explanation. Just the scene."
        )

        user_prompt = (
            f"Topic / brief: {topic}\n"
            f"Platform energy: {platform_energy}\n"
            + (f"Brand context: {brand_context}\n" if brand_context else "")
            + (f"Tone: {tone}\n" if tone else "")
            + (f"Post context (CRITICAL — the concept MUST serve this specific angle and MUST include any subject, "
               f"prop, or theme explicitly named here): {extra_context[:900]}\n" if extra_context else "")
            + (
                "PRODUCT REFERENCE PHOTO PROVIDED — you cannot see it, and its real appearance is fixed. "
                "Do not describe or invent what the product looks like.\n"
                if product_locked else ""
            )
            + (
                f"MANDATORY STORY BEAT — this photo is ONE beat in a multi-photo campaign narrative, not a "
                f"standalone shot. Your concept MUST depict exactly this beat, matching its specified subject "
                f"matter and mood — not a generic or unrelated idea for the brief as a whole. Regardless of the "
                f"beat's emotional focus, the product itself must remain clearly, prominently visible and in "
                f"sharp focus somewhere in the frame — never sidelined, blurred beyond recognition, or omitted: "
                f"{campaign_shot_type}\n"
                if campaign_shot_type else ""
            )
            + "\nInvent ONE stunning, unexpected visual concept for this image."
        )

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        attempt_prompt = user_prompt
        last_reason = "unknown"
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=attempt_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=1.0,
                        max_output_tokens=512,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )
                concept = (response.text or "").strip()
                if concept and len(concept) >= 60:
                    logger.info("creative concept generated | platform=%s len=%d attempt=%d", platform, len(concept), attempt + 1)
                    return concept
                last_reason = f"too short or empty (len={len(concept)})"
                attempt_prompt = (
                    user_prompt
                    + "\n\nYour previous output was too short. Paint the full scene in 2-3 complete sentences."
                )
            except Exception as exc:
                last_reason = str(exc)
        logger.error("image_pipeline_degraded=concept | falling back to raw topic after retry | reason=%s", last_reason)
        return None
    except Exception as exc:
        logger.error("image_pipeline_degraded=concept | setup failed: %s", exc)
        return None


# Maps brand voice keywords to concrete visual directions Gemini can act on.
# Checked at prompt-build time; matched entries appended to the brand atmosphere block.
_VOICE_VISUAL_MAP: list[tuple[str, str]] = [
    ("bold", "high-contrast compositions, dominant focal point, strong geometric shapes"),
    ("luxury", "dark backgrounds, metallic or glass accents, dramatic single-source dramatic lighting"),
    ("premium", "dark backgrounds, metallic accents, refined typography with generous tracking"),
    ("minimal", "generous negative space, single focal point, restrained color use"),
    ("clean", "white or light neutral backgrounds, minimal props, uncluttered framing"),
    ("warm", "golden tones, soft gradients, natural materials — wood, linen, terracotta"),
    ("natural", "earthy tones, organic textures, soft diffused natural light"),
    ("playful", "bright saturated colors, curved shapes, informal prop placement"),
    ("energetic", "dynamic angles, vibrant colors, movement-suggesting compositions"),
    ("professional", "clean grid compositions, neutral tones, controlled depth of field"),
    ("elegant", "soft muted palette, silk or marble textures, high-key diffused lighting"),
    ("friendly", "warm mid-tones, approachable eye-level framing, soft shadows"),
]

# Maps font name keywords → style descriptors Gemini can translate to visual weight/style.
# Gemini cannot render specific typefaces, but it can match typographic personality.
_FONT_STYLE_MAP: list[tuple[list[str], str]] = [
    (["serif", "georgia", "garamond", "times", "baskerville", "didot", "playfair", "minion"], "classical serif typography with refined stroke contrast"),
    (["sans", "helvetica", "inter", "roboto", "montserrat", "poppins", "futura", "proxima", "gill", "lato", "raleway"], "clean geometric sans-serif with even stroke weight"),
    (["display", "bebas", "oswald", "impact", "black", "ultra", "condensed"], "expressive large-format display type, strong visual weight"),
    (["mono", "courier", "code", "space mono", "inconsolata", "fira", "hack"], "technical monospaced type, utilitarian aesthetic"),
    (["script", "pacifico", "dancing", "cursive", "brush", "handwritten", "great vibes", "satisfy"], "flowing connected letterforms, human warmth"),
]


def _font_to_style(font_name: str) -> str:
    font_lower = font_name.lower()
    for keywords, style in _FONT_STYLE_MAP:
        if any(kw in font_lower for kw in keywords):
            return style
    return f"typographic style inspired by {font_name} — match its visual weight and personality"


def _build_base_prompt(topic: str, platform: str, brand_kit, aspect_ratio: str, context_hints: str = "", text_spec: dict | None = None, components: dict | None = None, campaign_shot_type: str = "", use_brand_colors: bool = True, product_locked: bool = False) -> str:
    style = _PLATFORM_STYLE.get(platform, "professional social media graphic")

    # Colors — exact hex + human name for fidelity; framed as design values so the
    # model never prints them as text (guardrails below name the exact codes too)
    colors = ""
    injected_hexes: list[str] = []
    if use_brand_colors and brand_kit and brand_kit.brand_colors:
        c = brand_kit.brand_colors
        color_parts = []
        for role in ("primary", "secondary", "accent"):
            hex_code = c.get(role, "")
            if hex_code:
                hex_norm = hex_code if hex_code.startswith("#") else f"#{hex_code}"
                injected_hexes.append(hex_norm)
                color_parts.append(f"{role} {hex_norm} ({_hex_to_color_name(hex_code)})")
        if color_parts:
            colors = (
                f"BRAND COLOR VALUES (apply as exact color values in the design only — NEVER print these codes as text): "
                f"{', '.join(color_parts)}. "
                f"Match these hex values precisely. The primary color dominates the palette; "
                f"the secondary supports it; the accent is used sparingly for ONE focal element only. "
            )

    # Fonts — inject style descriptors, not font names, since Gemini can't render specific typefaces
    fonts = ""
    if brand_kit and brand_kit.brand_fonts:
        f_ = brand_kit.brand_fonts
        heading = f_.get("heading") or f_.get("primary") or f_.get("display")
        body = f_.get("body") or f_.get("secondary")
        font_parts = []
        if heading:
            font_parts.append(f"heading: {_font_to_style(heading)}")
        if body:
            font_parts.append(f"body: {_font_to_style(body)}")
        if font_parts:
            fonts = f"Typography style: {'; '.join(font_parts)}. Apply this typographic character to any text elements. "

    # Brand identity — framed as visual atmosphere direction, never as text to render
    brand = ""
    if brand_kit:
        brand_parts = []
        if brand_kit.company_name:
            brand_parts.append(f"brand: {brand_kit.company_name}")
        if brand_kit.brand_voice:
            voice_visual = "; ".join(
                desc for kw, desc in _VOICE_VISUAL_MAP if kw in brand_kit.brand_voice.lower()
            )
            brand_parts.append(f"visual atmosphere/mood: {brand_kit.brand_voice}")
            if voice_visual:
                brand_parts.append(f"translate that voice into: {voice_visual}")
        if brand_kit.key_differentiators:
            brand_parts.append(f"brand personality: {brand_kit.key_differentiators}")
        if brand_parts:
            brand = (
                f"[BRAND ATMOSPHERE — use to inform visual mood, style, and feel ONLY — "
                f"do NOT copy, paraphrase, or render any of this as visible text in the image]: "
                f"{'; '.join(brand_parts)}. "
            )

    # Audience & industry — context only, not text
    context = ""
    if brand_kit:
        ctx_parts = []
        if brand_kit.industry:
            ctx_parts.append(f"industry: {brand_kit.industry}")
        if brand_kit.target_audience:
            ctx_parts.append(f"audience: {brand_kit.target_audience}")
        if ctx_parts:
            context = (
                f"[AUDIENCE CONTEXT — for visual direction only, do NOT render as text]: "
                f"{'; '.join(ctx_parts)}. "
            )

    # Platform-specific tone — design energy direction only
    platform_tone = ""
    if brand_kit and brand_kit.platform_tones:
        tone = brand_kit.platform_tones.get(platform.lower())
        if tone:
            platform_tone = (
                f"[PLATFORM ENERGY — inform composition energy and feel ONLY, do NOT render as text]: "
                f"{tone}. "
            )

    # context_hints is composition/narrative guidance only — never rendered as text
    composition_context = (
        f"[COMPOSITION CONTEXT — for visual direction only, do NOT render as text]: {context_hints}. "
        if context_hints else ""
    )

    # Pre-specified text to render exactly — prevents spelling mistakes and hallucinations
    exact_text_block = ""
    if text_spec:
        lines = []
        if text_spec.get("headline"):
            lines.append(f'• Headline: "{text_spec["headline"]}"')
        if text_spec.get("stat"):
            lines.append(f'• Stat: "{text_spec["stat"]}"')
        if text_spec.get("subtext"):
            lines.append(f'• Subtext: "{text_spec["subtext"]}"')
        if lines:
            exact_text_block = (
                "EXACT TEXT TO RENDER — copy these strings letter-for-letter, zero changes:\n"
                + "\n".join(lines)
                + "\nDO NOT paraphrase, abbreviate, or alter any word or character. "
                "Render the text exactly as written. "
                "Before finalizing, verify every rendered word character-by-character against the strings above — "
                "a single wrong, swapped, or dropped letter in any word is a total failure of the image. "
                "Render all text in a clean, highly legible typeface at a size where every letter is unambiguous.\n"
            )

    # Typography instruction differs based on whether text is pre-specified
    if text_spec:
        typography = (
            "TYPOGRAPHY: Render ONLY the text from EXACT TEXT TO RENDER above — nothing else invented. "
            "Text must be bold, modern, perfectly legible, and integrated into the design as a core element. "
        )
    else:
        typography = (
            "TYPOGRAPHY: Include bold, well-designed text directly in the image. "
            "First check the COMPOSITION CONTEXT below: if it explicitly quotes a specific phrase meant as the "
            "headline or text overlay (e.g. introduced by 'text overlay', 'headline', 'reads', or given in quotation "
            "marks as the tagline), use that exact phrase verbatim as the headline — do not paraphrase, shorten, or "
            "invent an alternative. Only if no such phrase is given, derive a SHORT headline (3-5 words max) from "
            "the TOPIC using this method: "
            "identify the single strongest ACTION or BENEFIT the topic implies, then express it as a verb-first imperative OR a 2-3 noun power phrase "
            "(follow this PATTERN — not these words: 'Build Faster.', 'Own The Room.', 'Less Effort. More Impact.'). "
            "The headline must express a BENEFIT or a TENSION — never a label of what the image literally shows "
            "and never a generic category name ('Morning Routine', 'The Product', 'Our Team' are failures). "
            "Do NOT copy the topic text verbatim. "
            "Do NOT use generic adjectives like amazing, great, powerful, incredible, innovative, revolutionary. "
            "Do NOT lift phrases from the brand atmosphere or audience context sections. "
            "You may add a very brief supporting line (5-8 words) directly relevant to the topic. "
            "Text must be clean, modern, perfectly legible, and integrated into the layout as a primary design element — not a caption. "
            "Every word in both the headline and supporting line must be spelled correctly and appear exactly once — "
            "no duplicated words, no repeated syllables, no invented word fragments. Proofread the text before rendering it. "
        )

    # Guardrails — explicit list of what must never appear as visible text
    guardrails_extra = (
        "  ✗ Any text NOT from EXACT TEXT TO RENDER — do not invent or add any extra text\n"
        if text_spec else
        "  ✗ Internal instructions, prompt fragments, meta commentary, or analytical summaries\n"
    )
    injected_hex_note = (
        f" — including the exact brand values {', '.join(injected_hexes)} given above"
        if injected_hexes else ""
    )
    guardrails = (
        "=== TEXT GUARDRAILS ===\n"
        "ABSOLUTELY NEVER render any of the following as visible text in the image:\n"
        f"  ✗ Hex color codes like #6C3CE1, #FF5733, or rgb(108,60,225){injected_hex_note} — apply as color values only, never print them\n"
        "  ✗ Gibberish, pseudo-text, or lorem-ipsum ANYWHERE in the frame — laptop/phone screens, notebooks, "
        "documents, packaging, signage, or background surfaces. Any surface that would carry text too small "
        "to render correctly must instead show it soft, out-of-focus, or as abstract non-letter shapes — "
        "fabricated letter-like scribbles read as AI artifacts and are a failure\n"
        "  ✗ Text inside square brackets: [COMPOSITION CONTEXT], [VISUAL DIRECTION ONLY], [BRAND ATMOSPHERE], [AUDIENCE CONTEXT], [PLATFORM ENERGY], [EXACT TEXT TO RENDER]\n"
        "  ✗ The words: prompt, system, instruction, context, composition, palette, brand colors, rgb, elaborate, describe, component, 5-component, pixel-perfect — these are internal workflow terms\n"
        "  ✗ Any JSON-like syntax, field names, key-value pairs, or schema fragments\n"
        "  ✗ Slide numbers, bullet markers, list syntax, or numbered sequences\n"
        "  ✗ Any text from the composition context, brand atmosphere, audience context, or platform energy sections\n"
        "  ✗ Brand voice phrases, company differentiators, taglines, or audience descriptors — these inform visual style only, never appear as image text\n"
        "  ✗ The brand/company name rendered as standalone text separate from the logo — if the logo reference is provided, it already contains the brand name; do NOT duplicate it as independent text\n"
        "  ✗ The MANDATORY SHOT DIRECTIVE / photography brief paragraph above (or any sentence from it) — that "
        "text describes how to shoot the photo for the photographer; it must never appear printed, captioned, "
        "or overlaid anywhere in the actual image\n"
        + guardrails_extra
        + "=== END GUARDRAILS ==="
    )

    # Product lock mandate — placed before the shot mandate and composition block so it
    # wins any conflict with the SUBJECT field, which is written by a text-only LLM that
    # never sees the actual reference photo and can otherwise invent a different-looking
    # product to match abstract/futuristic brief language.
    product_lock_mandate = ""
    if product_locked:
        product_lock_mandate = (
            "╔══════════════════════════════════════════════════════╗\n"
            "║  PRODUCT IDENTITY LOCK — ABSOLUTE HIGHEST PRIORITY     ║\n"
            "╚══════════════════════════════════════════════════════╝\n"
            "One or more reference photos of the real product are attached to this request — these may include "
            "the physical item itself and/or its packaging, box, or printed label art (not necessarily just "
            "different camera angles of one object). Its exact shape, colors, materials, proportions, and any "
            "labels/markings/brand name/logo/printed text visible in ANY reference are NON-NEGOTIABLE and FIXED — "
            "reproduce them verbatim, never a different device, gadget, container, or symbolic substitute, and "
            "never a different or omitted brand name/logo/text than what the references actually show. Wherever "
            "the text below (including any SUBJECT field) describes the product using invented visual details — "
            "a different shape, material, brand name, or a futuristic/sci-fi reinterpretation — IGNORE that "
            "invented description and render the actual product and its actual branding from the reference "
            "photos instead. Abstract or futuristic language elsewhere in this prompt describes the mood of the "
            "SETTING and LIGHTING around the product, not a redesign of the product or its branding.\n\n"
            "The reference photo(s) may be an ordinary, hand-taken snapshot — imperfect lighting, a mediocre or "
            "awkward camera angle, motion blur, glare, or cluttered background in the reference are incidental "
            "artifacts of how it was casually captured, NOT part of the product's identity. Study the reference "
            "carefully to separate the two: the TRUE PRODUCT (its exact shape, color, material, proportions, "
            "and any visible label/markings/text) must be preserved faithfully, while the photo's own poor "
            "lighting, framing, or angle should NOT be copied into the output. Confidently infer the product's "
            "plausible complete 3D form from whatever partial view the reference shows, and render it "
            "competently, sharply, and attractively from the specific angle THIS shot's directive requires — "
            "even if that angle differs entirely from the one angle the reference happened to capture.\n\n"
            "LABEL/PACKAGING TEXT — NEVER FABRICATE FAKE TEXT: if the product's label, packaging, or printed "
            "markings are visible in this shot, there are only two acceptable outcomes: (a) render the exact "
            "real brand name, dosage, and other printed text from the reference photos, faithfully legible — "
            "this is the default whenever the label is a meaningful part of the frame; or (b) if this shot's "
            "distance or angle would naturally make fine print too small to read (e.g. a wide shot, wide "
            "wide establishing shot, or the label turned away from camera), render the label as a soft, "
            "naturally out-of-focus or distant design element — matching its real colors and general layout at "
            "a glance — WITHOUT attempting to render legible characters. Inventing garbled, scrambled, or "
            "nonsense pseudo-text on a label — text that isn't the real label copy and isn't a real language "
            "either — is a failure exactly like getting the brand name wrong, even when the rest of the shot is "
            "good. When unsure whether text will render legibly, prefer a soft/blurred label over a crisp but "
            "fabricated one.\n"
            "══════════════════════════════════════════════════════════\n\n"
        )

    # Campaign shot mandate — placed before everything else so Gemini cannot miss it.
    # This is a hard directive, NOT wrapped in [COMPOSITION CONTEXT] brackets,
    # so the guardrails do NOT suppress it. It defines the exact camera position,
    # framing, and environment for this specific photo in the campaign.
    shot_mandate = ""
    if campaign_shot_type:
        shot_mandate = (
            "╔══════════════════════════════════════════════════════╗\n"
            "║  MANDATORY SHOT DIRECTIVE — ABSOLUTE HIGHEST PRIORITY  ║\n"
            "╚══════════════════════════════════════════════════════╝\n"
            "The paragraph below is a photography brief describing HOW TO SHOOT this photo — camera "
            "angle, lighting, environment, and narrative framing for the photographer. It is NOT a "
            "caption, headline, or body copy. NEVER render any part of it as visible text, typography, "
            "or a text overlay in the image itself — treat it exactly like a director's verbal "
            "instructions on set, which a viewer of the finished photo would never see written out.\n\n"
            f"{campaign_shot_type}\n\n"
            "This is a professional product campaign photograph. "
            "The shot description above dictates EXACTLY: the camera angle, the product orientation, "
            "the framing, and the environment. Execute it with precision as a PHOTOGRAPH, not as a "
            "poster or graphic with paragraphs of printed text — "
            "deviating from the specified angle or framing is a failure, and so is printing this "
            "description's words onto the image.\n"
            "══════════════════════════════════════════════════════════\n\n"
        )

    # 5-component composition block — placed after shot mandate so Gemini treats it as primary directive
    composition_block = ""
    if components:
        composition_block = (
            "## VISUAL COMPOSITION — HIGHEST PRIORITY DIRECTIVE — execute ALL 5 dimensions exactly as specified; "
            "they override all other descriptions below"
            + (", EXCEPT the PRODUCT IDENTITY LOCK above, which always wins over anything in SUBJECT that "
               "describes the product's appearance" if product_locked else "")
            + " ##\n"
            f"SUBJECT: {components.get('subject', '')}\n"
            f"SETTING: {components.get('setting', '')}\n"
            f"STYLE: {components.get('style', '')}\n"
            f"LIGHTING: {components.get('lighting', '')}\n"
            f"CAMERA ANGLE: {components.get('camera_angle', '')}\n\n"
        )

    # Campaign/product-locked shots are photographs; everything else is a designed graphic.
    # The old unconditional "graphic" opener contradicted the shot mandate's
    # "this is a PHOTOGRAPH, not a poster" and pushed campaign shots toward poster layouts.
    if product_locked or campaign_shot_type:
        opener = f"Photograph a premium {platform} product campaign image ({aspect_ratio}). "
    else:
        opener = f"Design a premium {platform} social media graphic ({aspect_ratio}). "

    return (
        f"{product_lock_mandate}"
        f"{shot_mandate}"
        f"{composition_block}"
        f"{opener}"
        f"Main topic: \"{topic}\". "
        f"{composition_context}"
        f"{brand}"
        f"{colors}"
        f"{fonts}"
        f"{context}"
        f"{platform_tone}"
        f"Visual style: {style}. "
        f"{typography}"
        f"{exact_text_block}"
        f"COMPOSITION: Execute the concept above as a cinematic art director would — not a template, a specific vision. "
        f"Apply these techniques deliberately: environmental storytelling through a single unexpected prop or detail "
        f"that reframes the subject; forced perspective, Dutch angle, or extreme hero framing for visual tension; "
        f"negative space that feels intentional and charged, not empty; a background detail that rewards a second viewing "
        f"— something a viewer notices only after the first impression lands. "
        f"The image must communicate its core idea at thumbnail scale AND reveal new detail on close inspection. "
        f"FORBIDDEN: bordered card inside canvas, square frame inside square, centered text on plain gradient, "
        f"generic white panel on colored background, symmetrical centered compositions — these read as Canva templates, not creative direction. "
        f"Output must look like it was commissioned by a world-class brand, not generated by a default AI pipeline. "
        f"{guardrails}"
    )


def _asset_mandate(use_logo: bool, use_mascot: bool) -> str:
    """Returns a high-priority preamble that forces the model to include logo/mascot.

    Placed at the START of the final prompt so the model sees it before any
    composition instructions. An empty string is returned when neither flag is set.
    """
    parts: list[str] = []
    if use_logo:
        parts.append(
            "MANDATORY LOGO: The brand logo reference image MUST be composited into the final image. "
            "Place it where it fits naturally in the composition — a corner (bottom-right or top-right preferred), an edge, or integrated into the scene if that reads better — rendered with clean anti-aliased edges. "
            "Do NOT omit the logo. A final image without the logo is WRONG."
        )
    if use_mascot:
        parts.append(
            "MANDATORY MASCOT: The brand mascot reference image MUST appear in the final image. "
            "Incorporate it naturally into the scene. "
            "Do NOT omit the mascot. A final image without the mascot is WRONG."
        )
    if not parts:
        return ""
    return (
        "=== NON-NEGOTIABLE ASSET REQUIREMENTS — HIGHEST PRIORITY ===\n"
        + "\n".join(parts)
        + "\n=== END ASSET REQUIREMENTS ===\n\n"
    )


async def generate_social_image(
    prompt: str,
    platform: str,
    aspect_ratio: str = "",
    use_logo: bool = False,
    use_mascot: bool = False,
    user_id: str = "",
    organization_id: str = "",
    brand_kit=None,
    context_hints: str = "",
    text_spec: dict | None = None,
    reference_urls: list[str] | None = None,
    carousel_anchor_b64: str | None = None,
    campaign_mode: bool = False,
    brand_images: list | None = None,
    campaign_shot_type: str = "",
    use_brand_colors: bool = True,
    concept_hint: str = "",
) -> ImageResult:
    """Generate a premium social media image.

    Both mascot and logo are passed as raw image bytes directly to Gemini.
    Gemini is given explicit numbered reference instructions so it knows
    which asset is the mascot character and which is the logo, and how to
    use each naturally within the scene.

    `concept_hint`, when provided, is the concise user-authored brief (e.g. a
    campaign brief or additional-context field) used for the concept +
    5-component elaboration steps instead of `context_hints`. Callers that
    build `context_hints` out of large boilerplate (system prompts, style
    locks, role instructions) should pass the actual user text here so it
    isn't buried past the truncation window those steps apply.
    """
    if not aspect_ratio:
        aspect_ratio = _ASPECT_FOR_PLATFORM.get(platform, "1:1")

    # ── Load brand kit (always) ───────────────────────────────────────────
    if brand_kit is None and organization_id:
        from core.brand_kit import load_brand_kit
        brand_kit = await load_brand_kit(organization_id)
        logger.info("brand_kit auto-loaded | org=%s company=%s", organization_id, brand_kit.company_name)

    # ── Creative concept + 5-component elaboration ───────────────────────────
    # Step 1: invent a specific cinematic visual concept (the "director's brief").
    # Step 2: elaborate THAT concept into Subject/Setting/Style/Lighting/Camera Angle.
    # Both steps fall back silently so generation always completes.
    # Campaign mode means the reference image(s)/anchor are the literal, already-photographed
    # product whose appearance must never be reinvented by the text-only concept/elaboration steps.
    product_locked = campaign_mode
    concept_context = concept_hint or context_hints
    concept = await _generate_creative_concept(prompt, platform, brand_kit, extra_context=concept_context, product_locked=product_locked, campaign_shot_type=campaign_shot_type)
    components = await _elaborate_prompt_5component(concept or prompt, platform, brand_kit, extra_context=concept_context, campaign_shot_type=campaign_shot_type, product_locked=product_locked)

    base_prompt = _build_base_prompt(prompt, platform, brand_kit, aspect_ratio, context_hints, text_spec, components, campaign_shot_type, use_brand_colors, product_locked)

    logger.info(
        "image_gen start | user=%s platform=%s aspect=%s use_logo=%s use_mascot=%s brand=%s",
        user_id or "anon", platform, aspect_ratio, use_logo, use_mascot,
        brand_kit.company_name if brand_kit else "none",
    )

    if settings.MOCK_MODE:
        return ImageResult(image_base64=_PLACEHOLDER_B64, content_type="image/png", prompt_used=base_prompt)

    from core.llm import LLMClient
    llm = LLMClient()

    # ── Carousel continuity mode: slide 1 is the visual anchor ───────────
    if carousel_anchor_b64:
        import base64 as _base64
        import io as _io
        from PIL import Image as _PIL_Image
        raw_anchor = _base64.b64decode(carousel_anchor_b64)
        # Convert to JPEG and downscale — JPEG strips AI-generation metadata that triggers
        # Gemini's IMAGE_OTHER policy; smaller size avoids input budget issues.
        _img = _PIL_Image.open(_io.BytesIO(raw_anchor)).convert("RGB")
        _w, _h = _img.size
        _max = 200
        if max(_w, _h) > _max:
            _scale = _max / max(_w, _h)
            _img = _img.resize((int(_w * _scale), int(_h * _scale)), _PIL_Image.LANCZOS)
        _buf = _io.BytesIO()
        _img.save(_buf, format="JPEG", quality=72)
        anchor_jpeg = _buf.getvalue()
        anchor_images: list[bytes] = [anchor_jpeg]
        anchor_instructions = [
            "Reference image 1 is a style/character reference from slide 1 of this carousel. "
            "Maintain visual continuity with it: same overall color grade and atmosphere, "
            "same lighting style and mood, same general environment and setting. "
            "If any people appear in the reference, the same person must appear in this slide — "
            "same face, build, clothing, and style — shown in a different pose or action that fits this slide's message. "
            "This is a new scene, not a copy — only the person and visual atmosphere carry over."
        ]
        if use_mascot and brand_kit and brand_kit.mascot_url:
            mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
            if mascot_bytes:
                anchor_images.append(mascot_bytes)
                anchor_instructions.append(
                    f"Reference image {len(anchor_images)} is the brand mascot. "
                    f"Place it in the same position and size as it appears in slide 1."
                )
        if use_logo and brand_kit and brand_kit.logo_url:
            logo_bytes = await _fetch_asset(brand_kit.logo_url)
            if logo_bytes:
                anchor_images.append(logo_bytes)
                anchor_instructions.append(
                    f"MANDATORY: Reference image {len(anchor_images)} is the brand logo. "
                    f"You MUST include it — its absence is a failure. "
                    f"Reproduce it with faithful accuracy: preserve the exact shape silhouette, every color, and correct proportions. "
                    f"If the logo has a background colour, ignore it — composite only the logo mark with no white box or rectangular border. "
                    f"Place it in the bottom-right corner, occupying 8-12% of image width. Crisp and exact."
                )
        mandate = _asset_mandate(use_logo and bool(brand_kit and brand_kit.logo_url), use_mascot and bool(brand_kit and brand_kit.mascot_url))
        full_prompt = mandate + base_prompt + "\n\n" + "\n".join(anchor_instructions)
        b64 = await llm.generate_image_with_image_bytes(full_prompt, anchor_images, aspect_ratio=aspect_ratio)
        logger.info("image_gen carousel-anchor done | user=%s slide", user_id or "anon")
        return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

    # ── Reference-image mode: product URL refs (all campaign photos) or theme inspiration ──
    has_references = bool(reference_urls)
    if has_references:
        import asyncio as _asyncio
        ref_bytes_list = await _asyncio.gather(*[_fetch_asset(url) for url in reference_urls])
        ref_images_ext = [b for b in ref_bytes_list if b]
        if not ref_images_ext:
            logger.warning("all reference fetches failed | user=%s urls=%s — falling through to brand kit mode", user_id, reference_urls)
        else:
            all_images: list[bytes] = list(ref_images_ext)
            extra_instructions: list[str] = []

            if campaign_mode:
                product_instructions = product_identity_instructions(len(ref_images_ext))

                if use_mascot and brand_kit and brand_kit.mascot_url:
                    mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
                    if mascot_bytes:
                        all_images.append(mascot_bytes)
                        idx = len(all_images)
                        extra_instructions.append(
                            f"MANDATORY: Reference image {idx} is the brand mascot character. "
                            f"You MUST include it in the final image — its absence is a failure. "
                            f"Place it as a small, tasteful supporting element — e.g. peeking from a corner, "
                            f"appearing small in the background, or as a subtle accent. "
                            f"The PRODUCT from the first reference images remains the undeniable hero — "
                            f"do NOT make the mascot the primary or equal subject."
                        )
                        logger.info("mascot reference added (campaign mode) | user=%s", user_id)

                if use_logo and brand_kit and brand_kit.logo_url:
                    logo_bytes = await _fetch_asset(brand_kit.logo_url)
                    if logo_bytes:
                        all_images.append(logo_bytes)
                        idx = len(all_images)
                        extra_instructions.append(
                            f"MANDATORY: Reference image {idx} is the brand logo. "
                            f"You MUST include it in the final image — its absence is a failure. "
                            f"Reproduce it with faithful accuracy: preserve the exact shape silhouette, every color as it appears in the reference, correct proportions, and any internal text or distinctive marks. "
                            f"Do NOT simplify, redraw, or reinterpret it. "
                            f"If the logo has a background colour, ignore it — composite only the logo mark itself with no white box or rectangular border. "
                            f"Place it where it fits naturally in the composition — a corner, an edge, or integrated into the scene — "
                            f"occupying roughly 8-12% of the image width. Small enough not to compete with the product hero, but always clearly visible."
                        )
                        logger.info("logo reference added (campaign mode) | user=%s", user_id)

                if brand_images:
                    import asyncio as _asyncio
                    bi_urls = [bi.url if hasattr(bi, "url") else bi["url"] for bi in brand_images]
                    bi_prompts = [bi.prompt if hasattr(bi, "prompt") else bi.get("prompt") for bi in brand_images]
                    bi_bytes_list = await _asyncio.gather(*[_fetch_asset(url) for url in bi_urls])
                    for bi_bytes, bi_prompt, bi_url in zip(bi_bytes_list, bi_prompts, bi_urls):
                        if bi_bytes:
                            all_images.append(bi_bytes)
                            idx = len(all_images)
                            if bi_prompt:
                                extra_instructions.append(f"MANDATORY: Reference image {idx}: {bi_prompt} — you MUST incorporate it visibly.")
                            else:
                                extra_instructions.append(
                                    f"MANDATORY: Reference image {idx} is a brand asset that MUST appear in the final image — its absence is a failure. "
                                    f"Study its subjects, characters, or visual elements and incorporate them naturally into the scene."
                                )
                            logger.info("brand_image added (campaign mode) | user=%s idx=%d", user_id, idx)
                        else:
                            logger.warning("brand_image fetch failed (campaign mode) | user=%s url=%s", user_id, bi_url)

                mandate = _asset_mandate(
                    use_logo and bool(brand_kit and brand_kit.logo_url),
                    use_mascot and bool(brand_kit and brand_kit.mascot_url),
                )
                full_prompt = (
                    f"{mandate}"
                    f"{base_prompt}\n\n"
                    f"PRODUCT CAMPAIGN PHOTOGRAPH: This is a professional product campaign shot, not a brand "
                    f"awareness graphic. The uploaded product must be clearly, prominently visible and in sharp "
                    f"focus in EVERY photo — never sidelined, blurred beyond recognition, tiny, or cropped out, "
                    f"even in photos whose composition role centers a person's emotion or story beat. The "
                    f"narrative can lead with a human moment, but the product itself is never an afterthought — "
                    f"it must always read as a deliberate, unmistakable part of the frame.\n\n"
                    f"{product_instructions}"
                    + ("\n" + "\n".join(extra_instructions) if extra_instructions else "")
                )
            else:
                # ── Standard mode: reference images are mood/theme inspiration ──
                if use_mascot and brand_kit and brand_kit.mascot_url:
                    mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
                    if mascot_bytes:
                        all_images.append(mascot_bytes)
                        idx = len(all_images)
                        extra_instructions.append(
                            f"Reference image {idx} is a mascot character. "
                            f"Study the character's visual identity — shape, colors, face, style, proportions. "
                            f"Recreate this character in a COMPLETELY NEW scene. "
                            f"Place the character naturally in the scene, actively engaged with the topic, in a dynamic pose."
                        )
                        logger.info("mascot reference added (ref mode) | user=%s", user_id)

                if use_logo and brand_kit and brand_kit.logo_url:
                    logo_bytes = await _fetch_asset(brand_kit.logo_url)
                    if logo_bytes:
                        all_images.append(logo_bytes)
                        idx = len(all_images)
                        extra_instructions.append(
                            f"MANDATORY: Reference image {idx} is the brand logo. "
                            f"You MUST include it in the final image — its absence is a failure. "
                            f"Reproduce it with faithful accuracy: preserve the exact shape silhouette, every color as it appears in the reference, correct proportions, and any internal text or distinctive marks. "
                            f"Do NOT simplify, redraw, or reinterpret it. "
                            f"If the logo has a background colour, ignore it — composite only the logo mark itself with no white box or rectangular border. "
                            f"Place it where it fits naturally in the composition — a corner, an edge, or integrated into the scene — "
                            f"occupying roughly 8-12% of the image width. Crisp and exact."
                        )
                        logger.info("logo reference added (ref mode) | user=%s", user_id)

                if brand_images:
                    import asyncio as _asyncio
                    bi_urls = [bi.url if hasattr(bi, "url") else bi["url"] for bi in brand_images]
                    bi_prompts = [bi.prompt if hasattr(bi, "prompt") else bi.get("prompt") for bi in brand_images]
                    bi_bytes_list = await _asyncio.gather(*[_fetch_asset(url) for url in bi_urls])
                    for bi_bytes, bi_prompt, bi_url in zip(bi_bytes_list, bi_prompts, bi_urls):
                        if bi_bytes:
                            all_images.append(bi_bytes)
                            idx = len(all_images)
                            if bi_prompt:
                                extra_instructions.append(f"Reference image {idx}: {bi_prompt}")
                            else:
                                extra_instructions.append(
                                    f"Reference image {idx} is a brand asset. "
                                    f"Study its subjects, characters, objects, or visual elements. "
                                    f"Recreate them within the newly generated scene in a pose, angle, or context "
                                    f"that fits the composition naturally — do NOT copy the reference background or layout. "
                                    f"Ensure the key subjects remain clearly present and recognizable."
                                )
                            logger.info("brand_image added (ref mode) | user=%s idx=%d", user_id, idx)
                        else:
                            logger.warning("brand_image fetch failed (ref mode) | user=%s url=%s", user_id, bi_url)

                theme_instructions = "\n".join(
                    f"Reference image {i+1}: Study its overall theme, mood, and general visual direction. Use as loose inspiration only — do NOT copy layouts, text, or specific elements."
                    for i in range(len(ref_images_ext))
                )
                mandate = _asset_mandate(
                    use_logo and bool(brand_kit and brand_kit.logo_url),
                    use_mascot and bool(brand_kit and brand_kit.mascot_url),
                )
                full_prompt = (
                    f"{mandate}"
                    f"{base_prompt}\n\n"
                    f"THEME INSPIRATION: The reference images are mood/theme guides — extract their general vibe, "
                    f"dominant energy, and overall feel. Create a completely original design that reflects the same "
                    f"mood while applying the brand kit above. Do NOT reproduce any elements from the references.\n\n"
                    f"{theme_instructions}"
                    + ("\n" + "\n".join(extra_instructions) if extra_instructions else "")
                )

            b64 = await llm.generate_image_with_image_bytes(full_prompt, all_images, aspect_ratio=aspect_ratio)
            logger.info("image_gen reference+brand done | user=%s refs=%d logo=%s mascot=%s campaign=%s", user_id, len(ref_images_ext), use_logo, use_mascot, campaign_mode)
            return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

    ref_images: list[bytes] = []
    ref_instructions: list[str] = []

    if use_mascot and brand_kit and brand_kit.mascot_url:
        mascot_bytes = await _fetch_asset(brand_kit.mascot_url)
        if mascot_bytes:
            ref_images.append(mascot_bytes)
            idx = len(ref_images)
            ref_instructions.append(
                f"Reference image {idx} is a mascot character. "
                f"Study the character's visual identity — shape, colors, face, style, proportions. "
                f"Recreate this character in a COMPLETELY NEW scene built from scratch. "
                f"Do NOT use any background or environment from the reference. "
                f"Place the character naturally in the scene, actively engaged with the topic, "
                f"in a dynamic pose that fits the composition."
            )
            logger.info("mascot reference added | user=%s url=%s", user_id, brand_kit.mascot_url)
        else:
            logger.warning("mascot fetch failed | user=%s url=%s", user_id, brand_kit.mascot_url)

    if use_logo and brand_kit and brand_kit.logo_url:
        logo_bytes = await _fetch_asset(brand_kit.logo_url)
        if logo_bytes:
            ref_images.append(logo_bytes)
            idx = len(ref_images)
            ref_instructions.append(
                f"MANDATORY: Reference image {idx} is the brand logo. "
                f"You MUST include it in the final image — its absence is a failure. "
                f"Reproduce it with faithful accuracy: preserve the exact shape silhouette, every color as it appears in the reference, correct proportions, and any internal text or distinctive marks. "
                f"Do NOT simplify, redraw, reinterpret, or approximate it. "
                f"If the logo has a background colour, ignore it — composite only the logo mark itself with no white box or rectangular border. "
                f"Place it where it fits naturally in the composition — a corner, an edge, or integrated into the scene — "
                f"occupying roughly 8-12% of the image width. Crisp and exact."
            )
            logger.info("logo reference added | user=%s url=%s", user_id, brand_kit.logo_url)
        else:
            logger.warning("logo fetch failed | user=%s url=%s", user_id, brand_kit.logo_url)

    # ── Persistent brand images: user-selected assets with optional instructions ──
    if brand_images:
        import asyncio as _asyncio
        bi_urls = [bi.url if hasattr(bi, "url") else bi["url"] for bi in brand_images]
        bi_prompts = [bi.prompt if hasattr(bi, "prompt") else bi.get("prompt") for bi in brand_images]
        bi_bytes_list = await _asyncio.gather(*[_fetch_asset(url) for url in bi_urls])
        for bi_bytes, bi_prompt, bi_url in zip(bi_bytes_list, bi_prompts, bi_urls):
            if bi_bytes:
                ref_images.append(bi_bytes)
                idx = len(ref_images)
                if bi_prompt:
                    ref_instructions.append(f"Reference image {idx}: {bi_prompt}")
                else:
                    ref_instructions.append(
                        f"Reference image {idx} is a brand asset. "
                        f"Study its subjects, characters, objects, or visual elements. "
                        f"Recreate them within the newly generated scene in a pose, angle, or context "
                        f"that fits the composition naturally — do NOT copy the reference background or layout. "
                        f"Ensure the key subjects remain clearly present and recognizable."
                    )
                logger.info("brand_image added | user=%s idx=%d has_prompt=%s", user_id, idx, bool(bi_prompt))
            else:
                logger.warning("brand_image fetch failed | user=%s url=%s", user_id, bi_url)

    if ref_images:
        logo_only = use_logo and not use_mascot and len(ref_images) == 1
        preamble = (
            "CRITICAL INSTRUCTION: Build a COMPLETELY NEW social media scene from scratch. "
            "Do NOT use the reference image as the scene background. "
            "The reference is the brand logo — reproduce it with faithful accuracy: preserve the exact shape silhouette, every color as it appears in the reference, correct proportions, and any internal text or distinctive marks. "
            "If the logo has a background colour, ignore it and composite only the logo mark itself with no white box or rectangular border. "
            "Place it where it fits naturally in the scene — a corner, an edge, or integrated into the composition. "
            "Do NOT simplify, redraw, or reinterpret the logo design.\n\n"
            if logo_only else ""
        )
        mandate = _asset_mandate(use_logo and bool(brand_kit and brand_kit.logo_url), use_mascot and bool(brand_kit and brand_kit.mascot_url))
        full_prompt = mandate + base_prompt + "\n\n" + preamble + "\n".join(ref_instructions)
        b64 = await llm.generate_image_with_image_bytes(full_prompt, ref_images, aspect_ratio=aspect_ratio)
        logger.info("image generated with %d reference(s) logo_only=%s | user=%s", len(ref_images), logo_only, user_id)
    else:
        full_prompt = base_prompt
        b64 = await llm.generate_image(base_prompt, aspect_ratio=aspect_ratio)
        logger.info("image generated (no references) | user=%s", user_id)

    logger.info("image_gen done | user=%s platform=%s", user_id or "anon", platform)
    return ImageResult(image_base64=b64, content_type="image/png", prompt_used=full_prompt)

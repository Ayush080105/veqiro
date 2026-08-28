import re
import logging
from pydantic import BaseModel
from core.image_gen import _hex_to_color_name, _font_to_style

logger = logging.getLogger("carousel")

MAX_SLIDES = 8


def _extract_numbers(text: str) -> list[str]:
    """Extract numeric phrases from topic text to lock consistency across carousel slides."""
    raw = re.findall(
        r'(?:[\$£€])?\d[\d,\.]*\s*(?:%|[kKmMbBxX]|employees?|users?|customers?|clients?|months?|weeks?|days?|hours?)?',
        text, re.IGNORECASE,
    )
    seen: set[str] = set()
    out = []
    for m in (r.strip() for r in raw):
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


class CarouselImagePrompt(BaseModel):
    """Visual spec for a single carousel slide image — no caption, just image generation data."""
    slide_number: int
    image_prompt: str       # visual composition prompt for Gemini — no text content here
    context_note: str       # visual direction note (used as context_hints)
    headline: str = ""      # exact headline text to render in the image
    stat: str | None = None    # exact stat/power phrase, or None
    subtext: str | None = None  # optional 1-line supporting copy, or None


class CarouselContent(BaseModel):
    """One caption (the post text) + N image prompts (the visual slides)."""
    caption_title: str
    caption_body: str
    hashtags: list[str]
    cta: str
    meta_description: str
    word_count: int
    tone_used: str
    design_system: str = ""  # shared visual template applied to all slides
    image_prompts: list[CarouselImagePrompt]


_SLIDE_ROLES = {
    2: ["hook / opening visual", "proof or punchline / closing visual"],
    3: ["hook", "core insight visual", "takeaway / CTA visual"],
    4: ["hook", "problem visual", "solution visual", "takeaway / CTA visual"],
    5: ["hook", "problem", "insight 1", "insight 2", "takeaway / CTA visual"],
    6: ["hook", "problem", "insight 1", "insight 2", "proof/stat", "takeaway / CTA visual"],
    7: ["hook", "problem", "insight 1", "insight 2", "insight 3", "proof/stat", "takeaway / CTA visual"],
    8: ["hook", "problem", "insight 1", "insight 2", "insight 3", "proof/stat", "social proof", "takeaway / CTA visual"],
}

# Each slide role maps to a photographic/cinematic visual approach — real people, real environments
_SLIDE_COMPOSITIONS = {
    "hook": "dramatic split diagonal — before/after contrast with real person at the inflection point, immediate emotional stakes, cinematic atmospheric color grade",
    "hook / opening visual": "high-impact opening scene — real person facing the central tension, environment telegraphs the stakes, strong subject with atmospheric depth behind them",
    "proof or punchline / closing visual": "payoff moment — transformed subject in empowered environment, emotional resolution, bright confident energy contrasting earlier struggle",
    "core insight visual": "concept scene — person interacting with the central idea in a real-world setting, single dramatic light source, environment that symbolises the insight",
    "problem visual": "pain point close-up — stressed person in chaotic environment, warm dark amber tones, shallow depth of field isolating the expression of struggle",
    "solution visual": "transformation scene — same persona now calm and confident, cool clean light, modern space, forward momentum visible in body language and environment",
    "insight 1": "medium shot — person with a visual element embodying this insight, complementary color grade to the hook slide",
    "insight 2": "wider environment shot — the insight playing out in a real space, brand color accent visible in a scene detail or light source",
    "insight 3": "tight detail shot — close crop of the key element representing this insight, high contrast directional lighting",
    "proof/stat": "stark impact shot — single powerful visual that embodies the statistic, minimal environment, brand color in a dominant light source or foreground element",
    "social proof": "authentic human moment — person in a genuine satisfied interaction, warm natural light, direct or implied eye contact with the viewer",
    "takeaway / CTA visual": "confident closing scene — subject facing the viewer, clean modern environment with brand color accents, sense of momentum and forward possibility",
}


def _build_carousel_prompt(
    topic: str,
    platform: str,
    count: int,
    brand_name: str,
    brand_voice: str,
    tone: str,
    additional_context: str,
    brand_colors: dict | None = None,
    brand_fonts: dict | None = None,
    industry: str = "",
    target_audience: str = "",
    locked_numbers: list[str] | None = None,
) -> str:
    roles = _SLIDE_ROLES.get(count, _SLIDE_ROLES[5])
    _default_composition = "cinematic scene that embodies this slides message, real person or environment, brand color grade"
    roles_str = "\n".join(
        f"  Image {i+1}: {r} — visual approach: {_SLIDE_COMPOSITIONS.get(r, _default_composition)}"
        for i, r in enumerate(roles)
    )

    platform_limits = {
        "linkedin": "Under 150 words. Professional, paragraph style, no bullet points.",
        "twitter": "Under 250 characters. One punchy, bold statement.",
        "instagram": "Under 120 words. Short sentences, emojis welcome.",
    }
    limit_rule = platform_limits.get(platform, "Keep it concise and platform-native.")

    brand_context = ""
    if brand_name:
        brand_context = f"Brand: {brand_name}. "
    if brand_voice:
        brand_context += f"Voice: {brand_voice}. "
    if tone:
        brand_context += f"Tone: {tone}. "
    if industry:
        brand_context += f"Industry: {industry}. "
    if target_audience:
        brand_context += f"Audience: {target_audience}. "
    if additional_context:
        brand_context += f"Context: {additional_context}. "

    # Brand color names for photographic/cinematic use — color grading, not flat fills
    brand_visual = ""
    if brand_colors:
        primary = brand_colors.get("primary", "")
        secondary = brand_colors.get("secondary", "")
        accent = brand_colors.get("accent", "")
        def _hex_pair(role: str, hex_code: str) -> str:
            if not hex_code:
                return ""
            hex_norm = hex_code if hex_code.startswith("#") else f"#{hex_code}"
            return f"{role} {hex_norm} ({_hex_to_color_name(hex_code)})"

        parts = [
            _hex_pair("primary", primary),
            _hex_pair("secondary", secondary),
            _hex_pair("accent", accent),
        ]
        color_str = ", ".join(p for p in parts if p)
        if color_str:
            brand_visual += (
                f"Brand color palette (use for cinematic color grading, accent light sources, and text overlays — never print as raw text): {color_str}. "
            )
    if brand_fonts:
        heading = brand_fonts.get("heading") or brand_fonts.get("primary") or brand_fonts.get("display") or ""
        body = brand_fonts.get("body") or brand_fonts.get("secondary") or ""
        # Image models can't render named typefaces — describe the typographic
        # personality instead of injecting raw font names like "Poppins".
        if heading:
            brand_visual += f"Heading typography style: {_font_to_style(heading)}. "
        if body:
            brand_visual += f"Body typography style: {_font_to_style(body)}. "

    # Locked numbers block — injected when numeric facts are extracted from topic
    locked_block = ""
    if locked_numbers:
        nums = "\n".join(f"  • {n}" for n in locked_numbers)
        locked_block = (
            f"LOCKED NUMBERS — these exact values appear in the topic. "
            f"Every slide that references a metric MUST use these precise values — never approximate or change them:\n"
            f"{nums}\n\n"
        )

    return (
        f"Create a {platform} carousel post with {count} swipeable photographic images for this topic.\n"
        f"Topic: \"{topic}\"\n"
        f"{brand_context}\n"
        f"{brand_visual}\n"
        f"{locked_block}"
        f"TASK:\n"
        f"1. Write ONE single caption for the whole post ({limit_rule})\n"
        f"2. Define ONE VISUAL DNA — a shared cinematic photographic style that unifies all slides.\n"
        f"3. Create {count} image prompts — each describes a real photographic scene that tells that slide's visual story.\n\n"
        f"Visual narrative arc (follow exactly):\n{roles_str}\n\n"
        f"VISUAL DNA rules (this is the most important part):\n"
        f"- The visual DNA defines how every slide FEELS photographically — NOT a layout template or infographic.\n"
        f"- Define it in 2-3 sentences covering:\n"
        f"  * Color grade: the cinematic color treatment applied across all images — incorporate the brand's primary color "
        f"(e.g. 'warm amber and teal split grade with golden accent light', 'cool desaturated teal with yellow accent highlights'). "
        f"This is a photographic color grade, not a background fill.\n"
        f"  * Lighting style: consistent light quality across all slides "
        f"(e.g. 'soft directional window light with atmospheric haze', 'hard dramatic side lighting casting sharp shadows')\n"
        f"  * Composition approach: how subjects are framed "
        f"(e.g. 'diagonal splits, medium-to-wide shots, subject offset left', 'alternating close-ups and wide establishing shots')\n"
        f"  * Typography treatment: how text overlays appear across all slides "
        f"(e.g. 'large bold white headline bottom-left, semi-transparent dark gradient behind text area')\n"
        f"  * Logo position: 'logo mark bottom-right corner' — NEVER 'brand name as text'\n"
        f"  * Recurring protagonist: if the slides share a human story, cast ONE consistent protagonist and "
        f"describe them concretely in the visual DNA (age range, hair, clothing) — the SAME person must appear "
        f"across those slides with the same face, hair, and outfit, only their pose, action, and emotion "
        f"changing per slide. Never swap in a different-looking person mid-carousel.\n"
        f"- This visual_dna string gets embedded verbatim at the start of every image_prompt.\n\n"
        f"Image prompt rules:\n"
        f"- Start every image_prompt with 'VISUAL DNA: [the exact visual_dna text above]. '\n"
        f"- Then describe the PHOTOREALISTIC SCENE for this slide: who is in it, where they are, "
        f"what they're doing, the environment, the emotional mood, the specific lighting.\n"
        f"- Think like a professional photographer/director — each slide is a real campaign photograph, not a graphic.\n"
        f"- The scene, subject, and environment CHANGE per slide; the color grade, lighting style, and typography treatment NEVER change.\n"
        f"- ABSOLUTELY FORBIDDEN (these produce flat template images — never describe):\n"
        f"  * Colored boxes, cards, panels, or frames with icons inside\n"
        f"  * Flat solid-color backgrounds with text only\n"
        f"  * Infographic-style layouts with labeled sections\n"
        f"  * Icon or illustration-based visuals on solid backgrounds\n"
        f"  * Bordered panels or square-inside-square compositions\n"
        f"  * Generic gradient backgrounds with text overlaid\n"
        f"  * Any design that looks like a Canva template\n"
        f"- INSTEAD, always describe:\n"
        f"  * Real people in real environments that embody the slide's message\n"
        f"  * Cinematic photography with depth — foreground subject, midground action, atmospheric background\n"
        f"  * Brand color grade as a photographic treatment, accent lights, or environmental color\n"
        f"  * Dramatic lighting — shadows, highlights, atmospheric haze, directional sources\n"
        f"  * Diagonal compositions, diagonal splits, architectural depth, human emotion\n"
        f"- context_note: 5-8 words describing the visual mood and scene "
        f"(e.g. 'stressed person, chaotic warm amber tones', 'confident CEO, clean cool office'). "
        f"NEVER write analytical text or prose summaries.\n\n"
        f"Text fields per slide (CRITICAL — these control ALL text rendered in each image):\n"
        f"- headline: 3-5 words, the EXACT main headline to render. Correct spelling. "
        f"Use LOCKED NUMBERS exactly if the slide references a metric.\n"
        f"- stat: optional key stat or power phrase (e.g. '6x faster', '$2M ARR'). "
        f"Must use LOCKED NUMBERS exactly. Use null if not needed for this slide.\n"
        f"- subtext: optional 1-line supporting copy, max 8 words. Use null if not needed.\n\n"
        f"Caption rules — vary this from post to post, do not default to the same shape every time:\n"
        f"- Opener: pick ONE of — a blunt fact/number, a counterintuitive claim, a one-line scene, a direct "
        f"'you' address, a flat opinion. Do not always lead with a stat.\n"
        f"- CTA: vary the form — a specific question, a direct action, a mini-challenge, an opinion prompt, "
        f"or none at all. NEVER use the generic survey template '[stat] of people feel/do X — how do you feel? "
        f"Let us know' or close variants ('what about you?', 'share your thoughts below') — it reads as "
        f"AI-generated engagement bait.\n\n"
        f"Return ONLY a JSON object:\n"
        f"{{\n"
        f'  "caption_title": "<post title/headline>",\n'
        f'  "caption_body": "<ready-to-publish post caption text>",\n'
        f'  "hashtags": ["<tag1>", "<tag2>", ...],\n'
        f'  "cta": "<call to action>",\n'
        f'  "meta_description": "<SEO meta description>",\n'
        f'  "word_count": <integer>,\n'
        f'  "tone_used": "<tone>",\n'
        f'  "design_system": "<2-3 sentence VISUAL DNA: color grade + lighting style + composition approach + typography treatment + logo position — describe a cinematic photographic style, NOT a flat design template. Example: \'Warm amber-teal split color grade, soft directional window light casting sharp shadows. Medium-to-wide shots with diagonal composition, subject offset left. Large bold white headline bottom-left over dark gradient area; logo mark bottom-right corner.\'>",\n'
        f'  "image_prompts": [\n'
        f'    {{\n'
        f'      "slide_number": 1,\n'
        f'      "image_prompt": "VISUAL DNA: [copy design_system here]. [photorealistic scene: describe the person/subject, environment, action, emotional mood, specific lighting — as if directing a real campaign photograph]",\n'
        f'      "context_note": "stressed overworked person, chaotic warm tones",\n'
        f'      "headline": "Exact 3-5 word headline to render",\n'
        f'      "stat": "Key stat or null",\n'
        f'      "subtext": "1-line supporting copy or null"\n'
        f'    }},\n'
        f'    ...\n'
        f'  ]\n'
        f"}}\n"
        f"Return ONLY the JSON object, no markdown fences."
    )


async def build_carousel_content(
    topic: str,
    platform: str,
    count: int,
    brand_kit,
    llm,
    additional_context: str = "",
    tone: str = "",
) -> CarouselContent:
    """Generate one caption + N connected image prompts for a carousel post."""
    count = max(2, min(count, MAX_SLIDES))

    brand_name = brand_kit.company_name if brand_kit else ""
    brand_voice = brand_kit.brand_voice if brand_kit else ""
    brand_colors = brand_kit.brand_colors if brand_kit else None
    brand_fonts = brand_kit.brand_fonts if brand_kit else None
    industry = brand_kit.industry if brand_kit else ""
    target_audience = brand_kit.target_audience if brand_kit else ""

    system = (
        "You are a world-class social media creative director specialising in photographic carousel posts. "
        "Carousels have ONE caption and multiple swipeable images that tell a cinematic visual story through photography. "
        "The caption hooks the reader; the images are real campaign photographs that reward the swipe. "
        "Think like a film director — each slide is a real photograph in a visual narrative, never a flat graphic design or infographic. "
        "Use the brand's color palette as cinematic color grading and accent lighting, not as flat background fills. "
        "Never generate design templates, icon-based layouts, colored boxes, or infographic-style panels — always real people, real environments, real emotion."
    )
    locked_numbers = _extract_numbers(f"{topic} {additional_context}")

    prompt = _build_carousel_prompt(
        topic, platform, count, brand_name, brand_voice, tone, additional_context,
        brand_colors=brand_colors, brand_fonts=brand_fonts,
        industry=industry, target_audience=target_audience,
        locked_numbers=locked_numbers,
    )

    logger.info("carousel build start | topic=%s platform=%s count=%d", topic, platform, count)

    try:
        data = await llm.complete_json(
            provider="openai",
            model="gpt-5.6-luna",
            system=system,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
        )
        content = CarouselContent(**data)
        logger.info("carousel build done | slides=%d", len(content.image_prompts))
        return content
    except Exception as exc:
        logger.error("carousel build parse failed | error=%s", exc)
        raise ValueError(f"Carousel generation returned unparseable data — retry. ({exc})")

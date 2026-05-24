import logging
from pydantic import BaseModel
from core.utils import safe_json_loads

logger = logging.getLogger("carousel")

MAX_SLIDES = 8


class CarouselImagePrompt(BaseModel):
    """Visual spec for a single carousel slide image — no caption, just image generation data."""
    slide_number: int
    image_prompt: str   # full vivid prompt for Gemini
    context_note: str   # how this connects to the previous slide (used as context_hints)


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

# Each slide role maps to a distinct dynamic composition — prevents monotonic square-in-square layouts
_SLIDE_COMPOSITIONS = {
    "hook": "full-bleed brand color background, massive oversized headline text at bold angle, no borders or frames",
    "hook / opening visual": "full-bleed brand color background, massive oversized headline at bold angle, no borders",
    "proof or punchline / closing visual": "strong color split diagonally, bold punchline text on one side, striking visual on the other",
    "core insight visual": "large bold statistic or quote centered, geometric brand-color shape (circle or triangle) as background accent",
    "problem visual": "dark moody background, cracked or tension visual metaphor, bold warning-style headline in brand accent color",
    "solution visual": "bright positive brand color, bold upward arrow or breakout shape, headline overlapping a visual element",
    "insight 1": "asymmetric layout — big number '01' in brand color far left, insight text right-aligned with thin horizontal rule",
    "insight 2": "split composition: colored band top-third, white/light lower two-thirds, headline bridging the split",
    "insight 3": "data-visualization inspired — bold chart or graph shape in brand colors, single key takeaway overlaid",
    "proof/stat": "stark minimal — huge impactful number in brand primary color dominates 60% of the image, small supporting context",
    "social proof": "quote marks as giant decorative element in brand accent, testimonial text inside, person/brand name below",
    "takeaway / CTA visual": "strong brand gradient or solid color, clean bold CTA text centered, arrow or button shape element, brand name bottom-right",
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
) -> str:
    roles = _SLIDE_ROLES.get(count, _SLIDE_ROLES[5])
    roles_str = "\n".join(
        f"  Image {i+1}: {r} — composition: {_SLIDE_COMPOSITIONS.get(r, 'dynamic, bold, brand-driven layout')}"
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

    # Build an explicit brand visual spec so the design_system uses real brand values
    brand_visual = ""
    if brand_colors:
        primary = brand_colors.get("primary", "")
        secondary = brand_colors.get("secondary", "")
        accent = brand_colors.get("accent", "")
        parts = [f"primary {primary}" if primary else "",
                 f"secondary {secondary}" if secondary else "",
                 f"accent {accent}" if accent else ""]
        color_str = ", ".join(p for p in parts if p)
        if color_str:
            brand_visual += f"Brand colors (MUST use these — no other colors): {color_str}. "
    if brand_fonts:
        heading = brand_fonts.get("heading") or brand_fonts.get("primary") or brand_fonts.get("display") or ""
        body = brand_fonts.get("body") or brand_fonts.get("secondary") or ""
        if heading:
            brand_visual += f"Heading font: {heading}. "
        if body:
            brand_visual += f"Body font: {body}. "

    return (
        f"Create a {platform} carousel post with {count} swipeable images for this topic.\n"
        f"Topic: \"{topic}\"\n"
        f"{brand_context}\n"
        f"{brand_visual}\n\n"
        f"TASK:\n"
        f"1. Write ONE single caption for the whole post ({limit_rule})\n"
        f"2. Define ONE locked DESIGN SYSTEM that will be applied identically to every slide image.\n"
        f"3. Create {count} image prompts using that design system — one per swipeable slide.\n\n"
        f"Image visual arc (follow exactly):\n{roles_str}\n\n"
        f"DESIGN SYSTEM rules (this is the most important part):\n"
        f"- The design system MUST be built around the brand colors and fonts listed above.\n"
        f"  Do NOT invent a different color palette — use the brand's exact colors.\n"
        f"- Define a specific, locked design template in 2-3 sentences covering:\n"
        f"  * Background: use the brand's primary or secondary color as the dominant background\n"
        f"  * Accent & text colors: derived from the brand palette (exact hex values from above)\n"
        f"  * Layout grid: where the headline sits, where the visual element sits, margins\n"
        f"  * Typography style: font weight, size relationship (e.g. 'large bold display headline top-left, small caption bottom-right')\n"
        f"  * Logo/brand placement: exact corner and size (e.g. 'brand name bottom-right in accent color, small')\n"
        f"  * Decorative motif: one consistent repeating element that uses brand colors (e.g. 'thin diagonal accent line', 'circle frame')\n"
        f"- This design_system string gets embedded verbatim at the start of every image_prompt.\n\n"
        f"Image prompt rules:\n"
        f"- Start every image_prompt with 'DESIGN SYSTEM: [the exact design_system text above]. '\n"
        f"- Then specify the slide's composition (from the arc above) + visual metaphor + headline text to embed (3-5 words).\n"
        f"- The visual metaphor/scene and composition CHANGE per slide; the color palette and brand elements NEVER change.\n"
        f"- FORBIDDEN PATTERNS (never use these): bordered card with inner content, square frame inside a square canvas, "
        f"centered text on a plain gradient, generic white card on colored background, template-like bordered panels. "
        f"These look unprofessional and monotonic.\n"
        f"- USE INSTEAD: full-bleed colors, bold oversized typography, diagonal splits, asymmetric layouts, "
        f"overlapping text and visuals, large geometric brand-color shapes, dramatic scale contrast.\n"
        f"- context_note: 5-8 words max describing VISUAL direction only "
        f"(e.g. 'warmer tone, solution revealed', 'darker bg, consequence shown'). "
        f"NEVER write summaries, analytical text, research findings, or anything resembling prose.\n\n"
        f"Return ONLY a JSON object:\n"
        f"{{\n"
        f'  "caption_title": "<post title/headline>",\n'
        f'  "caption_body": "<ready-to-publish post caption text>",\n'
        f'  "hashtags": ["<tag1>", "<tag2>", ...],\n'
        f'  "cta": "<call to action>",\n'
        f'  "meta_description": "<SEO meta description>",\n'
        f'  "word_count": <integer>,\n'
        f'  "tone_used": "<tone>",\n'
        f'  "design_system": "<2-3 sentence locked visual template covering bg, accent, layout, typography, logo placement, motif>",\n'
        f'  "image_prompts": [\n'
        f'    {{\n'
        f'      "slide_number": 1,\n'
        f'      "image_prompt": "DESIGN SYSTEM: [copy design_system here]. [slide-specific visual metaphor + headline text to embed]",\n'
        f'      "context_note": "Opening image — introduces the hook"\n'
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
        "You are a world-class social media content strategist specialising in carousel posts. "
        "Carousels have ONE caption and multiple swipeable images that tell a visual story. "
        "The caption hooks the reader; the images reward the swipe. "
        "Always use the brand's exact colors and visual identity — never invent a new palette."
    )
    prompt = _build_carousel_prompt(
        topic, platform, count, brand_name, brand_voice, tone, additional_context,
        brand_colors=brand_colors, brand_fonts=brand_fonts,
        industry=industry, target_audience=target_audience,
    )

    logger.info("carousel build start | topic=%s platform=%s count=%d", topic, platform, count)

    raw = await llm.complete(
        provider="openai",
        model="gpt-4o-mini",
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        data = safe_json_loads(raw)
        content = CarouselContent(**data)
        logger.info("carousel build done | slides=%d", len(content.image_prompts))
        return content
    except Exception as exc:
        logger.error("carousel build parse failed | raw=%s error=%s", raw[:200], exc)
        raise ValueError(f"Carousel generation returned unparseable data — retry. ({exc})")

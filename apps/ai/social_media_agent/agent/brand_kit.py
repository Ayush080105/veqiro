"""
brand_kit.py
------------
Enhanced brand kit with:
- Selective asset usage (flags)
- Multimodal support
- Clean prompt context
"""

import json
import os
from typing import Optional, List, Tuple
import httpx


BRAND_KIT_PATH = os.path.join(os.path.dirname(__file__), "..", "brand_kit.json")


# ---------------------------------------------------------
# LOAD BRAND KIT
# ---------------------------------------------------------
def load_brand_kit(override: Optional[dict] = None) -> dict:
    """
    Priority:
    1. API payload override
    2. Local JSON file
    """
    if override:
        return override

    with open(BRAND_KIT_PATH, "r") as f:
        return json.load(f)


# ---------------------------------------------------------
# FETCH IMAGE BYTES (FOR GEMINI)
# ---------------------------------------------------------
async def fetch_images(urls: List[str]) -> List[bytes]:
    images = []

    if not urls:
        return images

    async with httpx.AsyncClient(timeout=20.0) as client:
        for url in urls:
            try:
                res = await client.get(url)

                if res.status_code == 200:
                    if len(res.content) <= 10 * 1024 * 1024:
                        images.append(res.content)

            except Exception:
                continue  # fail silently

    return images


# ---------------------------------------------------------
# SMART ASSET EXTRACTION (FLAGS BASED)
# ---------------------------------------------------------
def extract_brand_assets(brand_kit: dict) -> Tuple[List[str], List[str]]:
    """
    Returns:
    - image_urls (based on flags)
    - selected_colors (if enabled)
    """

    urls = []

    # ✅ LOGO
    if brand_kit.get("use_logo") and brand_kit.get("logo_url"):
        urls.append(brand_kit["logo_url"])

    # ✅ MASCOT
    if brand_kit.get("use_mascot") and brand_kit.get("mascot_url"):
        urls.append(brand_kit["mascot_url"])

    # ✅ REFERENCE IMAGES
    if brand_kit.get("use_reference_images"):
        urls.extend(brand_kit.get("reference_images", []))

    # ✅ COLORS
    colors = []
    if brand_kit.get("use_brand_colors"):
        colors = brand_kit.get("brand_colors", [])

    return urls, colors


# ---------------------------------------------------------
# CONTEXT STRING (SMART + CLEAN)
# ---------------------------------------------------------
def brand_kit_to_context_string(brand_kit: dict) -> str:
    bk = brand_kit

    hashtags = ", ".join(bk.get("hashtags", []))

    # Only include colors if enabled
    colors = ""
    if bk.get("use_brand_colors"):
        colors = ", ".join(bk.get("brand_colors", []))

    # Platform tone
    platform_tones = ""
    if bk.get("posting_tone_by_platform"):
        platform_tones = "\nPlatform Tone:\n" + "\n".join(
            f"- {platform}: {tone}"
            for platform, tone in bk["posting_tone_by_platform"].items()
        )

    # Visual references (ONLY IF ENABLED)
    visual_section = ""

    if bk.get("use_logo") and bk.get("logo_url"):
        visual_section += f"\n- Logo: {bk.get('logo_url')}"

    if bk.get("use_mascot") and bk.get("mascot_url"):
        visual_section += f"\n- Mascot: {bk.get('mascot_url')}"

    if bk.get("use_reference_images"):
        visual_section += f"\n- Reference Images: {bk.get('reference_images', [])}"

    return f"""
=== BRAND CONTEXT ===

Company: {bk.get("company_name", "Unknown")}
Tagline: {bk.get("tagline", "")}
Industry: {bk.get("industry", "")}

Description:
{bk.get("description", "")}

Target Audience:
{bk.get("target_audience", "")}

Brand Voice:
{bk.get("brand_voice", "")}

Image Style:
{bk.get("image_style", "")}

Brand Colors:
{colors}

Default Hashtags:
{hashtags}

IMPORTANT VISUAL GUIDELINES:
{visual_section}

IMPORTANT:
- Use ONLY the provided brand elements if enabled
- Maintain strict brand consistency
- Do not invent new colors or styles

{platform_tones}

=========================
""".strip()
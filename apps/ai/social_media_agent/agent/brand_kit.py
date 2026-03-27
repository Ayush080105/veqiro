"""
brand_kit.py
------------
Loads the brand kit from a local JSON file.
Later, swap load_brand_kit() to fetch from DB instead.
"""

import json
import os
from typing import Optional


BRAND_KIT_PATH = os.path.join(os.path.dirname(__file__), "..", "brand_kit.json")


def load_brand_kit(override: Optional[dict] = None) -> dict:
    """
    Load brand kit. Priority:
      1. `override` dict passed directly in the API payload
      2. Local brand_kit.json file
    Returns a flat brand kit dict.
    """
    if override:
        return override

    with open(BRAND_KIT_PATH, "r") as f:
        return json.load(f)


def brand_kit_to_context_string(brand_kit: dict) -> str:
    """
    Converts brand kit dict into a rich natural-language context block
    that can be injected into any system prompt.
    """
    bk = brand_kit
    mascot_info = ""
    if bk.get("mascot"):
        mascot_info = f"\n- Mascot: {bk['mascot']['name']} — {bk['mascot']['description']}"

    platform_tones = ""
    if bk.get("posting_tone_by_platform"):
        platform_tones = "\nPlatform-specific tone guidelines:\n" + "\n".join(
            f"  - {platform}: {tone}"
            for platform, tone in bk["posting_tone_by_platform"].items()
        )

    hashtags = ", ".join(bk.get("hashtags", []))

    return f"""
=== BRAND KIT ===
Company: {bk.get("company_name", "Unknown")}
Tagline: {bk.get("tagline", "")}
Industry: {bk.get("industry", "")}
Description: {bk.get("description", "")}
Target Audience: {bk.get("target_audience", "")}
Brand Voice: {bk.get("brand_voice", "")}
Image Style: {bk.get("image_style", "")}
Font Style — Heading: {bk.get("font_style", {}).get("heading", "")}, Body: {bk.get("font_style", {}).get("body", "")}
Color Theme — Primary: {bk.get("color_theme", {}).get("primary", "")}, Accent: {bk.get("color_theme", {}).get("accent", "")}
Default Hashtags: {hashtags}
Logo: {bk.get("logo_description", "")}{mascot_info}
{platform_tones}
=================
""".strip()
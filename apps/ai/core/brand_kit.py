import time
from pydantic import BaseModel
from core.config import settings


class BrandKit(BaseModel):
    company_name: str = "My Company"
    company_description: str = ""
    industry: str = ""
    target_audience: str = ""
    brand_voice: str = "Professional and friendly"
    logo_url: str | None = None
    mascot_url: str | None = None
    brand_colors: dict = {"primary": "#6C3CE1", "secondary": "#FF6B35", "accent": "#10B981"}
    brand_fonts: dict | None = None
    platform_tones: dict = {
        "twitter": "casual, punchy",
        "linkedin": "professional",
        "instagram": "visual-first, inspiring",
    }
    competitors: list = []
    key_differentiators: str = ""
    website_url: str = ""


# ── In-memory cache (user_id → (brand_kit, expires_at)) ─────────────────────
_CACHE_TTL = 60  # seconds
_cache: dict[str, tuple[BrandKit, float]] = {}


async def load_brand_kit(user_id: str) -> BrandKit:
    """
    Load brand kit for a user.
    - MOCK_MODE: returns hardcoded Veqiro defaults.
    - Real mode: fetches from Express service at GET /api/brand-kit/{user_id}.
      Results are cached in-memory for 60 seconds to avoid repeated HTTP calls
      within a single chat session.
    """
    if settings.MOCK_MODE:
        return BrandKit(
            company_name="Veqiro AI",
            company_description="AI-powered workspace for founders and small teams",
            industry="SaaS / AI Productivity",
            target_audience="Founders, solopreneurs, and early-stage startup teams",
            brand_voice="Smart, confident, and founder-friendly",
            brand_colors={"primary": "#6C3CE1", "secondary": "#FF6B35", "accent": "#10B981"},
            platform_tones={
                "twitter": "casual, punchy, uses emojis sparingly",
                "linkedin": "professional, insight-driven, thought leadership",
                "instagram": "visual-first, inspiring, short captions",
            },
            key_differentiators="Purpose-built AI agents for founders – not generic chatbots",
            competitors=["Notion AI", "Monday.com AI", "ClickUp AI"],
            website_url="https://veqiro.com",
        )

    # Check cache
    cached = _cache.get(user_id)
    if cached and time.monotonic() < cached[1]:
        return cached[0]

    # Fetch from Express service
    try:
        import httpx
        url = f"{settings.BRAND_KIT_SERVICE_URL}/api/brand-kit/{user_id}"
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            brand_kit = BrandKit(
                company_name=data.get("company_name") or "My Company",
                company_description=data.get("company_description") or "",
                industry=data.get("industry") or "",
                target_audience=data.get("target_audience") or "",
                brand_voice=data.get("brand_voice") or "Professional and friendly",
                logo_url=data.get("logo_url"),
                mascot_url=data.get("mascot_url"),
                brand_colors=data.get("brand_colors") or {},
                brand_fonts=data.get("brand_fonts"),
                platform_tones=data.get("platform_tones") or {},
                competitors=data.get("competitors") or [],
                key_differentiators=data.get("key_differentiators") or "",
                website_url=data.get("website_url") or "",
            )
        else:
            brand_kit = BrandKit()
    except Exception:
        brand_kit = BrandKit()

    # Store in cache
    _cache[user_id] = (brand_kit, time.monotonic() + _CACHE_TTL)
    return brand_kit


def get_platform_tone(brand_kit: BrandKit, platform: str) -> str:
    """Get the tone for a given platform from brand kit."""
    platform_key = platform.lower().strip()
    return brand_kit.platform_tones.get(platform_key, brand_kit.brand_voice)


def get_image_prompt_context(brand_kit: BrandKit) -> str:
    """Build an image generation context string from brand kit."""
    parts = []
    if brand_kit.company_name:
        parts.append(f"Brand: {brand_kit.company_name}")
    if brand_kit.industry:
        parts.append(f"Industry: {brand_kit.industry}")
    colors = brand_kit.brand_colors
    if colors:
        color_str = ", ".join(f"{k}: {v}" for k, v in colors.items())
        parts.append(f"Brand colors: {color_str}")
    if brand_kit.brand_voice:
        parts.append(f"Visual style: {brand_kit.brand_voice}")
    if brand_kit.target_audience:
        parts.append(f"Audience: {brand_kit.target_audience}")
    if brand_kit.website_url:
        parts.append(f"Website: {brand_kit.website_url}")
    return ". ".join(parts)

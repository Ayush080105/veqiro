import logging
import time
from pydantic import BaseModel
from core.config import settings

logger = logging.getLogger("brand_kit")


class BrandKit(BaseModel):
    company_name: str = "My Company"
    company_description: str = ""
    value_proposition: str = ""
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
    # Cleaned markdown summary from the Jina Reader crawl on the user's
    # website. Editable by the user. Injected verbatim into agent prompts.
    crawled_summary: str = ""
    # Raw cleaned markdown — bigger payload, used as fallback only.
    crawled_content: str = ""
    # True when the kit was loaded from the server (not a fallback default).
    _loaded: bool = False


# ── In-memory cache (organization_id → (brand_kit, expires_at)) ─────────────
_CACHE_TTL = 300  # 5 minutes — brand kit rarely changes mid-session
_cache: dict[str, tuple[BrandKit, float]] = {}


async def load_brand_kit(organization_id: str) -> BrandKit:
    """
    Load brand kit for an organization.

    Keyed by organization_id (the server-side BrandKit table is keyed by
    Organization.id, not User.id — this is the bug the code used to hit).

    - MOCK_MODE: returns hardcoded Veqiro defaults.
    - Real mode: fetches from the Express server at
      GET /api/v1/internal/brand-kit/{organization_id} (with x-internal-key).
      Results cached in-memory for 60 seconds per organization.
    """
    if settings.MOCK_MODE:
        return BrandKit(
            company_name="Veqiro AI",
            company_description="AI-powered workspace for founders and small teams",
            value_proposition="Founders run growth, content, and ops with a six-agent crew instead of a five-person team.",
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
            crawled_summary="Veqiro is six AI employees in one workspace. Maya writes, Sage strategizes, Scout researches, Lex handles compliance, Rex makes video, Vega coordinates.",
        )

    if not organization_id:
        logger.warning("brand_kit: empty organization_id — returning defaults")
        return BrandKit()

    # Cache hit
    cached = _cache.get(organization_id)
    if cached and time.monotonic() < cached[1]:
        return cached[0]

    # Keep stale value as fallback in case the fetch fails
    stale_value = cached[0] if cached else None

    # Fetch from Express
    brand_kit = BrandKit()
    try:
        import httpx
        url = f"{settings.BRAND_KIT_SERVICE_URL}/api/v1/internal/brand-kit/{organization_id}"
        logger.info("brand_kit fetch | org=%s url=%s", organization_id, url)
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url, headers={"x-internal-key": settings.INTERNAL_API_KEY})
        if resp.status_code == 200:
            data = resp.json()
            brand_kit = BrandKit(
                company_name=data.get("company_name") or "My Company",
                company_description=data.get("company_description") or "",
                value_proposition=data.get("value_proposition") or "",
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
                crawled_summary=data.get("crawled_summary") or "",
                crawled_content=data.get("crawled_content") or "",
            )
            object.__setattr__(brand_kit, "_loaded", True)
            logger.info(
                "brand_kit loaded | org=%s company=%s logo=%s mascot=%s",
                organization_id, brand_kit.company_name,
                bool(brand_kit.logo_url), bool(brand_kit.mascot_url),
            )
        elif resp.status_code == 404:
            # Expected for fresh orgs that haven't finished onboarding yet.
            logger.info(
                "brand_kit not found (404) | org=%s — kit not created yet, using defaults",
                organization_id,
            )
        elif resp.status_code == 401:
            # Misconfiguration — surfaces in logs as a real error, not a warning.
            logger.error(
                "brand_kit auth rejected (401) | org=%s url=%s — INTERNAL_API_KEY mismatch",
                organization_id, url,
            )
        else:
            logger.warning(
                "brand_kit fetch failed | org=%s status=%s url=%s — using defaults",
                organization_id, resp.status_code, url,
            )
    except Exception as e:
        logger.warning(
            "brand_kit fetch error | org=%s error=%s — %s",
            organization_id, e,
            "using stale cache" if stale_value else "using defaults",
        )
        if stale_value:
            return stale_value  # return last good value, don't overwrite cache

    _cache[organization_id] = (brand_kit, time.monotonic() + _CACHE_TTL)
    return brand_kit


def get_platform_tone(brand_kit: BrandKit, platform: str) -> str:
    """Get the tone for a given platform from brand kit."""
    platform_key = platform.lower().strip()
    return brand_kit.platform_tones.get(platform_key, brand_kit.brand_voice)


# Defensive cap so a long crawl doesn't blow out the prompt budget. ~1200
# chars is enough for most agents to ground in real site language without
# eating the context window.
_CRAWL_CAP = 1200


def get_site_context_block(brand_kit: BrandKit) -> str:
    """
    Build the "Real Site Context" block that agents append to system prompts.
    Returns "" when nothing was crawled — callers should `.strip()`-test before
    appending so prompts don't get a stray header with no body.
    """
    summary = (brand_kit.crawled_summary or "").strip()
    if not summary:
        # Fall back to a slice of crawled_content if available — better than
        # nothing for orgs whose crawl predates the summary distillation step.
        summary = (brand_kit.crawled_content or "").strip()
    if not summary:
        return ""
    if len(summary) > _CRAWL_CAP:
        summary = summary[:_CRAWL_CAP].rstrip() + "…"
    return (
        "Real Site Context (verbatim from the brand's website — use this to "
        "ground tone and facts, don't quote it directly):\n" + summary
    )


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
    if brand_kit.value_proposition:
        parts.append(f"Value: {brand_kit.value_proposition}")
    if brand_kit.website_url:
        parts.append(f"Website: {brand_kit.website_url}")
    return ". ".join(parts)

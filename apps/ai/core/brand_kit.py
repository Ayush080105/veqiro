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
        "blog": "educational",
        "email": "professional",
    }
    competitors: list = []
    key_differentiators: str = ""


async def load_brand_kit(user_id: str) -> BrandKit:
    """Load brand kit for user. In mock mode returns default BrandKit."""
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
                "blog": "educational, SEO-friendly, actionable",
                "email": "direct, personalized, value-first",
                "instagram": "visual-first, inspiring, short captions",
            },
            key_differentiators="Purpose-built AI agents for founders – not generic chatbots",
            competitors=["Notion AI", "Monday.com AI", "ClickUp AI"],
        )

    # Real mode: load from DB
    # TODO: implement DB lookup
    return BrandKit(company_name="My Company")


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
    if colors.get("primary"):
        parts.append(f"Primary color: {colors['primary']}")
    if brand_kit.brand_voice:
        parts.append(f"Visual style: {brand_kit.brand_voice}")
    if brand_kit.target_audience:
        parts.append(f"Audience: {brand_kit.target_audience}")
    return ". ".join(parts)

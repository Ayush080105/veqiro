from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # LLM API Keys
    GEMINI_API_KEY: str = Field(default="mock-key")
    OPENAI_API_KEY: str = Field(default="mock-key")
    SERPER_API_KEY: str = Field(default="")
    BRAND_KIT_SERVICE_URL: str = Field(default="http://localhost:3000")

    # Database
    DATABASE_URL: str = Field(default="postgresql+asyncpg://user:pass@localhost/db")
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # Google
    GOOGLE_SERVICE_ACCOUNT_JSON: str = Field(default="")

    # Observability
    SENTRY_DSN: str = Field(default="")
    POSTHOG_API_KEY: str = Field(default="")
    LANGFUSE_PUBLIC_KEY: str = Field(default="")
    LANGFUSE_SECRET_KEY: str = Field(default="")
    LANGFUSE_HOST: str = Field(default="https://us.cloud.langfuse.com")

    # Security
    API_SECRET: str = Field(default="dev-secret")
    INTERNAL_API_KEY: str = Field(default="")

    # App
    ENVIRONMENT: str = Field(default="development")
    MOCK_MODE: bool = Field(default=True)

    SCOUT_MODEL: str = Field(default="gpt-4.1-mini")

    SAGE_MODEL: str = Field(default="gpt-4.1-mini")

    # Image generation model — override in .env to A/B test a higher tier
    # (e.g. GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview, ~3.4x cost per image)
    GEMINI_IMAGE_MODEL: str = Field(default="gemini-2.5-flash-image")

    # Asset fetching (R2 / CDN)
    R2_FETCH_TIMEOUT: int = Field(default=10)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

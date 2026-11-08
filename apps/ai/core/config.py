from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # LLM API Keys
    GEMINI_API_KEY: str = Field(default="mock-key")
    # OpenAI is used only for embeddings (text-embedding-3-small): the stored pgvector
    # columns are vector(1536) and every existing row was embedded with that model.
    OPENAI_API_KEY: str = Field(default="mock-key")
    ANTHROPIC_API_KEY: str = Field(default="mock-key")
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

    # The one chat/JSON/tool-calling model behind every agent, the router, the planner,
    # reports and briefings. Roll back to OpenAI with
    # MAIN_LLM_PROVIDER=openai and MAIN_LLM_MODEL=gpt-6-luna; no code change needed.
    MAIN_LLM_PROVIDER: str = Field(default="anthropic")
    MAIN_LLM_MODEL: str = Field(default="claude-opus-5-5")

    # Anthropic request tuning. Thinking counts toward max_tokens, so short caller budgets
    # are raised to this floor (the cap is not a charge: only generated tokens are billed).
    ANTHROPIC_EFFORT: str = Field(default="medium")
    ANTHROPIC_MIN_MAX_TOKENS: int = Field(default=16000)
    # Server-side fallback: if Claude declines a request on policy grounds, the API retries
    # it on the model's default fallback instead of failing the user's request.
    ANTHROPIC_FALLBACKS: bool = Field(default=True)

    # Image generation model (Nano Banana 2 Lite) — override in .env to A/B test another tier
    # (e.g. GEMINI_IMAGE_MODEL=gemini-3.1-flash-image or gemini-3-pro-image)
    GEMINI_IMAGE_MODEL: str = Field(default="gemini-3.1-flash-lite-image")

    # Asset fetching (R2 / CDN)
    R2_FETCH_TIMEOUT: int = Field(default=10)

    model_config = {"env_file": ".env", "extra": "ignore"}


def main_llm_key_missing(s: "Settings") -> bool:
    """True when real (non-mock) calls would go to Claude but no Anthropic key is set:
    every chat, JSON and tool call would then fail with a 401."""
    return (
        not s.MOCK_MODE
        and s.MAIN_LLM_PROVIDER == "anthropic"
        and s.ANTHROPIC_API_KEY.strip() in ("", "mock-key")
    )


settings = Settings()

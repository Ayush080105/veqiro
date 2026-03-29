from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # LLM API Keys
    GEMINI_API_KEY: str = Field(default="mock-key")
    OPENAI_API_KEY: str = Field(default="mock-key")
    ANTHROPIC_API_KEY: str = Field(default="mock-key")

    # Database
    DATABASE_URL: str = Field(default="postgresql+asyncpg://user:pass@localhost/db")
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # Google
    GOOGLE_SERVICE_ACCOUNT_JSON: str = Field(default="")

    # Observability
    SENTRY_DSN: str = Field(default="")
    POSTHOG_API_KEY: str = Field(default="")

    # Security
    API_SECRET: str = Field(default="dev-secret")

    # App
    ENVIRONMENT: str = Field(default="development")
    MOCK_MODE: bool = Field(default=True)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

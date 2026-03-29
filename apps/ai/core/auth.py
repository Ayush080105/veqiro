from fastapi import Header, HTTPException, status
from core.config import settings


async def verify_api_secret(x_api_secret: str | None = Header(default=None)) -> str:
    """FastAPI dependency that checks X-Api-Secret header matches settings.API_SECRET.
    In development mode, skip auth check entirely."""
    if settings.ENVIRONMENT == "development":
        return "dev-bypass"

    if x_api_secret is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Api-Secret header",
        )
    if x_api_secret != settings.API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API secret",
        )
    return x_api_secret

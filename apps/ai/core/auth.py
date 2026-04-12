from fastapi import Header, HTTPException, status
from core.config import settings


async def verify_internal_key(
    x_internal_api_key: str | None = Header(default=None),
) -> None:
    if not settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_API_KEY not configured on server",
        )
    if x_internal_api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Internal-Api-Key header",
        )
    if x_internal_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )

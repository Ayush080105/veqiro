from typing import AsyncGenerator
from core.config import settings


async def get_db():
    """FastAPI dependency for async DB session.
    In MOCK_MODE returns None. In real mode returns asyncpg connection via SQLAlchemy."""
    if settings.MOCK_MODE:
        yield None
        return

    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def fetch_one(query: str, *args) -> dict | None:
    """Run a raw SQL query and return one row as dict, or None.
    Uses a short-lived asyncpg connection (no ORM overhead)."""
    import asyncpg
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(dsn)
    try:
        row = await conn.fetchrow(query, *args)
        return dict(row) if row else None
    finally:
        await conn.close()

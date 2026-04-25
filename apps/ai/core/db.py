from typing import AsyncGenerator
from core.config import settings

_pool = None


async def get_pool():
    """Return a shared asyncpg connection pool, creating it on first call."""
    global _pool
    if _pool is None:
        import asyncpg
        dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
    return _pool


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
    """Run a raw SQL query and return one row as dict, or None."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
        return dict(row) if row else None

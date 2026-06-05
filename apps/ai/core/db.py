from typing import AsyncGenerator
from core.config import settings

_pool = None
_engine = None  # shared SQLAlchemy engine — created once, not per-request


async def get_pool():
    """Return a shared asyncpg connection pool, creating it on first call."""
    global _pool
    if _pool is None:
        import asyncpg
        dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        # Keep pool small — Supabase session mode caps total clients at 15.
        # Prisma (Express) uses its own connections, so leave room for them.
        _pool = await asyncpg.create_pool(
            dsn,
            min_size=1,
            max_size=4,
            max_inactive_connection_lifetime=30,  # recycle idle connections quickly
            # Required for PgBouncer transaction mode (Supabase port 6543):
            # prepared statements can't be used across connections in transaction mode
            statement_cache_size=0,
        )
    return _pool


def _get_engine():
    """Return a shared SQLAlchemy async engine (created once, reused)."""
    global _engine
    if _engine is None:
        from sqlalchemy.ext.asyncio import create_async_engine
        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_size=2,
            max_overflow=1,
        )
    return _engine


async def get_db() -> AsyncGenerator:
    """FastAPI dependency for async DB session."""
    if settings.MOCK_MODE:
        yield None
        return

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker

    async_session = sessionmaker(_get_engine(), class_=AsyncSession, expire_on_commit=False)
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

from typing import AsyncGenerator
from core.config import settings

_pool = None
_engine = None  # shared SQLAlchemy engine — created once, not per-request


async def get_pool():
    """Return a shared asyncpg connection pool, creating it on first call.

    Pool budget: PgBouncer session-mode cap is 15 total clients shared across
    ALL services (AI workers + Prisma/Node). Keep asyncpg at max_size=2 so
    N uvicorn workers + Prisma stay comfortably under that limit.
    Use the Supabase transaction-mode pooler URL (port 6543) in production to
    raise effective concurrency without increasing real connection count.
    """
    global _pool
    if _pool is None:
        import asyncpg
        dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        _pool = await asyncpg.create_pool(
            dsn,
            min_size=0,                  # lazy — don't open a connection until first use
            max_size=2,
            max_inactive_connection_lifetime=20,
            command_timeout=15,          # fail fast instead of stacking waiters
            statement_cache_size=0,      # required for PgBouncer transaction mode
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
            pool_size=1,
            max_overflow=0,
            pool_timeout=15,
            pool_recycle=300,
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

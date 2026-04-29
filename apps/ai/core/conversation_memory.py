import json

from core.config import settings

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS conversation_memories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      TEXT        NOT NULL,
    agent       TEXT        NOT NULL,
    role        TEXT        NOT NULL,
    content     TEXT        NOT NULL,
    embedding   vector(1536),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    metadata    JSONB       DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS conv_mem_embedding_idx
    ON conversation_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS conv_mem_org_agent_time_idx
    ON conversation_memories (org_id, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS conv_mem_org_idx
    ON conversation_memories (org_id, created_at DESC);
"""


def _vec(embedding: list[float]) -> str:
    """Serialize float list to pgvector literal: '[0.1,-0.2,...]'"""
    return "[" + ",".join(str(x) for x in embedding) + "]"


async def initialize_tables() -> None:
    """Create conversation_memories table and indexes if they don't exist."""
    from core.db import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_CREATE_TABLE_SQL)


async def store_turn(
    org_id: str,
    agent: str,
    user_content: str,
    assistant_content: str,
    metadata: dict | None = None,
) -> None:
    """Embed and persist a user+assistant turn pair as two rows."""
    meta_json = json.dumps(metadata or {})

    if settings.MOCK_MODE:
        vectors = [[0.0] * 1536, [0.0] * 1536]
    else:
        from core.embeddings import embed_batch
        vectors = await embed_batch([user_content, assistant_content])

    rows = [
        (org_id, agent, "user",      user_content,      _vec(vectors[0]), meta_json),
        (org_id, agent, "assistant", assistant_content, _vec(vectors[1]), meta_json),
    ]

    from core.db import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO conversation_memories
                (org_id, agent, role, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5::vector, $6)
            """,
            rows,
        )


async def retrieve_relevant(
    org_id: str,
    agent: str,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """Vector similarity search for relevant past turns."""
    if settings.MOCK_MODE:
        return []

    from core.embeddings import embed_text
    from core.db import get_pool

    query_embedding = await embed_text(query)
    pool = await get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT role, content, created_at,
                   1 - (embedding <=> $1::vector) AS score
            FROM conversation_memories
            WHERE org_id = $2 AND agent = $3
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            _vec(query_embedding),
            org_id,
            agent,
            top_k,
        )

    return [
        {
            "role": row["role"],
            "content": row["content"],
            "score": float(row["score"]),
        }
        for row in rows
    ]

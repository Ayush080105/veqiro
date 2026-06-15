import json
import uuid

from pydantic import BaseModel
from core.config import settings


class RAGChunk(BaseModel):
    id: str = ""
    content: str
    source_type: str = ""
    source_agent: str = ""
    metadata: dict = {}
    score: float = 0.0


def _vec(embedding: list[float]) -> str:
    """Serialize float list to pgvector literal: '[0.1,-0.2,...]'"""
    return "[" + ",".join(str(x) for x in embedding) + "]"


def _row_meta(raw) -> dict:
    """Normalize asyncpg metadata field — JSONB comes back as dict, TEXT as string."""
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {}
    return dict(raw)


class RAGService:
    """Retrieval Augmented Generation service.
    In MOCK_MODE all operations return safe defaults."""

    async def retrieve(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        source_types: list[str] | None = None,
        source_agent: str | None = None,
        source_id: str | None = None,
    ) -> list[dict]:
        if settings.MOCK_MODE:
            return []

        from core.embeddings import embed_text
        from core.db import get_pool

        query_embedding = await embed_text(query)
        pool = await get_pool()

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, source_type, source_agent, metadata,
                       1 - (embedding <=> $1::vector) AS score
                FROM rag_chunks
                WHERE user_id = $2
                  AND ($3::text   IS NULL OR source_agent = $3)
                  AND ($4::text[] IS NULL OR source_type  = ANY($4))
                  AND ($6::text   IS NULL OR source_id    = $6)
                ORDER BY embedding <=> $1::vector
                LIMIT $5
                """,
                _vec(query_embedding),
                user_id,
                source_agent,
                source_types,
                top_k,
                source_id,
            )

        _MIN_SCORE = 0.70  # cosine similarity floor — below this the chunk is noise
        return [
            {
                "id": str(row["id"]),
                "content": row["content"],
                "source_type": row["source_type"],
                "source_agent": row["source_agent"],
                "metadata": _row_meta(row["metadata"]),
                "score": float(row["score"]),
            }
            for row in rows
            if float(row["score"]) >= _MIN_SCORE
        ]

    async def ingest(
        self,
        user_id: str,
        text: str,
        source_type: str,
        source_id: str,
        source_agent: str,
        metadata: dict | None = None,
    ) -> int:
        """Chunk text, embed each chunk, insert into pgvector. Returns chunk count."""
        if settings.MOCK_MODE:
            return 1

        from core.embeddings import embed_batch
        from core.db import get_pool

        chunks = _chunk_text(text, chunk_size=200, overlap=30)
        embeddings = await embed_batch(chunks)
        meta_json = json.dumps(metadata or {})

        rows = [
            (str(uuid.uuid4()), user_id, source_id, source_type, source_agent, chunk, _vec(emb), meta_json)
            for chunk, emb in zip(chunks, embeddings)
        ]

        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO rag_chunks
                    (id, user_id, source_id, source_type, source_agent, content, embedding, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)
                """,
                rows,
            )

        return len(rows)

    async def ingest_pdf(
        self,
        user_id: str,
        pdf_bytes: bytes,
        source_id: str,
        metadata: dict | None = None,
        llm_client=None,
    ) -> int:
        """Extract text from PDF via Gemini vision and ingest. Returns chunk count."""
        if settings.MOCK_MODE:
            return 1
        from core.pdf_reader import extract_text_with_vision, extract_text
        from core.llm import LLMClient
        llm = llm_client or LLMClient()
        try:
            text = await extract_text_with_vision(pdf_bytes, llm)
        except Exception:
            text = extract_text(pdf_bytes)
        return await self.ingest(user_id, text, "pdf", source_id, "lex", metadata)

    async def retrieve_by_source(
        self,
        user_id: str,
        source_id: str,
    ) -> list[dict]:
        """Fetch all chunks for a specific source_id in insertion order."""
        if settings.MOCK_MODE:
            return []

        from core.db import get_pool

        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, source_type, source_agent, metadata
                FROM rag_chunks
                WHERE user_id = $1 AND source_id = $2
                ORDER BY created_at ASC
                """,
                user_id,
                source_id,
            )

        return [
            {
                "id": str(row["id"]),
                "content": row["content"],
                "source_type": row["source_type"],
                "source_agent": row["source_agent"],
                "metadata": _row_meta(row["metadata"]),
            }
            for row in rows
        ]

    async def delete_source(self, user_id: str, source_id: str) -> int:
        """Delete all chunks for a (user_id, source_id). Returns number of rows deleted."""
        if settings.MOCK_MODE:
            return 1

        from core.db import get_pool

        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "DELETE FROM rag_chunks WHERE user_id = $1 AND source_id = $2 RETURNING id",
                user_id,
                source_id,
            )

        return len(rows)

    async def list_sources(
        self,
        user_id: str,
        source_agent: str | None = None,
    ) -> list[dict]:
        """List distinct (source_id, source_type, metadata) tuples for a user.

        One row per source_id (the latest metadata wins). Used by agents to
        introspect which documents the user has ingested.
        """
        if settings.MOCK_MODE:
            return []

        from core.db import get_pool

        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT ON (source_id)
                    source_id, source_type, source_agent, metadata, created_at
                FROM rag_chunks
                WHERE user_id = $1
                  AND ($2::text IS NULL OR source_agent = $2)
                ORDER BY source_id, created_at DESC
                """,
                user_id,
                source_agent,
            )

        return [
            {
                "source_id": row["source_id"],
                "source_type": row["source_type"],
                "source_agent": row["source_agent"],
                "metadata": _row_meta(row["metadata"]),
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in rows
        ]


def _chunk_text(text: str, chunk_size: int = 200, overlap: int = 30) -> list[str]:
    """Word-based chunker with overlap so clause boundaries retain context."""
    words = text.split()
    if not words:
        return [text]
    chunks = []
    step = max(1, chunk_size - overlap)
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

from pydantic import BaseModel
from core.config import settings


class RAGChunk(BaseModel):
    id: str = ""
    content: str
    source_type: str = ""
    source_agent: str = ""
    metadata: dict = {}
    score: float = 0.0


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
    ) -> list[dict]:
        if settings.MOCK_MODE:
            return []
        # Real implementation: embed query, vector search in pgvector
        from core.embeddings import embed_text
        query_embedding = await embed_text(query)
        # TODO: pgvector similarity search
        return []

    async def ingest(
        self,
        user_id: str,
        text: str,
        source_type: str,
        source_id: str,
        source_agent: str,
        metadata: dict | None = None,
    ) -> int:
        """Returns number of chunks ingested."""
        if settings.MOCK_MODE:
            return 1
        from core.embeddings import embed_text
        # Chunk text into ~500 token pieces
        chunks = _chunk_text(text, chunk_size=500)
        count = 0
        for chunk in chunks:
            embedding = await embed_text(chunk)
            # TODO: insert into pgvector table
            count += 1
        return count

    async def ingest_pdf(
        self,
        user_id: str,
        pdf_bytes: bytes,
        source_id: str,
        metadata: dict | None = None,
    ) -> int:
        """Extract text from PDF and ingest. Returns chunk count."""
        if settings.MOCK_MODE:
            return 1
        from core.pdf_reader import extract_text
        text = extract_text(pdf_bytes)
        return await self.ingest(user_id, text, "pdf", source_id, "lex", metadata)

    async def delete_source(self, source_id: str) -> int:
        """Returns number of chunks deleted."""
        if settings.MOCK_MODE:
            return 1
        # TODO: delete from pgvector by source_id
        return 1


def _chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    """Simple word-based chunker."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(" ".join(words[i : i + chunk_size]))
    return chunks or [text]

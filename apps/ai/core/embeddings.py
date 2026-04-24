from core.config import settings


async def embed_text(text: str) -> list[float]:
    """Generate embedding for a single text."""
    if settings.MOCK_MODE:
        return [0.0] * 1536

    import openai as _openai
    client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in a single API call. Much faster than calling embed_text in a loop."""
    if settings.MOCK_MODE:
        return [[0.0] * 1536 for _ in texts]

    import openai as _openai
    client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    # API returns embeddings in the same order as input
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]

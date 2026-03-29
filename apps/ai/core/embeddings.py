from core.config import settings


async def embed_text(text: str) -> list[float]:
    """Generate text embeddings. In mock mode returns list of 1536 zeros."""
    if settings.MOCK_MODE:
        return [0.0] * 1536

    import openai as _openai
    client = _openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding

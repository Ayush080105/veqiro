from core.config import settings


def extract_text(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF. In mock mode returns placeholder text."""
    if settings.MOCK_MODE:
        return "Mock PDF content for testing purposes."
    try:
        import PyPDF2
        import io
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        texts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                texts.append(text)
        return "\n\n".join(texts)
    except Exception as e:
        return f"[PDF extraction error: {e}]"


def extract_pages(pdf_bytes: bytes) -> list[dict]:
    """Extract text page-by-page. Returns list of {page_number, text, char_count}."""
    if settings.MOCK_MODE:
        return [{"page_number": 1, "text": "Mock PDF content for testing purposes.", "char_count": 38}]
    try:
        import PyPDF2
        import io
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append({"page_number": i + 1, "text": text, "char_count": len(text)})
        return pages
    except Exception as e:
        return [{"page_number": 1, "text": f"[PDF extraction error: {e}]", "char_count": 0}]


async def summarize_pdf(pdf_bytes: bytes, llm_client) -> str:
    """Extract PDF text and summarize it using LLM."""
    text = extract_text(pdf_bytes)
    if settings.MOCK_MODE:
        return "This document appears to be a standard legal agreement covering confidentiality, intellectual property, and dispute resolution. Key sections include definitions, obligations of both parties, and termination clauses."

    truncated = text[:8000]  # Limit context
    from core.llm import CLAUDE_SONNET
    provider, model = CLAUDE_SONNET
    summary = await llm_client.complete(
        provider=provider,
        model=model,
        system="You are a document analyst. Provide a concise summary of the document.",
        messages=[{"role": "user", "content": f"Summarize this document:\n\n{truncated}"}],
        max_tokens=512,
    )
    return summary

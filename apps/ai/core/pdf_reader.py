from core.config import settings

_VISION_EXTRACT_PROMPT = (
    "Extract ALL content from this PDF document exactly as it appears.\n"
    "Rules:\n"
    "- Preserve the logical order and structure of the document\n"
    "- For tables: convert to markdown table format, preserving all rows and columns\n"
    "- For images or charts: write [IMAGE: <brief description>] in place\n"
    "- For signatures or stamps: write [SIGNATURE] or [STAMP] in place\n"
    "- Do not summarize — extract everything verbatim\n"
    "Output only the extracted content, no commentary."
)


async def extract_text_with_vision(pdf_bytes: bytes, llm_client) -> str:
    """Extract full text from PDF using Gemini vision.
    Handles tables (as markdown), embedded images, and scanned pages."""
    return await llm_client.complete_with_vision(
        file_bytes=pdf_bytes,
        prompt=_VISION_EXTRACT_PROMPT,
        mime_type="application/pdf",
    )


def extract_text(pdf_bytes: bytes) -> str:
    """Plain text extraction via PyPDF2. Fast but misses tables and images.
    Used as fallback when vision extraction is not needed."""
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
    """Summarize PDF using LLM. Uses vision extraction for accurate content."""
    if settings.MOCK_MODE:
        return (
            "This document appears to be a standard legal agreement covering confidentiality, "
            "intellectual property, and dispute resolution. Key sections include definitions, "
            "obligations of both parties, and termination clauses."
        )

    text = await extract_text_with_vision(pdf_bytes, llm_client)
    truncated = text[:8000]

    from core.llm import GEMINI_FLASH
    provider, model = GEMINI_FLASH
    return await llm_client.complete(
        provider=provider,
        model=model,
        system="You are a document analyst. Provide a concise summary of the document.",
        messages=[{"role": "user", "content": f"Summarize this document:\n\n{truncated}"}],
        max_tokens=512,
    )

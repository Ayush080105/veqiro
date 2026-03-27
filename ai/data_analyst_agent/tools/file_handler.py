"""
tools/file_handler.py

Handles file uploads:
  - Validates extension (CSV / Excel)
  - Converts Excel → CSV
  - Persists to /storage/<dataset_id>.csv
"""

import logging
from pathlib import Path

import pandas as pd
from fastapi import UploadFile

log = logging.getLogger("ai-analyst.file_handler")

STORAGE_DIR = Path(__file__).parent.parent / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".csv", ".xls", ".xlsx"}


async def save_upload(file: UploadFile, dataset_id: str) -> Path:
    """
    Persist an uploaded file as a CSV.

    Args:
        file:       The FastAPI UploadFile object.
        dataset_id: Unique identifier for this dataset.

    Returns:
        Path to the saved CSV file.

    Raises:
        ValueError: If the file extension is unsupported.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{suffix}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    raw_bytes = await file.read()
    dest_path = STORAGE_DIR / f"{dataset_id}.csv"

    if suffix == ".csv":
        dest_path.write_bytes(raw_bytes)
        log.info("Saved CSV directly to %s", dest_path)
    else:
        # Excel → CSV conversion via pandas
        import io
        df = pd.read_excel(io.BytesIO(raw_bytes))
        df.to_csv(dest_path, index=False)
        log.info(
            "Converted Excel (%s) → CSV at %s  (%d rows)",
            suffix,
            dest_path,
            len(df),
        )

    return dest_path
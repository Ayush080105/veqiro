"""
tools/file_handler.py

Handles file uploads:
  - Validates extension (CSV / Excel)
  - Converts Excel → CSV
  - Persists to /storage/<dataset_id>.csv
  - Imports data into /storage/<dataset_id>.db (SQLite) for fast persistent querying
"""

import io
import logging
import sqlite3
from pathlib import Path

import pandas as pd
from fastapi import UploadFile

log = logging.getLogger("ai-analyst.file_handler")

STORAGE_DIR = Path(__file__).parent.parent / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".csv", ".xls", ".xlsx"}


def _csv_to_sqlite(csv_path: Path, db_path: Path) -> None:
    """Import a CSV file into a SQLite database as table 'dataset'."""
    df = pd.read_csv(csv_path)
    with sqlite3.connect(db_path) as conn:
        df.to_sql("dataset", conn, if_exists="replace", index=False)
    log.info("Imported %d rows into SQLite DB at %s", len(df), db_path)


async def save_upload(file: UploadFile, dataset_id: str) -> tuple[Path, Path]:
    """
    Persist an uploaded file as a CSV and import it into a SQLite DB.

    Args:
        file:       The FastAPI UploadFile object.
        dataset_id: Unique identifier for this dataset.

    Returns:
        (csv_path, db_path) — paths to the saved CSV and the SQLite DB.

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
    db_path = STORAGE_DIR / f"{dataset_id}.db"

    if suffix == ".csv":
        dest_path.write_bytes(raw_bytes)
        log.info("Saved CSV directly to %s", dest_path)
    else:
        # Excel → CSV conversion via pandas
        df = pd.read_excel(io.BytesIO(raw_bytes))
        df.to_csv(dest_path, index=False)
        log.info(
            "Converted Excel (%s) → CSV at %s  (%d rows)",
            suffix,
            dest_path,
            len(df),
        )

    _csv_to_sqlite(dest_path, db_path)

    return dest_path, db_path

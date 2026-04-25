import base64
import uuid
from datetime import datetime
from pathlib import Path

# Root: apps/ai/local_storage/
_BASE = Path(__file__).resolve().parent.parent / "local_storage"
_IMAGES_DIR = _BASE / "images"
_DRAFTS_DIR = _BASE / "drafts"


def _ensure_dirs():
    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    _DRAFTS_DIR.mkdir(parents=True, exist_ok=True)


def save_image(image_b64: str, user_id: str, label: str = "") -> tuple[str, str]:
    """Decode base64 PNG and save to local_storage/images/.
    Returns (absolute_path, url_path) where url_path is relative to /files mount."""
    _ensure_dirs()
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    slug = f"{label}_" if label else ""
    filename = f"{user_id}_{slug}{ts}_{uuid.uuid4().hex[:6]}.png"
    file_path = _IMAGES_DIR / filename
    file_path.write_bytes(base64.b64decode(image_b64))
    return str(file_path), f"/files/images/{filename}"


def save_draft(content: str, user_id: str, platform: str = "", topic: str = "") -> tuple[str, str]:
    """Save draft text to local_storage/drafts/.
    Returns (absolute_path, url_path) where url_path is relative to /files mount."""
    _ensure_dirs()
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    slug = f"{platform}_" if platform else ""
    filename = f"{user_id}_{slug}{ts}_{uuid.uuid4().hex[:6]}.txt"
    file_path = _DRAFTS_DIR / filename
    header = f"# {topic or 'Draft'} | {platform.upper() or 'GENERAL'} | {datetime.utcnow().isoformat()}\n\n"
    file_path.write_text(header + content, encoding="utf-8")
    return str(file_path), f"/files/drafts/{filename}"

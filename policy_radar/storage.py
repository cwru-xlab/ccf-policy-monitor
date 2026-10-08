"""Local-filesystem object storage.

Object keys are ``{source_key}/{sha256}{ext}`` — the same keys a Supabase Storage
bucket would use, so moving to Supabase changes these two functions only.
"""

import hashlib
import mimetypes
from pathlib import Path

from policy_radar.config import settings


def object_key(source_key: str, content: bytes, media_type: str) -> tuple[str, str]:
    """Return ``(object_key, sha256)`` for ``content``."""
    sha = hashlib.sha256(content).hexdigest()
    ext = mimetypes.guess_extension(media_type.split(";")[0].strip()) or ".bin"
    return f"{source_key}/{sha}{ext}", sha


def put(key: str, content: bytes) -> None:
    """Write ``content`` under ``key``; a no-op if it already exists (content-addressed)."""
    path = settings.storage_root / key
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def get(key: str) -> bytes:
    """Read the bytes stored under ``key``."""
    return Path(settings.storage_root / key).read_bytes()

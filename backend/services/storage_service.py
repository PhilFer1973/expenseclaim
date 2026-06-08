"""Supabase Storage helpers — receipts bucket (private).

Submitted images cannot be deleted (enforced by claim status check).
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Optional

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

BUCKET = os.environ.get("RECEIPTS_BUCKET", "receipts")
SIGNED_URL_TTL_SECONDS = 300  # 5 minutes


def receipt_path(employee_id: str, claim_id: str, line_id: str, ext: str = "jpg") -> str:
    return f"{employee_id}/{claim_id}/{line_id}.{ext}"


def upload_receipt(*, path: str, image_b64: str) -> int:
    """Upload base64 JPEG bytes to Storage at the given path. Returns byte size."""
    sb = get_supabase()
    # Strip data URI prefix if present
    if "," in image_b64 and image_b64.strip().startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]
    raw = base64.b64decode(image_b64)
    sb.storage.from_(BUCKET).upload(
        path=path,
        file=raw,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )
    return len(raw)


def signed_url(path: str, ttl_seconds: int = SIGNED_URL_TTL_SECONDS) -> Optional[str]:
    if not path:
        return None
    try:
        res = get_supabase().storage.from_(BUCKET).create_signed_url(path, ttl_seconds)
        # supabase-py returns {"signedURL": "..."} or {"signed_url": "..."}
        return res.get("signedURL") or res.get("signed_url") or res.get("signedUrl")
    except Exception as exc:  # noqa: BLE001
        logger.warning("signed_url failed for %s: %s", path, exc)
        return None


def delete_receipt(path: str) -> None:
    if not path:
        return
    try:
        get_supabase().storage.from_(BUCKET).remove([path])
    except Exception as exc:  # noqa: BLE001
        logger.warning("delete_receipt failed for %s: %s", path, exc)

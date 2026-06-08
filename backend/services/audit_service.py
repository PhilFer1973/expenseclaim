"""Audit event writer — fire-and-forget logging.

Best-effort: errors are swallowed (audit shouldn't break the request).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def log(
    *,
    event_type: str,
    employee_id: Optional[str] = None,
    claim_id: Optional[str] = None,
    claim_line_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
) -> None:
    try:
        get_supabase().table("audit_events").insert(
            {
                "event_type": event_type,
                "employee_id": employee_id,
                "claim_id": claim_id,
                "claim_line_id": claim_line_id,
                "payload": payload,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("audit_log failed for %s: %s", event_type, exc)

"""Audit event writer.

Wired in Phase 2 onwards. Every state-changing endpoint logs one event.
"""
from __future__ import annotations


async def log(
    *,
    event_type: str,
    employee_id: str | None = None,
    claim_id: str | None = None,
    claim_line_id: str | None = None,
    payload: dict | None = None,
) -> None:
    raise NotImplementedError("Phase 2")

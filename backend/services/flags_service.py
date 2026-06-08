"""Soft flags — duplicate + old receipt.

Wired in Phase 7. Flags are advisory only; they never block submission.
"""
from __future__ import annotations

from datetime import date, timedelta

OLD_RECEIPT_THRESHOLD_DAYS = 90


def is_old_receipt(receipt_date: date | None) -> bool:
    if not receipt_date:
        return False
    return receipt_date < date.today() - timedelta(days=OLD_RECEIPT_THRESHOLD_DAYS)


def normalise_supplier(name: str | None) -> str:
    if not name:
        return ""
    return " ".join(name.lower().split())

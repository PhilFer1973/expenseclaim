"""Submit-time validation — rejects a claim if any line is incomplete.

Wired in Phase 7.
"""
from __future__ import annotations


def validate_line_for_submit(line: dict) -> list[str]:
    errors: list[str] = []
    if not line.get("category"):
        errors.append("Category required")
    if not line.get("narrative_final"):
        errors.append("Narrative required")
    if not line.get("gross_amount") or float(line["gross_amount"]) <= 0:
        errors.append("Gross amount must be > 0")
    rs = line.get("receipt_status")
    if rs not in ("receipt", "no_receipt"):
        errors.append("Receipt status required")
    if rs == "receipt" and line.get("image_quality_status") == "unreadable":
        errors.append("Receipt unreadable — retake or switch to no-receipt")
    return errors

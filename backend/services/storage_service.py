"""Supabase Storage helpers — receipts bucket (private).

Wired in Phase 3. Submitted images cannot be deleted.
"""
from __future__ import annotations


def receipt_path(employee_id: str, claim_id: str, line_id: str, ext: str = "jpg") -> str:
    return f"{employee_id}/{claim_id}/{line_id}.{ext}"


def upload_receipt(*args, **kwargs):
    raise NotImplementedError("Phase 3")


def signed_url(*args, **kwargs):
    raise NotImplementedError("Phase 3")


def delete_receipt(*args, **kwargs):
    raise NotImplementedError("Phase 3")

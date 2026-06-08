"""Claim lines router.

Routes:
  POST   /api/claims/{claim_id}/lines     add line (no-receipt path supported)
  GET    /api/lines/{line_id}             read
  PATCH  /api/lines/{line_id}             update (draft only)
  DELETE /api/lines/{line_id}             delete (draft only)
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Response

from models import ClaimLine, LineWriteRequest
from services.audit_service import log as audit_log
from services.flags_service import is_old_receipt, normalise_supplier
from services.supabase_client import get_supabase
from services.vat_service import compute_vat_code

router = APIRouter(tags=["lines"])

DEMO_EMPLOYEE_ID = "00000000-0000-0000-0000-000000000001"


def _claim_status(claim_id: str) -> str:
    sb = get_supabase()
    res = sb.table("claims").select("status").eq("claim_id", claim_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    return res.data["status"]


def _require_draft_claim(claim_id: str) -> None:
    if _claim_status(claim_id) != "draft":
        raise HTTPException(status_code=409, detail="Submitted claims are read-only")


def _to_dec(v: Any) -> Decimal | None:
    if v is None:
        return None
    return Decimal(str(v))


def _apply_vat_and_flags(payload: dict, *, existing: dict | None = None) -> dict:
    """Compute VAT code + flags. Mutates and returns payload."""
    merged = {**(existing or {}), **payload}
    decision = compute_vat_code(
        receipt_status=merged.get("receipt_status"),
        category=merged.get("category"),
        vat_amount=_to_dec(merged.get("vat_amount")),
        supplier_vat_number=merged.get("supplier_vat_number"),
    )
    payload["vat_code"] = decision.vat_code
    payload["vat_amount"] = float(decision.vat_amount)
    # Old-receipt flag
    rd = merged.get("receipt_date")
    if rd is not None:
        from datetime import date as date_t

        if isinstance(rd, str):
            try:
                rd = date_t.fromisoformat(rd)
            except ValueError:
                rd = None
        payload["old_receipt_flag"] = is_old_receipt(rd) if rd else False
    return payload


def _check_duplicate(payload: dict, exclude_line_id: str | None = None) -> bool:
    """Soft duplicate: same employee + same supplier (normalised) + same date + gross within 0.02."""
    sb = get_supabase()
    supplier = normalise_supplier(payload.get("supplier_name"))
    rd = payload.get("receipt_date")
    gross = payload.get("gross_amount")
    if not supplier or not rd or gross is None:
        return False
    # Compare against ALL employees per spec (v1 = single user anyway).
    candidates = (
        sb.table("claim_lines")
        .select("claim_line_id, supplier_name, receipt_date, gross_amount")
        .eq("receipt_date", rd if isinstance(rd, str) else rd.isoformat())
        .execute()
        .data
        or []
    )
    for c in candidates:
        if exclude_line_id and c["claim_line_id"] == exclude_line_id:
            continue
        if normalise_supplier(c.get("supplier_name")) != supplier:
            continue
        c_gross = float(c.get("gross_amount") or 0)
        if abs(c_gross - float(gross)) <= 0.02:
            return True
    return False


@router.post("/claims/{claim_id}/lines", response_model=ClaimLine, status_code=201)
def add_line(claim_id: str, req: LineWriteRequest) -> ClaimLine:
    _require_draft_claim(claim_id)
    if not req.receipt_status:
        raise HTTPException(status_code=400, detail="receipt_status is required")

    payload: dict = req.model_dump(exclude_unset=True, mode="json")
    payload["claim_id"] = claim_id

    # Net derivation: net = gross - vat when net missing
    if payload.get("net_amount") is None and payload.get("gross_amount") is not None:
        gross = float(payload["gross_amount"])
        vat = float(payload.get("vat_amount") or 0)
        payload["net_amount"] = round(gross - vat, 2)

    _apply_vat_and_flags(payload, existing=None)
    payload["duplicate_flag"] = _check_duplicate(payload)

    sb = get_supabase()
    res = sb.table("claim_lines").insert(payload).execute()
    row = res.data[0]
    audit_log(
        event_type="line_created",
        claim_id=claim_id,
        claim_line_id=row["claim_line_id"],
        employee_id=DEMO_EMPLOYEE_ID,
        payload={"receipt_status": payload["receipt_status"]},
    )
    return ClaimLine(**row)


@router.get("/lines/{line_id}", response_model=ClaimLine)
def get_line(line_id: str) -> ClaimLine:
    sb = get_supabase()
    res = sb.table("claim_lines").select("*").eq("claim_line_id", line_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Line not found")
    return ClaimLine(**res.data)


@router.patch("/lines/{line_id}", response_model=ClaimLine)
def update_line(line_id: str, req: LineWriteRequest) -> ClaimLine:
    sb = get_supabase()
    cur = sb.table("claim_lines").select("*").eq("claim_line_id", line_id).single().execute()
    if not cur.data:
        raise HTTPException(status_code=404, detail="Line not found")
    _require_draft_claim(cur.data["claim_id"])

    payload: dict = req.model_dump(exclude_unset=True, mode="json")
    if not payload:
        return ClaimLine(**cur.data)

    # Derive net if missing
    gross = payload.get("gross_amount", cur.data.get("gross_amount"))
    if gross is not None and payload.get("net_amount") is None:
        vat = payload.get("vat_amount", cur.data.get("vat_amount")) or 0
        # Only re-derive if user changed amounts
        if "gross_amount" in payload or "vat_amount" in payload:
            payload["net_amount"] = round(float(gross) - float(vat), 2)

    _apply_vat_and_flags(payload, existing=cur.data)
    merged = {**cur.data, **payload}
    payload["duplicate_flag"] = _check_duplicate(merged, exclude_line_id=line_id)

    res = sb.table("claim_lines").update(payload).eq("claim_line_id", line_id).execute()
    row = res.data[0]
    audit_log(
        event_type="line_updated",
        claim_id=row["claim_id"],
        claim_line_id=line_id,
        employee_id=DEMO_EMPLOYEE_ID,
        payload={"fields": list(payload.keys())},
    )
    return ClaimLine(**row)


@router.delete("/lines/{line_id}", status_code=204, response_class=Response)
def delete_line(line_id: str) -> Response:
    sb = get_supabase()
    cur = sb.table("claim_lines").select("claim_id").eq("claim_line_id", line_id).single().execute()
    if not cur.data:
        raise HTTPException(status_code=404, detail="Line not found")
    _require_draft_claim(cur.data["claim_id"])
    sb.table("claim_lines").delete().eq("claim_line_id", line_id).execute()
    audit_log(
        event_type="line_deleted",
        claim_id=cur.data["claim_id"],
        claim_line_id=line_id,
        employee_id=DEMO_EMPLOYEE_ID,
    )
    return Response(status_code=204)

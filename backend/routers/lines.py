"""Claim lines router.

Routes:
  POST   /api/claims/{claim_id}/lines     add line
  GET    /api/lines/{line_id}             read
  PATCH  /api/lines/{line_id}             update (draft only)
  DELETE /api/lines/{line_id}             delete (draft only)
  POST   /api/lines/{line_id}/receipt     upload base64 JPEG (draft only)
  DELETE /api/lines/{line_id}/receipt     remove image (draft only)
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from models import ClaimLine, LineWriteRequest
from services.audit_service import log as audit_log
from services.flags_service import is_old_receipt, normalise_supplier
from services.storage_service import (
    delete_receipt as storage_delete,
    receipt_path,
    signed_url,
    upload_receipt as storage_upload,
)
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
    merged = {**(existing or {}), **payload}
    decision = compute_vat_code(
        receipt_status=merged.get("receipt_status"),
        category=merged.get("category"),
        vat_amount=_to_dec(merged.get("vat_amount")),
        supplier_vat_number=merged.get("supplier_vat_number"),
    )
    payload["vat_code"] = decision.vat_code
    payload["vat_amount"] = float(decision.vat_amount)
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
    sb = get_supabase()
    supplier = normalise_supplier(payload.get("supplier_name"))
    rd = payload.get("receipt_date")
    gross = payload.get("gross_amount")
    if not supplier or not rd or gross is None:
        return False
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
        if abs(float(c.get("gross_amount") or 0) - float(gross)) <= 0.02:
            return True
    return False


def _line_with_url(row: dict) -> ClaimLine:
    """Attach signed receipt URL if the line has a current image."""
    line = ClaimLine(**row)
    img = (
        get_supabase()
        .table("receipt_images")
        .select("storage_path")
        .eq("claim_line_id", row["claim_line_id"])
        .eq("is_current", True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if img:
        line.receipt_url = signed_url(img[0]["storage_path"])
    return line


@router.post("/claims/{claim_id}/lines", response_model=ClaimLine, status_code=201)
def add_line(claim_id: str, req: LineWriteRequest) -> ClaimLine:
    _require_draft_claim(claim_id)
    if not req.receipt_status:
        raise HTTPException(status_code=400, detail="receipt_status is required")

    payload: dict = req.model_dump(exclude_unset=True, mode="json")
    payload["claim_id"] = claim_id

    if payload.get("net_amount") is None and payload.get("gross_amount") is not None:
        gross = float(payload["gross_amount"])
        vat = float(payload.get("vat_amount") or 0)
        payload["net_amount"] = round(gross - vat, 2)

    _apply_vat_and_flags(payload, existing=None)
    payload["duplicate_flag"] = _check_duplicate(payload)

    res = get_supabase().table("claim_lines").insert(payload).execute()
    row = res.data[0]
    audit_log(
        event_type="line_created",
        claim_id=claim_id,
        claim_line_id=row["claim_line_id"],
        employee_id=DEMO_EMPLOYEE_ID,
        payload={"receipt_status": payload["receipt_status"]},
    )
    return _line_with_url(row)


@router.get("/lines/{line_id}", response_model=ClaimLine)
def get_line(line_id: str) -> ClaimLine:
    res = get_supabase().table("claim_lines").select("*").eq("claim_line_id", line_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Line not found")
    return _line_with_url(res.data)


@router.patch("/lines/{line_id}", response_model=ClaimLine)
def update_line(line_id: str, req: LineWriteRequest) -> ClaimLine:
    sb = get_supabase()
    cur = sb.table("claim_lines").select("*").eq("claim_line_id", line_id).single().execute()
    if not cur.data:
        raise HTTPException(status_code=404, detail="Line not found")
    _require_draft_claim(cur.data["claim_id"])

    payload: dict = req.model_dump(exclude_unset=True, mode="json")
    if not payload:
        return _line_with_url(cur.data)

    gross = payload.get("gross_amount", cur.data.get("gross_amount"))
    if gross is not None and payload.get("net_amount") is None:
        vat = payload.get("vat_amount", cur.data.get("vat_amount")) or 0
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
    return _line_with_url(row)


@router.delete("/lines/{line_id}", status_code=204, response_class=Response)
def delete_line(line_id: str) -> Response:
    sb = get_supabase()
    cur = sb.table("claim_lines").select("claim_id").eq("claim_line_id", line_id).single().execute()
    if not cur.data:
        raise HTTPException(status_code=404, detail="Line not found")
    _require_draft_claim(cur.data["claim_id"])

    # Delete current storage object too (draft only — submitted check already done above)
    imgs = (
        sb.table("receipt_images")
        .select("storage_path")
        .eq("claim_line_id", line_id)
        .execute()
        .data
        or []
    )
    for img in imgs:
        storage_delete(img["storage_path"])

    sb.table("claim_lines").delete().eq("claim_line_id", line_id).execute()
    audit_log(
        event_type="line_deleted",
        claim_id=cur.data["claim_id"],
        claim_line_id=line_id,
        employee_id=DEMO_EMPLOYEE_ID,
    )
    return Response(status_code=204)


# ---------- Receipt image endpoints ----------


class ReceiptUpload(BaseModel):
    image_base64: str = Field(min_length=64)
    width: int | None = None
    height: int | None = None


@router.post("/lines/{line_id}/receipt", response_model=ClaimLine)
def upload_line_receipt(line_id: str, req: ReceiptUpload) -> ClaimLine:
    sb = get_supabase()
    cur = sb.table("claim_lines").select("*").eq("claim_line_id", line_id).single().execute()
    if not cur.data:
        raise HTTPException(status_code=404, detail="Line not found")
    _require_draft_claim(cur.data["claim_id"])

    path = receipt_path(DEMO_EMPLOYEE_ID, cur.data["claim_id"], line_id)
    try:
        size = storage_upload(path=path, image_b64=req.image_base64)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Upload failed: {exc}") from exc

    # Mark previous images as not-current
    sb.table("receipt_images").update({"is_current": False}).eq("claim_line_id", line_id).eq(
        "is_current", True
    ).execute()
    sb.table("receipt_images").insert(
        {
            "claim_line_id": line_id,
            "storage_path": path,
            "byte_size": size,
            "width": req.width,
            "height": req.height,
            "is_current": True,
        }
    ).execute()

    # Switch line to receipt + image_quality_status=ok (Vision will refine in Phase 4)
    update_payload: dict = {"receipt_status": "receipt", "image_quality_status": "ok"}
    _apply_vat_and_flags(update_payload, existing=cur.data)
    sb.table("claim_lines").update(update_payload).eq("claim_line_id", line_id).execute()

    audit_log(
        event_type="receipt_uploaded",
        claim_id=cur.data["claim_id"],
        claim_line_id=line_id,
        employee_id=DEMO_EMPLOYEE_ID,
        payload={"byte_size": size},
    )

    refreshed = sb.table("claim_lines").select("*").eq("claim_line_id", line_id).single().execute()
    return _line_with_url(refreshed.data)


@router.delete("/lines/{line_id}/receipt", status_code=204, response_class=Response)
def delete_line_receipt(line_id: str) -> Response:
    sb = get_supabase()
    cur = sb.table("claim_lines").select("*").eq("claim_line_id", line_id).single().execute()
    if not cur.data:
        raise HTTPException(status_code=404, detail="Line not found")
    _require_draft_claim(cur.data["claim_id"])

    imgs = (
        sb.table("receipt_images")
        .select("image_id, storage_path")
        .eq("claim_line_id", line_id)
        .execute()
        .data
        or []
    )
    for img in imgs:
        storage_delete(img["storage_path"])
    sb.table("receipt_images").delete().eq("claim_line_id", line_id).execute()
    audit_log(
        event_type="receipt_deleted",
        claim_id=cur.data["claim_id"],
        claim_line_id=line_id,
        employee_id=DEMO_EMPLOYEE_ID,
    )
    return Response(status_code=204)

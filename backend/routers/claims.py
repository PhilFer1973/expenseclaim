"""Claims router — CRUD + submit.

Routes:
  GET    /api/claims                   list (status filter)
  POST   /api/claims                   create draft
  GET    /api/claims/{id}              detail + lines
  DELETE /api/claims/{id}              delete draft (cascade)
  POST   /api/claims/{id}/submit       lock claim
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response

from models import ClaimDetail, ClaimLine, ClaimSummary, CreateClaimRequest
from services.audit_service import log as audit_log
from services.supabase_client import get_supabase
from services.validation_service import validate_line_for_submit

router = APIRouter(tags=["claims"])

# Single demo employee for v1.
DEMO_EMPLOYEE_ID = "00000000-0000-0000-0000-000000000001"


def _summary_from_row(row: dict, line_count: int = 0) -> ClaimSummary:
    return ClaimSummary(
        claim_id=row["claim_id"],
        claim_ref=row.get("claim_ref"),
        claim_title=row["claim_title"],
        status=row["status"],
        running_gross_total=float(row.get("running_gross_total") or 0),
        created_at=row["created_at"],
        submitted_at=row.get("submitted_at"),
        line_count=line_count,
    )


@router.get("/claims", response_model=list[ClaimSummary])
def list_claims(status: Optional[str] = Query(default=None, pattern="^(draft|submitted)$")) -> list[ClaimSummary]:
    sb = get_supabase()
    q = sb.table("claims").select("*").eq("employee_id", DEMO_EMPLOYEE_ID)
    if status:
        q = q.eq("status", status)
    rows = q.order("created_at", desc=True).execute().data or []

    if not rows:
        return []

    ids = [r["claim_id"] for r in rows]
    counts_res = (
        sb.table("claim_lines").select("claim_id", count="exact").in_("claim_id", ids).execute()
    )
    # Group manually — supabase-py doesn't expose grouped count, so iterate rows.
    by_claim: dict[str, int] = {}
    for ln in counts_res.data or []:
        by_claim[ln["claim_id"]] = by_claim.get(ln["claim_id"], 0) + 1

    return [_summary_from_row(r, by_claim.get(r["claim_id"], 0)) for r in rows]


@router.post("/claims", response_model=ClaimSummary, status_code=201)
def create_claim(req: CreateClaimRequest) -> ClaimSummary:
    sb = get_supabase()
    res = (
        sb.table("claims")
        .insert(
            {
                "employee_id": DEMO_EMPLOYEE_ID,
                "claim_title": req.title.strip(),
                "status": "draft",
            }
        )
        .execute()
    )
    row = res.data[0]
    audit_log(
        event_type="claim_created",
        employee_id=DEMO_EMPLOYEE_ID,
        claim_id=row["claim_id"],
        payload={"title": row["claim_title"]},
    )
    return _summary_from_row(row, 0)


@router.get("/claims/{claim_id}", response_model=ClaimDetail)
def get_claim(claim_id: str) -> ClaimDetail:
    sb = get_supabase()
    claim_res = (
        sb.table("claims").select("*").eq("claim_id", claim_id).single().execute()
    )
    if not claim_res.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    lines_res = (
        sb.table("claim_lines")
        .select("*")
        .eq("claim_id", claim_id)
        .order("created_at")
        .execute()
    )
    lines = [ClaimLine(**row) for row in (lines_res.data or [])]
    summary = _summary_from_row(claim_res.data, line_count=len(lines))
    return ClaimDetail(**summary.model_dump(), lines=lines)


@router.delete("/claims/{claim_id}", status_code=204, response_class=Response)
def delete_claim(claim_id: str) -> Response:
    sb = get_supabase()
    res = sb.table("claims").select("status").eq("claim_id", claim_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    if res.data["status"] != "draft":
        raise HTTPException(status_code=409, detail="Submitted claims cannot be deleted")
    sb.table("claims").delete().eq("claim_id", claim_id).execute()
    audit_log(event_type="claim_deleted", claim_id=claim_id, employee_id=DEMO_EMPLOYEE_ID)
    return Response(status_code=204)


@router.post("/claims/{claim_id}/submit", response_model=ClaimSummary)
def submit_claim(claim_id: str) -> ClaimSummary:
    sb = get_supabase()
    claim_res = sb.table("claims").select("*").eq("claim_id", claim_id).single().execute()
    if not claim_res.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim_res.data["status"] != "draft":
        raise HTTPException(status_code=409, detail="Claim is already submitted")

    lines_res = sb.table("claim_lines").select("*").eq("claim_id", claim_id).execute()
    lines = lines_res.data or []
    if not lines:
        raise HTTPException(status_code=400, detail="Add at least one line before submitting")

    errors: list[str] = []
    for ln in lines:
        line_errors = validate_line_for_submit(ln)
        if line_errors:
            errors.append(
                f"Line {ln.get('supplier_name') or ln['claim_line_id'][:6]}: {'; '.join(line_errors)}"
            )
    if errors:
        raise HTTPException(status_code=400, detail={"validation_errors": errors})

    updated = (
        sb.table("claims")
        .update({"status": "submitted", "submitted_at": datetime.now(timezone.utc).isoformat()})
        .eq("claim_id", claim_id)
        .execute()
    )
    row = updated.data[0]
    audit_log(event_type="claim_submitted", claim_id=claim_id, employee_id=DEMO_EMPLOYEE_ID)
    return _summary_from_row(row, line_count=len(lines))

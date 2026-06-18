"""AI router — Claude Vision extraction & friends.

Routes:
  POST /api/ai/extract-receipt    Vision extraction for a draft line that
                                  already has an uploaded receipt image.
                                  Updates the line with extracted fields and
                                  returns the refreshed line + extraction meta.
"""
from __future__ import annotations

import base64
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models import ClaimLine
from services.ai_service import extract_receipt, suggest_categories, summarise_narrative
from services.audit_service import log as audit_log
from services.embedding_service import (
    embed,
    embedding_source_hash,
    embedding_source_text,
)
from services.flags_service import is_old_receipt, normalise_supplier
from services.storage_service import download_receipt
from services.supabase_client import get_supabase
from services.vat_service import compute_vat_code

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

DEMO_EMPLOYEE_ID = "00000000-0000-0000-0000-000000000001"


class ExtractRequest(BaseModel):
    line_id: str = Field(min_length=1)
    # Optional override: if the client wants to extract from a freshly-captured
    # image without uploading first (rare). Normally we use the stored receipt.
    image_base64: Optional[str] = None


class ExtractResponse(BaseModel):
    line: ClaimLine
    extracted: dict[str, Any]


def _to_dec(v: Any):
    from decimal import Decimal

    if v is None:
        return None
    return Decimal(str(v))


@router.post("/extract-receipt", response_model=ExtractResponse)
async def extract_receipt_endpoint(req: ExtractRequest) -> ExtractResponse:
    sb = get_supabase()
    line_res = (
        sb.table("claim_lines")
        .select("*")
        .eq("claim_line_id", req.line_id)
        .execute()
    )
    if not line_res.data:
        raise HTTPException(status_code=404, detail="Line not found")
    line = line_res.data[0]

    claim_rows = (
        sb.table("claims").select("status").eq("claim_id", line["claim_id"]).execute().data or []
    )
    claim_status = (claim_rows[0] if claim_rows else {}).get("status")
    if claim_status != "draft":
        raise HTTPException(status_code=409, detail="Submitted claims are read-only")

    # Resolve image bytes
    if req.image_base64:
        image_b64 = req.image_base64
    else:
        img_row = (
            sb.table("receipt_images")
            .select("storage_path")
            .eq("claim_line_id", req.line_id)
            .eq("is_current", True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not img_row:
            raise HTTPException(status_code=400, detail="No receipt image to extract")
        try:
            raw_bytes = download_receipt(img_row[0]["storage_path"])
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Image fetch failed: {exc}") from exc
        image_b64 = base64.b64encode(raw_bytes).decode("ascii")

    try:
        extracted = await extract_receipt(image_b64)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Vision extraction failed")
        raise HTTPException(status_code=502, detail=f"Vision extraction failed: {exc}") from exc

    quality = extracted.get("image_quality") or "ok"
    # Preserve the true quality signal — "unreadable" must NOT be silently
    # downgraded to "blurry". The client uses it to prompt a retake / switch
    # to no-receipt instead of saving guessed values, and validate_line_for_submit
    # blocks submitting an unreadable receipt line.
    image_quality_status = quality if quality in {"ok", "blurry", "unreadable"} else "ok"

    # Build update payload — keep existing values when the model returned null.
    gross = extracted.get("gross_amount") or line.get("gross_amount")
    vat = extracted.get("vat_amount")
    if vat is None:
        vat = line.get("vat_amount") or 0
    net = extracted.get("net_amount")
    if net is None and gross is not None:
        net = round(float(gross) - float(vat or 0), 2)

    payload: dict = {
        "supplier_name": extracted.get("supplier_name") or line.get("supplier_name"),
        "supplier_vat_number": extracted.get("supplier_vat_number") or line.get("supplier_vat_number"),
        "receipt_date": extracted.get("receipt_date") or line.get("receipt_date"),
        "gross_amount": float(gross) if gross is not None else None,
        "vat_amount": float(vat) if vat is not None else 0.0,
        "net_amount": float(net) if net is not None else None,
        "image_quality_status": image_quality_status,
    }
    if extracted.get("category_hint") and not line.get("category"):
        # Hint only — final selection happens in Phase 5 reranker.
        pass

    # Recompute VAT code from merged state
    merged = {**line, **payload}
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
    if rd:
        from datetime import date as date_t

        try:
            rd_obj = date_t.fromisoformat(rd) if isinstance(rd, str) else rd
            payload["old_receipt_flag"] = is_old_receipt(rd_obj)
        except ValueError:
            payload["old_receipt_flag"] = False

    # Persist
    sb.table("claim_lines").update(payload).eq("claim_line_id", req.line_id).execute()

    confidence = float(extracted.get("confidence") or 0.0)
    audit_log(
        event_type="receipt_extracted",
        claim_id=line["claim_id"],
        claim_line_id=req.line_id,
        employee_id=DEMO_EMPLOYEE_ID,
        payload={
            "confidence": confidence,
            "image_quality": image_quality_status,
            "supplier": payload.get("supplier_name"),
            "gross": payload.get("gross_amount"),
            "category_hint": extracted.get("category_hint"),
        },
    )

    # Return refreshed line + structured extraction details
    refreshed = (
        sb.table("claim_lines")
        .select("*")
        .eq("claim_line_id", req.line_id)
        .single()
        .execute()
        .data
    )
    line_model = ClaimLine(**refreshed)
    # Attach signed URL for convenience
    img = (
        sb.table("receipt_images")
        .select("storage_path")
        .eq("claim_line_id", req.line_id)
        .eq("is_current", True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if img:
        from services.storage_service import signed_url

        line_model.receipt_url = signed_url(img[0]["storage_path"])

    return ExtractResponse(
        line=line_model,
        extracted={
            "supplier_name": extracted.get("supplier_name"),
            "receipt_date": extracted.get("receipt_date"),
            "gross_amount": extracted.get("gross_amount"),
            "vat_amount": extracted.get("vat_amount"),
            "net_amount": extracted.get("net_amount"),
            "category_hint": extracted.get("category_hint"),
            "image_quality": image_quality_status,
            "confidence": confidence,
            "notes": extracted.get("notes"),
        },
    )



class SuggestRequest(BaseModel):
    line_id: str = Field(min_length=1)


class SuggestResponse(BaseModel):
    ranked: list[dict[str, Any]]
    explanation: str
    neighbour_count: int


@router.post("/suggest-category", response_model=SuggestResponse)
async def suggest_category_endpoint(req: SuggestRequest) -> SuggestResponse:
    sb = get_supabase()
    line_rows = (
        sb.table("claim_lines")
        .select("*")
        .eq("claim_line_id", req.line_id)
        .execute()
        .data
        or []
    )
    if not line_rows:
        raise HTTPException(status_code=404, detail="Line not found")
    line = line_rows[0]

    # Categories
    categories = (
        sb.table("categories")
        .select("name, is_unrecoverable")
        .order("sort_order")
        .execute()
        .data
        or []
    )

    # Embedding for the line
    src_text = embedding_source_text(line)
    try:
        vec = await embed(src_text)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Embedding failed")
        raise HTTPException(status_code=502, detail=f"Embedding failed: {exc}") from exc

    # Persist the embedding (upsert) so this line participates in future kNN.
    try:
        sb.table("receipt_embeddings").upsert(
            {
                "claim_line_id": req.line_id,
                "embedding": vec,
                "source_hash": embedding_source_hash(src_text),
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Embedding upsert failed: %s", exc)

    # kNN over past lines via pgvector RPC.
    neighbours: list[dict] = []
    try:
        knn_res = sb.rpc(
            "match_receipt_lines",
            {
                "query_embedding": vec,
                "for_employee_id": DEMO_EMPLOYEE_ID,
                "match_limit": 8,
                "min_similarity": 0.0,
            },
        ).execute()
        neighbours = [n for n in (knn_res.data or []) if n.get("claim_line_id") != req.line_id]
    except Exception as exc:  # noqa: BLE001
        logger.warning("kNN RPC failed: %s", exc)

    # Claude rerank
    try:
        result = await suggest_categories(line, categories, neighbours)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Claude rerank failed")
        raise HTTPException(status_code=502, detail=f"Suggestion failed: {exc}") from exc

    # Persist soft suggestion on the line so the UI badge can come back later.
    try:
        sb.table("claim_lines").update(
            {
                "ai_category_suggestions": result["ranked"],
                "ai_category_explanation": result["explanation"],
            }
        ).eq("claim_line_id", req.line_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Persist suggestions failed: %s", exc)

    audit_log(
        event_type="category_suggested",
        claim_id=line["claim_id"],
        claim_line_id=req.line_id,
        employee_id=DEMO_EMPLOYEE_ID,
        payload={
            "top": result["ranked"][0] if result["ranked"] else None,
            "neighbour_count": len(neighbours),
        },
    )

    return SuggestResponse(
        ranked=result["ranked"],
        explanation=result["explanation"],
        neighbour_count=len(neighbours),
    )



class SummariseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    line_id: Optional[str] = None


class SummariseResponse(BaseModel):
    transcript: str
    summary: str


@router.post("/summarise-narrative", response_model=SummariseResponse)
async def summarise_narrative_endpoint(req: SummariseRequest) -> SummariseResponse:
    cleaned = req.text.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        summary = await summarise_narrative(cleaned)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Narrative summarise failed")
        raise HTTPException(status_code=502, detail=f"Summariser failed: {exc}") from exc

    # If a line_id was provided, persist both raw + summary for that draft line.
    if req.line_id:
        sb = get_supabase()
        line_rows = (
            sb.table("claim_lines")
            .select("*")
            .eq("claim_line_id", req.line_id)
            .execute()
            .data
            or []
        )
        if line_rows:
            line = line_rows[0]
            claim_rows = (
                sb.table("claims").select("status").eq("claim_id", line["claim_id"]).execute().data or []
            )
            if (claim_rows[0] if claim_rows else {}).get("status") == "draft":
                sb.table("claim_lines").update(
                    {"voice_transcript_raw": cleaned, "narrative_final": summary[:50]}
                ).eq("claim_line_id", req.line_id).execute()
                audit_log(
                    event_type="narrative_summarised",
                    claim_id=line["claim_id"],
                    claim_line_id=req.line_id,
                    employee_id=DEMO_EMPLOYEE_ID,
                    payload={"raw_len": len(cleaned), "summary_len": len(summary)},
                )

    return SummariseResponse(transcript=cleaned, summary=summary[:50])

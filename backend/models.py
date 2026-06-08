"""Pydantic models shared by routers."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ---------- response models ----------


class Employee(BaseModel):
    employee_id: str
    name: str
    email: str
    is_demo: bool


class Category(BaseModel):
    name: str
    is_unrecoverable: bool
    sort_order: int


class ClaimLine(BaseModel):
    claim_line_id: str
    claim_id: str
    receipt_status: Literal["receipt", "no_receipt"]
    image_quality_status: Optional[Literal["ok", "blurry", "unreadable"]] = None
    supplier_name: Optional[str] = None
    supplier_vat_number: Optional[str] = None
    receipt_number: Optional[str] = None
    receipt_date: Optional[date] = None
    category: Optional[str] = None
    net_amount: Optional[float] = None
    vat_amount: Optional[float] = 0
    gross_amount: Optional[float] = None
    vat_code: Literal["UK20", "UK0", "UNREC", "REVIEW"]
    narrative_final: Optional[str] = None
    voice_transcript_raw: Optional[str] = None
    ai_category_suggestions: Optional[Any] = None
    ai_category_explanation: Optional[str] = None
    duplicate_flag: bool = False
    old_receipt_flag: bool = False
    receipt_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ClaimSummary(BaseModel):
    claim_id: str
    claim_ref: Optional[str] = None
    claim_title: str
    status: Literal["draft", "submitted"]
    running_gross_total: float = 0
    created_at: datetime
    submitted_at: Optional[datetime] = None
    line_count: int = 0


class ClaimDetail(ClaimSummary):
    lines: list[ClaimLine] = Field(default_factory=list)


# ---------- request models ----------


class CreateClaimRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class LineWriteRequest(BaseModel):
    """Used for both create and patch. Fields omitted are unchanged."""

    receipt_status: Optional[Literal["receipt", "no_receipt"]] = None
    supplier_name: Optional[str] = None
    supplier_vat_number: Optional[str] = None
    receipt_number: Optional[str] = None
    receipt_date: Optional[date] = None
    category: Optional[str] = None
    net_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    gross_amount: Optional[float] = None
    narrative_final: Optional[str] = None
    voice_transcript_raw: Optional[str] = None

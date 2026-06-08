"""Deterministic VAT engine — single source of truth for vat_code.

Rules (locked, system-controlled, user cannot edit):
  IF receipt_status = 'no_receipt'              -> vat_amount = 0, vat_code = 'UK0'
  ELIF category = 'Client Entertaining'         -> vat_code = 'UNREC'
  ELIF vat_amount > 0 AND vat_number is missing -> vat_code = 'REVIEW'
  ELIF vat_amount > 0                           -> vat_code = 'UK20'
  ELSE                                          -> vat_code = 'UK0'

REVIEW does not block submission.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional


CLIENT_ENTERTAINING = "Client Entertaining"


@dataclass
class VatDecision:
    vat_code: str  # 'UK20' | 'UK0' | 'UNREC' | 'REVIEW'
    vat_amount: Decimal


def compute_vat_code(
    *,
    receipt_status: str,
    category: Optional[str],
    vat_amount: Optional[Decimal],
    supplier_vat_number: Optional[str],
) -> VatDecision:
    if receipt_status == "no_receipt":
        return VatDecision(vat_code="UK0", vat_amount=Decimal("0"))

    if category == CLIENT_ENTERTAINING:
        return VatDecision(vat_code="UNREC", vat_amount=vat_amount or Decimal("0"))

    amount = vat_amount or Decimal("0")
    if amount > 0 and not supplier_vat_number:
        return VatDecision(vat_code="REVIEW", vat_amount=amount)
    if amount > 0:
        return VatDecision(vat_code="UK20", vat_amount=amount)
    return VatDecision(vat_code="UK0", vat_amount=Decimal("0"))

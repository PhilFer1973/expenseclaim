"""Deterministic VAT engine — single source of truth for vat_code.

Rules (system-controlled, user cannot edit directly — the code follows the
VAT amount the user enters):
  IF receipt_status = 'no_receipt'      -> vat_amount = 0, vat_code = 'UK0'
  ELIF category = 'Client Entertaining' -> vat_code = 'UNREC'
  ELIF vat_amount > 0                   -> vat_code = 'UK20'
  ELSE                                  -> vat_code = 'UK0'

Any positive VAT is treated as UK20 (standard-rated), regardless of whether it
is exactly 20% of the net — mixed receipts legitimately have some vatable and
some zero-rated lines. A missing supplier VAT number no longer downgrades to
REVIEW (owner decision); REVIEW is retained in the enum but no longer assigned.
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
    if amount > 0:
        # Any positive UK VAT is standard-rated UK20. We do not require the VAT
        # ratio to be 20% (mixed-rate receipts) nor a supplier VAT number.
        return VatDecision(vat_code="UK20", vat_amount=amount)
    return VatDecision(vat_code="UK0", vat_amount=Decimal("0"))

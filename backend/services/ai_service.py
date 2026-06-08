"""Claude Sonnet 4.5 — receipt extraction, category re-ranking, narrative summary.

Phase 4: extract_receipt — Claude Vision pulls supplier, date, gross & VAT
from a base64 JPEG/PNG. Returns a structured dict including a confidence
score (0..1) and an image_quality hint ("ok"|"blurry").
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any

from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage

logger = logging.getLogger(__name__)

MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"

EXTRACT_SYSTEM_PROMPT = """You are a receipt OCR assistant for a UK SME expense app.
Given a single receipt photograph you extract structured data.

Return ONLY a JSON object with this exact shape (no prose, no markdown fences):
{
  "supplier_name": string | null,
  "supplier_vat_number": string | null,
  "receipt_date": "YYYY-MM-DD" | null,
  "currency": "GBP" | string | null,
  "gross_amount": number | null,
  "vat_amount": number | null,
  "net_amount": number | null,
  "category_hint": string | null,
  "image_quality": "ok" | "blurry" | "unreadable",
  "confidence": number,                         // 0.0 .. 1.0 overall confidence
  "notes": string | null
}

Rules:
- All amounts are positive decimal numbers in major currency units (e.g. 12.34).
- If VAT is not printed but a UK VAT number is visible AND gross is known, set vat_amount to round(gross/6, 2) (standard 20% inclusive) ONLY IF you are confident the receipt is VAT-inclusive; otherwise leave null.
- receipt_date must be in ISO-8601 (YYYY-MM-DD). If only a partial date is visible, set null.
- category_hint should be a short label like "Travel", "Meals", "Hotel", "Software" — or null if unsure.
- Set image_quality="blurry" if you can read fewer than half of the lines clearly. Use "unreadable" if you cannot extract supplier or any amount.
- confidence is your aggregate trust score for the structured fields you returned.
- Output VALID JSON only. No backticks, no commentary.
"""


def _strip_data_url(image_b64: str) -> str:
    """Strip a data:image/...;base64, prefix if present."""
    if image_b64.startswith("data:"):
        _, _, payload = image_b64.partition(",")
        return payload
    return image_b64


def _coerce_number(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def _coerce_date(v: Any) -> str | None:
    if not isinstance(v, str):
        return None
    # Accept YYYY-MM-DD
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return v
    return None


def _parse_json_object(text: str) -> dict | None:
    """Be tolerant: strip fences or pre/post prose."""
    if not text:
        return None
    # Try direct first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip markdown fences
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


async def extract_receipt(image_base64: str) -> dict:
    """Run Claude Sonnet 4.5 Vision on a receipt image. Returns structured fields.

    The returned dict always contains:
      supplier_name, supplier_vat_number, receipt_date, currency,
      gross_amount, vat_amount, net_amount, category_hint,
      image_quality, confidence, notes, raw_model_response
    """
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")

    image_b64 = _strip_data_url(image_base64)

    chat = LlmChat(
        api_key=api_key,
        session_id=f"receipt-extract-{uuid.uuid4()}",
        system_message=EXTRACT_SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    user_msg = UserMessage(
        text="Extract the structured receipt fields from this image. Respond with JSON only.",
        file_contents=[ImageContent(image_base64=image_b64)],
    )

    try:
        raw = await chat.send_message(user_msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Claude vision extract failed")
        raise RuntimeError(f"Vision call failed: {exc}") from exc

    text = raw if isinstance(raw, str) else str(raw)
    parsed = _parse_json_object(text) or {}

    result = {
        "supplier_name": parsed.get("supplier_name") or None,
        "supplier_vat_number": parsed.get("supplier_vat_number") or None,
        "receipt_date": _coerce_date(parsed.get("receipt_date")),
        "currency": parsed.get("currency") or None,
        "gross_amount": _coerce_number(parsed.get("gross_amount")),
        "vat_amount": _coerce_number(parsed.get("vat_amount")),
        "net_amount": _coerce_number(parsed.get("net_amount")),
        "category_hint": parsed.get("category_hint") or None,
        "image_quality": parsed.get("image_quality") if parsed.get("image_quality") in {"ok", "blurry", "unreadable"} else "ok",
        "confidence": _coerce_number(parsed.get("confidence")) or 0.0,
        "notes": parsed.get("notes") or None,
        "raw_model_response": text,
    }

    # Derive net if missing
    if (
        result["net_amount"] is None
        and result["gross_amount"] is not None
        and result["vat_amount"] is not None
    ):
        result["net_amount"] = round(result["gross_amount"] - result["vat_amount"], 2)

    return result


async def rerank_categories(line_payload: dict, neighbours: list[dict]) -> dict:
    raise NotImplementedError("Phase 5")


async def summarise_narrative(text: str) -> str:
    raise NotImplementedError("Phase 6")

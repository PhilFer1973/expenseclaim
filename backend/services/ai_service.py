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
    raise NotImplementedError("Phase 5 — use suggest_categories instead")


SUGGEST_SYSTEM_PROMPT = """You are a UK SME expense category assistant.

Given:
- A new receipt line (supplier, optional date, gross amount, optional category hint from vision)
- A list of allowed categories (with an is_unrecoverable flag)
- A list of past receipt lines from the same employee with their final categories (these were kNN-similar by embedding)

Pick the THREE most likely categories for the new line, ranked by confidence.
Prefer categories the employee has used for similar past supplier/narrative patterns.
For supplier names that obviously map to a category (e.g. "Uber" -> Travel, "Pret" -> Meals),
prefer that direct mapping even if past lines are sparse.

Return ONLY a JSON object of this exact shape (no prose, no markdown):
{
  "ranked": [
    {"category": "Travel", "confidence": 0.92, "reason": "Past Uber rides categorised as Travel"},
    {"category": "Meals",  "confidence": 0.05, "reason": "..."},
    {"category": "Other",  "confidence": 0.03, "reason": "fallback"}
  ],
  "explanation": "One short sentence explaining the top pick, no more than 25 words."
}

Rules:
- "ranked" must have exactly 3 entries.
- "category" must be EXACTLY one of the allowed category names provided.
- "confidence" values must sum to ~1.0 (rough; we will normalise client-side).
- Output VALID JSON only.
"""


async def suggest_categories(
    line: dict,
    categories: list[dict],
    neighbours: list[dict],
) -> dict:
    """Use Claude to rerank candidate categories given the new line + kNN neighbours.

    Returns dict shape:
      {
        "ranked": [{"category": str, "confidence": float, "reason": str}, ...],  # len 3
        "explanation": str,
      }
    """
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"cat-suggest-{uuid.uuid4()}",
        system_message=SUGGEST_SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)

    payload = {
        "new_line": {
            "supplier_name": line.get("supplier_name"),
            "receipt_date": line.get("receipt_date"),
            "gross_amount": float(line.get("gross_amount")) if line.get("gross_amount") is not None else None,
            "narrative_final": line.get("narrative_final"),
            "category_hint": line.get("category_hint"),
        },
        "allowed_categories": [
            {"name": c["name"], "is_unrecoverable": bool(c.get("is_unrecoverable"))}
            for c in categories
        ],
        "past_lines_knn": [
            {
                "supplier_name": n.get("supplier_name"),
                "category": n.get("category"),
                "narrative_final": n.get("narrative_final"),
                "gross_amount": float(n["gross_amount"]) if n.get("gross_amount") is not None else None,
                "receipt_date": str(n.get("receipt_date")) if n.get("receipt_date") else None,
                "similarity": round(float(n.get("similarity", 0)), 3),
            }
            for n in neighbours
        ],
    }

    user_msg = UserMessage(text=json.dumps(payload))
    try:
        raw = await chat.send_message(user_msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Claude category rerank failed")
        raise RuntimeError(f"Category suggestion failed: {exc}") from exc

    text = raw if isinstance(raw, str) else str(raw)
    parsed = _parse_json_object(text) or {}
    ranked = parsed.get("ranked") or []
    # Validate categories against allowlist; drop unknowns.
    allowed = {c["name"] for c in categories}
    cleaned = []
    for r in ranked:
        if not isinstance(r, dict):
            continue
        name = r.get("category")
        if name not in allowed:
            continue
        try:
            conf = float(r.get("confidence") or 0.0)
        except (TypeError, ValueError):
            conf = 0.0
        cleaned.append({"category": name, "confidence": conf, "reason": (r.get("reason") or "")[:140]})
    # Ensure we always return 3 (pad with remaining allowed cats).
    used = {c["category"] for c in cleaned}
    for c in categories:
        if len(cleaned) >= 3:
            break
        if c["name"] not in used:
            cleaned.append({"category": c["name"], "confidence": 0.0, "reason": "fallback"})
    cleaned = cleaned[:3]
    # Normalise to sum-to-1 ish (purely cosmetic).
    total = sum(c["confidence"] for c in cleaned) or 1.0
    for c in cleaned:
        c["confidence"] = round(c["confidence"] / total, 3)

    return {
        "ranked": cleaned,
        "explanation": (parsed.get("explanation") or "").strip()[:240],
    }


async def summarise_narrative(text: str) -> str:
    raise NotImplementedError("Phase 6")

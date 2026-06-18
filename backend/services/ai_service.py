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

import anthropic

logger = logging.getLogger(__name__)

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
- Read every value EXACTLY as printed on the receipt. Never estimate, round, infer, or invent a date or amount. If a specific field is not clearly legible, return null for that field rather than guessing.
- supplier_name is the merchant/store name, usually at the very top of the receipt or in its logo. Read it character by character. If the name is in a stylised logo and you are not confident of the exact spelling, return null rather than guessing a plausible-looking but different name.
- gross_amount is the TOTAL AMOUNT PAID — the figure on the main "Total" / "Balance Due" / "Amount Due" / "Paid" / "Card" line in the body of the receipt. It is the LARGEST money total and is what the customer was charged.
- Many receipts print a VAT summary near the bottom (e.g. "VAT @ 20%", or a "Totals" line showing the VAT amount and the NET/ex-VAT amount). Use that section for vat_amount and net_amount. The NET figure in the VAT summary is NOT the gross — do NOT use it as gross_amount even if its line is labelled "Total" or "Totals".
- Reconciliation: gross_amount must equal net_amount + vat_amount, and gross_amount must be the largest of the three. If your chosen values do not reconcile, you have mislabelled them — re-read the receipt and correct before answering.
- All amounts are positive decimal numbers in major currency units (e.g. 12.34).
- If VAT is not printed but a UK VAT number is visible AND gross is known, set vat_amount to round(gross/6, 2) (standard 20% inclusive) ONLY IF you are confident the receipt is VAT-inclusive; otherwise leave null.
- receipt_date must be in ISO-8601 (YYYY-MM-DD). Read dates carefully:
  * The purchase date is usually labelled "Date:" (often near the top). Use that labelled date. NEVER use the transaction/receipt number, till number, card number, or the printed time as the date.
  * UK receipts and rail tickets usually print the day FIRST (DD MMM YY, DD-MM-YY or DD/MM/YYYY).
  * Map 3-letter month abbreviations exactly: JAN=01, FEB=02, MAR=03, APR=04, MAY=05, JUN=06, JUL=07, AUG=08, SEP=09, OCT=10, NOV=11, DEC=12.
  * If the month letters are smudged or partly unreadable from OCR, choose the month whose standard abbreviation best matches the visible letters and any surrounding context; do NOT default to an earlier month such as March.
  * Expand a 2-digit year to 20YY (e.g. 18 -> 2018) unless that produces a future date, in which case use 19YY.
  * Only set null if you genuinely cannot read the day, month, or year at all.
- category_hint should be a short label like "Travel", "Meals", "Hotel", "Software" — or null if unsure.
- Set image_quality="blurry" if you can read fewer than half of the lines clearly. Use "unreadable" if you cannot extract supplier or any amount.
- confidence is your aggregate trust score for the structured fields you returned.
- Output VALID JSON only. No backticks, no commentary.
"""


def _get_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")
    return anthropic.Anthropic(api_key=api_key)


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
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return v
    return None


def _parse_json_object(text: str) -> dict | None:
    """Be tolerant: strip fences or pre/post prose."""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


async def extract_receipt(image_base64: str) -> dict:
    """Run Claude Vision on a receipt image. Returns structured fields."""
    client = _get_client()
    image_b64 = _strip_data_url(image_base64)

    try:
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=1024,
            temperature=0,  # deterministic — same receipt must extract the same values
            system=EXTRACT_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Extract the structured receipt fields from this image. Respond with JSON only.",
                        },
                    ],
                }
            ],
        )
    except Exception as exc:
        logger.exception("Claude vision extract failed")
        raise RuntimeError(f"Vision call failed: {exc}") from exc

    text = response.content[0].text if response.content else ""
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
    """Use Claude to rerank candidate categories given the new line + kNN neighbours."""
    client = _get_client()

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

    try:
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=1024,
            temperature=0,  # deterministic category ranking
            system=SUGGEST_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(payload)}],
        )
    except Exception as exc:
        logger.exception("Claude category rerank failed")
        raise RuntimeError(f"Category suggestion failed: {exc}") from exc

    text = response.content[0].text if response.content else ""
    parsed = _parse_json_object(text) or {}
    ranked = parsed.get("ranked") or []

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

    used = {c["category"] for c in cleaned}
    for c in categories:
        if len(cleaned) >= 3:
            break
        if c["name"] not in used:
            cleaned.append({"category": c["name"], "confidence": 0.0, "reason": "fallback"})
    cleaned = cleaned[:3]

    total = sum(c["confidence"] for c in cleaned) or 1.0
    for c in cleaned:
        c["confidence"] = round(c["confidence"] / total, 3)

    return {
        "ranked": cleaned,
        "explanation": (parsed.get("explanation") or "").strip()[:240],
    }


SUMMARISE_SYSTEM_PROMPT = """You convert spoken expense narratives into a
50-character business expense memo.

Rules:
- Output ONE line, MAX 50 characters (count carefully).
- Sentence-case, no trailing period.
- Keep the business purpose, drop filler words ("erm", "uh", "this was").
- Prefer concrete entities: meal type, attendees role, journey purpose.
- If the input is already short and clean, return it as-is (truncated if >50).
- Output ONLY the summary text, no quotes, no JSON, no prose.
"""


async def summarise_narrative(text: str) -> str:
    """Use Claude to compress a voice transcript into a <=50 char memo."""
    cleaned = (text or "").strip()
    if not cleaned:
        return ""
    if len(cleaned) <= 50 and "\n" not in cleaned:
        return cleaned

    try:
        client = _get_client()
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=64,
            system=SUMMARISE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": cleaned}],
        )
        raw = response.content[0].text if response.content else ""
    except Exception as exc:
        logger.warning("summarise_narrative failed, falling back: %s", exc)
        return cleaned[:50].rstrip()

    out = raw.strip().splitlines()[0]
    out = out.strip('"‘’“” ')
    return out[:50].rstrip()

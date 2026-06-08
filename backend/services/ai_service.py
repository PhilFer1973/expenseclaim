"""Claude Sonnet 4.5 — receipt extraction, category re-ranking, narrative summary.

Implemented in Phase 4 / 5 / 6.
"""
from __future__ import annotations


async def extract_receipt(image_base64: str) -> dict:
    raise NotImplementedError("Phase 4")


async def rerank_categories(line_payload: dict, neighbours: list[dict]) -> dict:
    raise NotImplementedError("Phase 5")


async def summarise_narrative(text: str) -> str:
    raise NotImplementedError("Phase 6")

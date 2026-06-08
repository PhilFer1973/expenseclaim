"""OpenAI text-embedding-3-small (1536-d) via Emergent Universal Key.

Wired in Phase 5.
"""
from __future__ import annotations


def embedding_source_text(line: dict) -> str:
    parts = [
        (line.get("supplier_name") or "").lower(),
        line.get("category") or "",
        line.get("narrative_final") or "",
        line.get("receipt_number") or "",
        str(line.get("gross_amount") or ""),
    ]
    return " | ".join(p for p in parts if p)


async def embed(text: str) -> list[float]:
    raise NotImplementedError("Phase 5")

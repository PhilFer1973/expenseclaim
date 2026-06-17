"""OpenAI text-embedding-3-small (1536-d) via direct OpenAI API."""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Iterable

# NOTE: litellm is imported lazily inside the functions that use it.
# Its top-level import is very heavy (several seconds) and was blocking
# app startup long enough for Azure to kill the container. Importing it
# on first embedding call keeps boot fast.

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


def embedding_source_text(line: dict) -> str:
    parts = [
        (line.get("supplier_name") or "").lower(),
        line.get("category") or "",
        line.get("narrative_final") or "",
        line.get("receipt_number") or "",
        str(line.get("gross_amount") or ""),
    ]
    return " | ".join(p for p in parts if p)


def embedding_source_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()



async def embed(text: str) -> list[float]:
    """Embed a single text string and return a 1536-d float list."""
    openai_key = os.getenv("OPENAI_API_KEY")
    if not text.strip():
        return [0.0] * EMBEDDING_DIM

    if openai_key:
        # Call OpenAI directly — preferred (lowest latency, full feature support).
        import litellm  # lazy import — heavy module, see note at top
        try:
            resp = await litellm.aembedding(
                model=EMBEDDING_MODEL,
                input=text,
                api_key=openai_key,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("OpenAI embedding call failed")
            raise RuntimeError(f"Embedding call failed: {exc}") from exc
        data = getattr(resp, "data", None) or resp.get("data", [])
        if not data:
            raise RuntimeError("Embedding response missing data")
        return list(data[0]["embedding"])

    raise RuntimeError("OPENAI_API_KEY is not configured")


async def embed_many(texts: Iterable[str]) -> list[list[float]]:
    """Embed multiple texts in a single API call."""
    items = [t if t and t.strip() else " " for t in texts]
    if not items:
        return []
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    import litellm  # lazy import — heavy module, see note at top
    resp = await litellm.aembedding(
        model=EMBEDDING_MODEL,
        input=items,
        api_key=openai_key,
    )
    data = getattr(resp, "data", None) or resp.get("data", [])
    return [list(d["embedding"]) for d in data]

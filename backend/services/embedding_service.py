"""OpenAI text-embedding-3-small (1536-d) via Emergent Universal Key.

Routed through the same integration proxy used by emergentintegrations.LlmChat,
so the EMERGENT_LLM_KEY works for embeddings too.
"""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Iterable

import litellm
from emergentintegrations.llm.utils import get_integration_proxy_url

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


def _is_emergent_key(key: str) -> bool:
    return bool(key) and key.startswith("sk-emergent-")


async def embed(text: str) -> list[float]:
    """Embed a single text string and return a 1536-d float list."""
    key = os.getenv("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")
    if not text.strip():
        # Return a zero vector for empty input rather than calling the API.
        return [0.0] * EMBEDDING_DIM

    kwargs: dict = {
        "model": EMBEDDING_MODEL,
        "input": text,
        "api_key": key,
    }
    if _is_emergent_key(key):
        kwargs["api_base"] = get_integration_proxy_url() + "/llm"
        kwargs["custom_llm_provider"] = "openai"

    try:
        resp = await litellm.aembedding(**kwargs)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Embedding call failed")
        raise RuntimeError(f"Embedding call failed: {exc}") from exc

    data = getattr(resp, "data", None) or resp.get("data", [])
    if not data:
        raise RuntimeError("Embedding response missing data")
    return list(data[0]["embedding"])


async def embed_many(texts: Iterable[str]) -> list[list[float]]:
    """Embed multiple texts in a single API call when possible."""
    items = [t if t and t.strip() else " " for t in texts]
    if not items:
        return []
    key = os.getenv("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")
    kwargs: dict = {
        "model": EMBEDDING_MODEL,
        "input": items,
        "api_key": key,
    }
    if _is_emergent_key(key):
        kwargs["api_base"] = get_integration_proxy_url() + "/llm"
        kwargs["custom_llm_provider"] = "openai"
    resp = await litellm.aembedding(**kwargs)
    data = getattr(resp, "data", None) or resp.get("data", [])
    return [list(d["embedding"]) for d in data]

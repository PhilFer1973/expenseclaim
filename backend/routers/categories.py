"""GET /api/categories — returns the 11 v1 categories."""
from __future__ import annotations

from fastapi import APIRouter

from models import Category
from services.supabase_client import get_supabase

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[Category])
def list_categories() -> list[Category]:
    res = (
        get_supabase()
        .table("categories")
        .select("name, is_unrecoverable, sort_order")
        .order("sort_order")
        .execute()
    )
    return [Category(**row) for row in (res.data or [])]

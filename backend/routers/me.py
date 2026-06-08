"""GET /api/me — returns the demo employee.

v1 is single-user. Frontend assumes this endpoint returns one row.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models import Employee
from services.supabase_client import get_supabase

router = APIRouter(tags=["me"])


@router.get("/me", response_model=Employee)
def get_me() -> Employee:
    res = (
        get_supabase()
        .table("employees")
        .select("employee_id, name, email, is_demo")
        .eq("is_demo", True)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Demo employee not found")
    return Employee(**res.data)

"""Phase 1 verifier — run after pasting 001_schema.sql + 002_seed.sql into the
Supabase SQL Editor.

Checks:
  1. Connectivity via supabase-py
  2. Seed rows present (employees, categories, claims, claim_lines)
  3. Private 'receipts' Storage bucket exists; creates it if missing.

Usage (from /app):
    python -m backend.scripts.verify_supabase
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from supabase import create_client  # noqa: E402

BUCKET = os.environ.get("RECEIPTS_BUCKET", "receipts")


def main() -> int:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)

    print(f"→ Supabase URL: {url}")

    # 1. tables / seed
    expectations = {
        "employees": 1,
        "categories": 11,
        "claims": 3,
        "claim_lines": 15,
    }
    for table, expected in expectations.items():
        res = client.table(table).select("*", count="exact").limit(1).execute()
        got = res.count or 0
        ok = "✅" if got >= expected else "❌"
        print(f"  {ok} {table}: {got} rows (expected ≥ {expected})")
        if got < expected:
            print(f"     → Run /app/backend/sql/001_schema.sql then 002_seed.sql in the Supabase SQL Editor.")
            return 1

    # 2. storage bucket
    buckets = client.storage.list_buckets()
    names = {b.name if hasattr(b, "name") else b.get("name") for b in buckets}
    if BUCKET in names:
        print(f"  ✅ bucket '{BUCKET}' exists")
    else:
        print(f"  ⏳ creating private bucket '{BUCKET}'...")
        client.storage.create_bucket(BUCKET, options={"public": False})
        print(f"  ✅ bucket '{BUCKET}' created (private)")

    print("\nPhase 1 verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

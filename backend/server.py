"""SME Expense Claims — FastAPI server.
MINIMAL BOOT: only /health and / are active.
Routers are commented out while diagnosing Azure 504 hang.
"""
from __future__ import annotations

import logging
import os

print(">>> server.py: importing FastAPI", flush=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

# ── Routers disabled — diagnosing which import causes hang ───────────────
# from routers import me, categories, claims, lines, ai
# ─────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

print(">>> server.py: creating FastAPI app", flush=True)

app = FastAPI(title="Expense Claims API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers disabled — diagnosing which import causes hang ───────────────
# app.include_router(me.router, prefix="/api")
# app.include_router(categories.router, prefix="/api")
# app.include_router(claims.router, prefix="/api")
# app.include_router(lines.router, prefix="/api")
# app.include_router(ai.router, prefix="/api")
# ─────────────────────────────────────────────────────────────────────────

# ── Inline diagnostic routes (no router file imports) ────────────────────

print(">>> server.py: registering diagnostic routes", flush=True)


@app.get("/api/diag/ping")
def diag_ping() -> dict:
    """Step 1: pure FastAPI, no imports beyond what's already loaded."""
    return {"status": "ok", "step": "ping"}


@app.get("/api/diag/import-models")
def diag_import_models() -> dict:
    """Step 2: import models.py (pure Pydantic, no network)."""
    print(">>> diag: importing models", flush=True)
    import models  # noqa: F401
    print(">>> diag: models OK", flush=True)
    return {"status": "ok", "step": "import-models"}


@app.get("/api/diag/import-supabase-pkg")
def diag_import_supabase_pkg() -> dict:
    """Step 3: import the supabase package itself (no connection yet)."""
    print(">>> diag: importing supabase package", flush=True)
    import supabase  # noqa: F401
    print(">>> diag: supabase package OK", flush=True)
    return {"status": "ok", "step": "import-supabase-pkg"}


@app.get("/api/diag/import-supabase-client")
def diag_import_supabase_client() -> dict:
    """Step 4: import our supabase_client module (no connection yet)."""
    print(">>> diag: importing services.supabase_client", flush=True)
    from services import supabase_client  # noqa: F401
    print(">>> diag: services.supabase_client OK", flush=True)
    return {"status": "ok", "step": "import-supabase-client"}


@app.get("/api/diag/env-check")
def diag_env_check() -> dict:
    """Check env vars are present (values hidden)."""
    import os
    return {
        "SUPABASE_URL": "SET" if os.getenv("SUPABASE_URL") else "MISSING",
        "SUPABASE_SERVICE_ROLE_KEY": "SET" if os.getenv("SUPABASE_SERVICE_ROLE_KEY") else "MISSING",
        "ANTHROPIC_API_KEY": "SET" if os.getenv("ANTHROPIC_API_KEY") else "MISSING",
        "OPENAI_API_KEY": "SET" if os.getenv("OPENAI_API_KEY") else "MISSING",
    }


@app.get("/api/diag/connect-supabase")
def diag_connect_supabase() -> dict:
    """Step 5: call get_supabase() — creates the client (needs env vars)."""
    import os
    print(f">>> diag: SUPABASE_URL set={bool(os.getenv('SUPABASE_URL'))}", flush=True)
    print(f">>> diag: SUPABASE_SERVICE_ROLE_KEY set={bool(os.getenv('SUPABASE_SERVICE_ROLE_KEY'))}", flush=True)
    try:
        from services.supabase_client import get_supabase
        print(">>> diag: calling get_supabase()", flush=True)
        client = get_supabase()
        print(f">>> diag: get_supabase() OK type={type(client).__name__}", flush=True)
        return {"status": "ok", "step": "connect-supabase"}
    except Exception as exc:
        msg = str(exc)[:500]
        print(f">>> diag: get_supabase() FAILED: {msg}", flush=True)
        return {"status": "error", "step": "connect-supabase", "error": msg}


@app.get("/api/diag/import-me-router")
def diag_import_me_router() -> dict:
    """Step 6: import routers/me.py (imports models + supabase_client)."""
    print(">>> diag: importing routers.me", flush=True)
    from routers import me  # noqa: F401
    print(">>> diag: routers.me OK", flush=True)
    return {"status": "ok", "step": "import-me-router"}

# ─────────────────────────────────────────────────────────────────────────

print(">>> server.py: app created, registering routes", flush=True)


@app.on_event("startup")
async def on_startup() -> None:
    port = os.getenv("PORT", "8000")
    logger.info("=== Expense Claims API starting on PORT=%s ===", port)
    print(f">>> on_startup: PORT={port}", flush=True)


@app.get("/")
def root() -> dict:
    return {"message": "Expense Claims API running"}


@app.get("/health")
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


print(">>> server.py: module load complete", flush=True)

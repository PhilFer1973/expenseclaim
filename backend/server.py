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

# ── Routers disabled for minimal boot diagnostic ──────────────────────────
# from dotenv import load_dotenv
# from pathlib import Path
# load_dotenv(Path(__file__).parent / ".env")
# from routers import ai, categories, claims, lines, me
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

# ── Routers disabled for minimal boot diagnostic ──────────────────────────
# app.include_router(me.router, prefix="/api")
# app.include_router(categories.router, prefix="/api")
# app.include_router(claims.router, prefix="/api")
# app.include_router(lines.router, prefix="/api")
# app.include_router(ai.router, prefix="/api")
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

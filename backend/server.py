"""SME Expense Claims — FastAPI server.
All routes under /api per ingress config.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

print(">>> server.py: importing FastAPI", flush=True)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

print(">>> server.py: importing routers", flush=True)

from routers import ai, categories, claims, lines, me  # noqa: E402

print(">>> server.py: routers imported OK", flush=True)

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

app.include_router(me.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(claims.router, prefix="/api")
app.include_router(lines.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


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

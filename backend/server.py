"""SME Expense Claims — FastAPI server.
All routes under /api per ingress config.
"""
from __future__ import annotations

import logging
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from routers import ai, categories, claims, lines, me  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

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


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}

"""Supabase service-role client.

Backend-only. Service-role key never ships to the device.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from supabase import Client, create_client

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL environment variable is not set")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY environment variable is not set")
    logger.info("Connecting to Supabase at %s", url)
    return create_client(url, key)

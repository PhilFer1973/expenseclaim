"""Supabase service-role client.

Backend-only. Service-role key never ships to the device.
Realtime is disabled — we only use PostgREST (table queries) and Storage.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

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
    options = ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    )
    return create_client(url, key, options=options)

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://world-cup-2026-live-api.p.rapidapi.com"


def _headers() -> dict:
    if not settings.RAPIDAPI_KEY:
        return {}
    return {
        "x-rapidapi-key": settings.RAPIDAPI_KEY,
        "x-rapidapi-host": "world-cup-2026-live-api.p.rapidapi.com",
    }


async def fetch_draw() -> list[dict]:
    if not settings.RAPIDAPI_KEY:
        logger.warning("RAPIDAPI_KEY not set — skipping fetch_draw")
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{BASE_URL}/wc/draw", headers=_headers())
            resp.raise_for_status()
            data = resp.json().get("data", [])
            logger.info("fetch_draw: %d matches fetched", len(data))
            return data
    except httpx.HTTPError as exc:
        logger.error("fetch_draw HTTP error: %s", exc)
        return []
    except Exception as exc:
        logger.error("fetch_draw unexpected error: %s", exc)
        return []


async def fetch_live() -> list[dict]:
    if not settings.RAPIDAPI_KEY:
        logger.warning("RAPIDAPI_KEY not set — skipping fetch_live")
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{BASE_URL}/wc/live", headers=_headers())
            resp.raise_for_status()
            data = resp.json().get("data", [])
            logger.info("fetch_live: %d live matches", len(data))
            return data
    except httpx.HTTPError as exc:
        logger.error("fetch_live HTTP error: %s", exc)
        return []
    except Exception as exc:
        logger.error("fetch_live unexpected error: %s", exc)
        return []


async def fetch_standings() -> list[dict]:
    if not settings.RAPIDAPI_KEY:
        logger.warning("RAPIDAPI_KEY not set — skipping fetch_standings")
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{BASE_URL}/wc/standings", headers=_headers())
            resp.raise_for_status()
            data = resp.json().get("data", [])
            logger.info("fetch_standings: %d groups fetched", len(data))
            return data
    except httpx.HTTPError as exc:
        logger.error("fetch_standings HTTP error: %s", exc)
        return []
    except Exception as exc:
        logger.error("fetch_standings unexpected error: %s", exc)
        return []

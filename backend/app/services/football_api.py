import logging

logger = logging.getLogger(__name__)


async def fetch_draw() -> list[dict]:
    logger.info("fetch_draw: API sync disabled — returning empty list")
    return []


async def fetch_live() -> list[dict]:
    logger.info("fetch_live: API sync disabled — returning empty list")
    return []


async def fetch_standings() -> list[dict]:
    logger.info("fetch_standings: API sync disabled — returning empty list")
    return []

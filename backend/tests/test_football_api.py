import pytest


# ── Stubbed football_api — all functions return empty lists ───────────────────

@pytest.mark.asyncio
async def test_fetch_draw_returns_empty():
    from app.services.football_api import fetch_draw
    result = await fetch_draw()
    assert result == []


@pytest.mark.asyncio
async def test_fetch_live_returns_empty():
    from app.services.football_api import fetch_live
    result = await fetch_live()
    assert result == []


@pytest.mark.asyncio
async def test_fetch_standings_returns_empty():
    from app.services.football_api import fetch_standings
    result = await fetch_standings()
    assert result == []

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import settings


def make_response(status_code: int, json_data: dict):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    return resp


# ── fetch_draw ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_draw_returns_data_on_success():
    from app.services.football_api import fetch_draw

    mock_data = [
        {"matchId": "abc", "home": "Mexico", "away": "South Africa",
         "status": 1, "scoreHome": None, "scoreAway": None,
         "kickoff": "2026-06-11T19:00:00Z", "round": "Round 1", "minute": None}
    ]
    mock_resp = make_response(200, {"success": True, "data": mock_data})

    with patch("app.services.football_api.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.RAPIDAPI_KEY = "testkey"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value = mock_client

        result = await fetch_draw()

    assert len(result) == 1
    assert result[0]["home"] == "Mexico"


@pytest.mark.asyncio
async def test_fetch_draw_returns_empty_when_no_key():
    from app.services.football_api import fetch_draw

    with patch("app.services.football_api.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.RAPIDAPI_KEY = ""
        result = await fetch_draw()

    assert result == []
    mock_client_cls.assert_not_called()


@pytest.mark.asyncio
async def test_fetch_draw_returns_empty_on_http_error():
    from app.services.football_api import fetch_draw

    with patch("app.services.football_api.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.RAPIDAPI_KEY = "testkey"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError("error", request=MagicMock(), response=MagicMock())
        )
        mock_client_cls.return_value = mock_client

        result = await fetch_draw()

    assert result == []


@pytest.mark.asyncio
async def test_fetch_draw_returns_empty_on_network_error():
    from app.services.football_api import fetch_draw

    with patch("app.services.football_api.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.RAPIDAPI_KEY = "testkey"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(
            side_effect=httpx.ConnectError("connection refused")
        )
        mock_client_cls.return_value = mock_client

        result = await fetch_draw()

    assert result == []


# ── fetch_live ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_live_returns_empty_list_when_no_matches():
    from app.services.football_api import fetch_live

    mock_resp = make_response(200, {"success": True, "count": 0, "data": []})

    with patch("app.services.football_api.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.RAPIDAPI_KEY = "testkey"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value = mock_client

        result = await fetch_live()

    assert result == []


@pytest.mark.asyncio
async def test_fetch_live_returns_live_matches():
    from app.services.football_api import fetch_live

    live_match = {
        "matchId": "live1", "home": "Brazil", "away": "Germany",
        "status": 2, "scoreHome": 1, "scoreAway": 0, "minute": "67",
        "kickoff": "2026-06-20T19:00:00Z", "round": "Round 2"
    }
    mock_resp = make_response(200, {"success": True, "count": 1, "data": [live_match]})

    with patch("app.services.football_api.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.RAPIDAPI_KEY = "testkey"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value = mock_client

        result = await fetch_live()

    assert len(result) == 1
    assert result[0]["minute"] == "67"


# ── fetch_standings ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_standings_returns_groups():
    from app.services.football_api import fetch_standings

    def make_group(name, n=4):
        return {
            "group": name,
            "groupId": "abc",
            "teams": [
                {"position": i+1, "name": f"Team{i}", "teamId": str(i),
                 "played": 0, "won": 0, "drawn": 0, "lost": 0,
                 "goals": "0:0", "points": 0, "status": None}
                for i in range(n)
            ]
        }

    mock_resp = make_response(200, {
        "success": True,
        "data": [make_group("Group A"), make_group("Group B")]
    })

    with patch("app.services.football_api.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.RAPIDAPI_KEY = "testkey"
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value = mock_client

        result = await fetch_standings()

    assert len(result) == 2
    assert result[0]["group"] == "Group A"

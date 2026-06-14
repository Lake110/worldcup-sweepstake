import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.security import hash_password
from app.models.user import User


def unique_email():
    return f"user_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture
def admin_headers(client, db):
    email = unique_email()
    admin = User(
        email=email,
        hashed_password=hash_password("password123"),
        full_name="Test Admin",
        is_admin=True,
    )
    db.add(admin)
    db.commit()

    res = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user_headers(client):
    email = unique_email()
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": "Regular User"},
    )
    res = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Sync run/standings endpoints removed ─────────────────────────────────────

def test_sync_run_endpoint_removed(client):
    res = client.post("/api/sync/run")
    assert res.status_code == 404


def test_sync_standings_endpoint_removed(client):
    res = client.post("/api/sync/standings")
    assert res.status_code == 404


# ── Sync status endpoint ──────────────────────────────────────────────────────

def test_sync_status_returns_disabled(client):
    res = client.get("/api/sync/status")
    assert res.status_code == 200
    data = res.json()
    assert data.get("disabled") is True


# ── Live endpoint ─────────────────────────────────────────────────────────────

def test_live_endpoint_returns_empty_list(client):
    res = client.get("/api/matches/live")
    assert res.status_code == 200
    assert res.json() == []


def test_live_endpoint_returns_mapped_data(client):
    import app.api.routes.matches as matches_mod
    matches_mod._live_cache["cached_at"] = None  # clear cache

    live_item = {
        "home": "Brazil",
        "away": "Germany",
        "status": 2,
        "scoreHome": 1,
        "scoreAway": 0,
        "minute": "34",
        "matchId": "test123",
        "kickoff": "2026-06-20T19:00:00Z",
        "round": "Round 2",
    }
    with patch(
        "app.services.football_api.fetch_live",
        new_callable=AsyncMock,
        return_value=[live_item],
    ):
        res = client.get("/api/matches/live")

    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["home_team"] == "Brazil"
    assert data[0]["minute"] == "34"


def test_live_endpoint_caches_response(client):
    import app.api.routes.matches as matches_mod
    matches_mod._live_cache["cached_at"] = None  # clear cache

    live_item = {
        "home": "Spain",
        "away": "France",
        "status": 2,
        "scoreHome": 0,
        "scoreAway": 0,
        "minute": "10",
        "matchId": "xyz",
        "kickoff": "2026-06-20T19:00:00Z",
        "round": "Round 2",
    }
    with patch(
        "app.services.football_api.fetch_live",
        new_callable=AsyncMock,
        return_value=[live_item],
    ) as mock_fetch:
        client.get("/api/matches/live")
        client.get("/api/matches/live")

    mock_fetch.assert_called_once()


# ── Standings source param ────────────────────────────────────────────────────

def test_standings_source_api_requires_admin(client, user_headers):
    res = client.get("/api/standings/?source=api", headers=user_headers)
    assert res.status_code in (401, 403)


def test_standings_source_api_requires_auth_no_token(client):
    res = client.get("/api/standings/?source=api")
    assert res.status_code in (401, 403)


def test_standings_source_api_returns_raw_data(client, admin_headers):
    mock_data = [
        {
            "group": "Group A",
            "groupId": "abc",
            "teams": [
                {"name": "Mexico", "position": 1, "played": 0, "won": 0,
                 "drawn": 0, "lost": 0, "goals": "0:0", "points": 0}
            ],
        }
    ]
    with patch(
        "app.services.football_api.fetch_standings",
        new_callable=AsyncMock,
        return_value=mock_data,
    ):
        res = client.get("/api/standings/?source=api", headers=admin_headers)

    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert "group" in data[0]
    assert "teams" in data[0]


def test_standings_default_returns_db_data(client):
    res = client.get("/api/standings/")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert "played" in data[0]
        assert "points" in data[0]
        assert "team" in data[0]

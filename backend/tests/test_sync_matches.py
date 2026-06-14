import pytest

from app.services.sync_matches import normalise, parse_goals


# ── normalise ─────────────────────────────────────────────────────────────────

def test_normalise_maps_known_names():
    assert normalise("Bosnia & Herzegovina") == "Bosnia Herzegovina"
    assert normalise("D.R. Congo") == "DR Congo"
    assert normalise("Ivory Coast") == "Ivory Coast"


def test_normalise_passthrough_for_unknown():
    assert normalise("Brazil") == "Brazil"
    assert normalise("England") == "England"


# ── parse_goals ───────────────────────────────────────────────────────────────

def test_parse_goals_valid_string():
    assert parse_goals("2:1") == (2, 1)
    assert parse_goals("0:0") == (0, 0)
    assert parse_goals("3:2") == (3, 2)


def test_parse_goals_invalid_returns_zero_zero():
    assert parse_goals("") == (0, 0)
    assert parse_goals("invalid") == (0, 0)
    assert parse_goals(None) == (0, 0)


# ── sync_results (stubbed) ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_results_disabled():
    from app.services.sync_matches import sync_results
    result = await sync_results()
    assert result["disabled"] is True
    assert result["updated"] == []
    assert result["skipped"] == []
    assert result["errors"] == []
    assert result["total_finished"] == 0


# ── sync_standings (stubbed) ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_standings_disabled():
    from app.services.sync_matches import sync_standings
    result = await sync_standings()
    assert result["disabled"] is True
    assert result["groups_updated"] == 0
    assert result["teams_updated"] == 0
    assert result["errors"] == []

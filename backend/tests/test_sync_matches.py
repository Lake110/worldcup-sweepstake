import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

from app.services.sync_matches import normalise, parse_goals


# ── normalise ─────────────────────────────────────────────────────────────────

def test_normalise_maps_known_names():
    assert normalise("Bosnia & Herzegovina") == "Bosnia and Herzegovina"
    assert normalise("D.R. Congo") == "DR Congo"
    assert normalise("Ivory Coast") == "Côte d'Ivoire"


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


# ── sync_results ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_results_skips_unfinished_matches():
    with patch("app.services.sync_matches.fetch_draw", new_callable=AsyncMock) as mock_draw, \
         patch("app.services.sync_matches.SessionLocal") as mock_session_cls:
        mock_draw.return_value = [
            {"home": "Mexico", "away": "South Africa", "status": 1,
             "scoreHome": None, "scoreAway": None},
            {"home": "Brazil", "away": "Germany", "status": 2,
             "scoreHome": 1, "scoreAway": 0},
        ]
        mock_db = MagicMock()
        mock_session_cls.return_value = mock_db

        from app.services.sync_matches import sync_results
        result = await sync_results()

    assert result["updated"] == []
    assert result["skipped"] == []
    assert result["total_finished"] == 0
    mock_db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_sync_results_updates_finished_match():
    mock_match = MagicMock()
    mock_match.home_score = None
    mock_match.away_score = None
    mock_match.group_id = MagicMock()

    with patch("app.services.sync_matches.fetch_draw", new_callable=AsyncMock) as mock_draw, \
         patch("app.services.sync_matches.SessionLocal") as mock_session_cls, \
         patch("app.services.sync_matches.find_match", return_value=mock_match) as mock_find, \
         patch("app.api.routes.matches._recalculate_standings") as mock_recalc:
        mock_draw.return_value = [
            {"home": "Mexico", "away": "South Africa", "status": 3,
             "scoreHome": 2, "scoreAway": 1,
             "kickoff": "2026-06-11T19:00:00Z", "round": "Round 1", "minute": None}
        ]
        mock_db = MagicMock()
        mock_session_cls.return_value = mock_db

        from app.services.sync_matches import sync_results
        result = await sync_results()

    assert mock_match.home_score == 2
    assert mock_match.away_score == 1
    assert mock_match.is_completed is True
    mock_db.commit.assert_called()
    mock_recalc.assert_called_once()
    assert len(result["updated"]) == 1


@pytest.mark.asyncio
async def test_sync_results_skips_already_correct_score():
    mock_match = MagicMock()
    mock_match.home_score = 2
    mock_match.away_score = 1

    with patch("app.services.sync_matches.fetch_draw", new_callable=AsyncMock) as mock_draw, \
         patch("app.services.sync_matches.SessionLocal") as mock_session_cls, \
         patch("app.services.sync_matches.find_match", return_value=mock_match):
        mock_draw.return_value = [
            {"home": "Mexico", "away": "South Africa", "status": 3,
             "scoreHome": 2, "scoreAway": 1}
        ]
        mock_db = MagicMock()
        mock_session_cls.return_value = mock_db

        from app.services.sync_matches import sync_results
        result = await sync_results()

    mock_db.commit.assert_not_called()
    assert len(result["skipped"]) == 1
    assert result["updated"] == []


@pytest.mark.asyncio
async def test_sync_results_records_error_when_match_not_found():
    with patch("app.services.sync_matches.fetch_draw", new_callable=AsyncMock) as mock_draw, \
         patch("app.services.sync_matches.SessionLocal") as mock_session_cls, \
         patch("app.services.sync_matches.find_match", return_value=None):
        mock_draw.return_value = [
            {"home": "Mexico", "away": "South Africa", "status": 3,
             "scoreHome": 2, "scoreAway": 1}
        ]
        mock_db = MagicMock()
        mock_session_cls.return_value = mock_db

        from app.services.sync_matches import sync_results
        result = await sync_results()

    assert len(result["errors"]) == 1
    assert result["updated"] == []


@pytest.mark.asyncio
async def test_sync_results_handles_name_normalisation():
    find_calls = []

    async def _fake_sync():
        from app.services.sync_matches import sync_results
        return await sync_results()

    with patch("app.services.sync_matches.fetch_draw", new_callable=AsyncMock) as mock_draw, \
         patch("app.services.sync_matches.SessionLocal") as mock_session_cls, \
         patch("app.services.sync_matches.find_match", side_effect=lambda db, h, a: find_calls.append((h, a)) or None):
        mock_draw.return_value = [
            {"home": "Bosnia & Herzegovina", "away": "South Africa", "status": 3,
             "scoreHome": 1, "scoreAway": 0}
        ]
        mock_db = MagicMock()
        mock_session_cls.return_value = mock_db

        from app.services.sync_matches import sync_results
        await sync_results()

    assert len(find_calls) == 1
    home_arg = find_calls[0][0]
    # "Bosnia & Herzegovina" normalises to "Bosnia and Herzegovina"
    assert home_arg == "Bosnia and Herzegovina"


# ── sync_standings ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_standings_parses_goals_and_updates_standing():
    mock_team = MagicMock()
    mock_team.id = "team-uuid"
    mock_standing = MagicMock()
    mock_db = MagicMock()

    def fake_query(model):
        q = MagicMock()
        if model.__name__ == "Team":
            q.filter.return_value.first.return_value = mock_team
        else:
            q.filter.return_value.first.return_value = mock_standing
        return q

    mock_db.query.side_effect = fake_query

    with patch("app.services.sync_matches.fetch_standings", new_callable=AsyncMock) as mock_fs, \
         patch("app.services.sync_matches.SessionLocal", return_value=mock_db):
        mock_fs.return_value = [{
            "group": "Group A",
            "teams": [{
                "name": "Mexico", "played": 1, "won": 1, "drawn": 0, "lost": 0,
                "goals": "2:1", "points": 3, "position": 1, "status": "q1"
            }]
        }]

        from app.services.sync_matches import sync_standings
        result = await sync_standings()

    assert mock_standing.goals_for == 2
    assert mock_standing.goals_against == 1
    assert mock_standing.points == 3
    assert mock_standing.wins == 1


@pytest.mark.asyncio
async def test_sync_standings_skips_third_place_ranking_group():
    mock_db = MagicMock()

    with patch("app.services.sync_matches.fetch_standings", new_callable=AsyncMock) as mock_fs, \
         patch("app.services.sync_matches.SessionLocal", return_value=mock_db):
        mock_fs.return_value = [{
            "group": "Ranking of third-placed teams",
            "teams": [{"name": "Brazil", "played": 3, "won": 2, "drawn": 0, "lost": 1,
                       "goals": "5:2", "points": 6}]
        }]

        from app.services.sync_matches import sync_standings
        await sync_standings()

    mock_db.commit.assert_not_called()

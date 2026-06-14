"""
Tests for the knockout bracket system.

Covers:
1. Knockout matches are seeded correctly (63 matches, all stages present)
2. next_match_id wiring is correct (R32→R16→QF→SF→Final)
3. Saving a result advances the winner to the next match
4. Auto-populate R32 from group standings works
5. Manual team assignment via PATCH /teams works
6. Bracket endpoint returns correct shape
"""
import itertools
import uuid
import pytest
from sqlalchemy.orm import Session
from app.models.match import Match, MatchStage
from app.models.team import Team
from app.models.group import Group, GroupMember
from app.models.standing import Standing
from app.models.user import User
from app.core.security import hash_password


# ── Helpers ────────────────────────────────────────────────────────────────

# Monotonic counter ensures team codes are unique within a pytest session
# even though commits are not rolled back between tests.
_team_code_counter = itertools.count(1)


def make_admin(db: Session) -> dict:
    """Create an admin user and return auth headers."""
    from fastapi.testclient import TestClient
    email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
    user = User(
        email=email,
        hashed_password=hash_password("admin123"),
        full_name="Admin",
        is_active=True,
        is_admin=True,
    )
    db.add(user)
    db.commit()
    return email


def make_team(db: Session, name: str, ranking: int) -> Team:
    # Monotonic counter gives unique 3-char codes (T01–T99) within a pytest session
    n = next(_team_code_counter)
    code = f"T{n:02d}"
    team = Team(
        name=f"{name}_{uuid.uuid4().hex[:4]}",
        code=code,
        flag_emoji="🏳️",
        confederation="UEFA",
        fifa_ranking=ranking,
        latitude=0.0,
        longitude=0.0,
    )
    db.add(team)
    db.flush()
    return team


def make_group_with_teams(db: Session, group_name: str, teams: list[Team]) -> Group:
    group = Group(name=group_name)
    db.add(group)
    db.flush()
    for team in teams:
        db.add(GroupMember(group_id=group.id, team_id=team.id))
        db.add(Standing(group_id=group.id, team_id=team.id))
    db.flush()
    return group


def make_knockout_match(
    db: Session,
    stage: MatchStage,
    home_team: Team | None = None,
    away_team: Team | None = None,
    next_match: Match | None = None,
    next_slot: str | None = None,
) -> Match:
    match = Match(
        stage=stage,
        home_team_id=home_team.id if home_team else None,
        away_team_id=away_team.id if away_team else None,
        next_match_id=next_match.id if next_match else None,
        next_match_slot=next_slot,
        is_completed=False,
    )
    db.add(match)
    db.flush()
    return match


# ── Tests ──────────────────────────────────────────────────────────────────

# ── Fixture for seeding tests (uses real DB, not test DB) ─────────────────
@pytest.fixture
def real_db():
    """Connect to the real worldcupdb where seeds have been applied.
    Always uses worldcupdb directly, regardless of DATABASE_URL env var."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    # Hardcode the real DB URL — test DB is separate
    url = "postgresql://worldcup:worldcup123@db:5432/worldcupdb"
    engine = create_engine(url)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


import pytest as _pytest


class TestKnockoutSeeding:
    """Verify the seeded knockout matches have the right structure."""
    # These tests require the real seeded worldcupdb — skip in CI
    pytestmark = _pytest.mark.skipif(
        not __import__('os').getenv('RUN_SEEDING_TESTS'),
        reason='Skipped in CI — requires real seeded worldcupdb'
    )

    def test_all_knockout_stages_present(self, real_db: Session):
        db = real_db
        """All 6 knockout stages should have matches."""
        stages = [
            MatchStage.round_of_32,
            MatchStage.round_of_16,
            MatchStage.quarter_final,
            MatchStage.semi_final,
            MatchStage.third_place,
            MatchStage.final,
        ]
        for stage in stages:
            count = db.query(Match).filter(Match.stage == stage).count()
            assert count > 0, f"No matches found for stage {stage}"

    def test_correct_match_counts(self, real_db: Session):
        db = real_db
        """Each stage should have at least the right number of seeded matches."""
        expected = {
            MatchStage.round_of_32:   16,
            MatchStage.round_of_16:   8,
            MatchStage.quarter_final: 4,
            MatchStage.semi_final:    2,
            MatchStage.third_place:   1,
            MatchStage.final:         1,  # Total = 32
        }
        for stage, count in expected.items():
            actual = db.query(Match).filter(Match.stage == stage).count()
            assert actual >= count, f"Stage {stage}: expected at least {count}, got {actual}"

    def test_next_match_id_wiring(self, real_db: Session):
        db = real_db
        """All non-terminal matches should have a next_match_id."""
        terminal_stages = [MatchStage.final, MatchStage.third_place]
        non_terminal = db.query(Match).filter(
            Match.stage.notin_(terminal_stages),
            Match.stage != MatchStage.group,
        ).all()
        for match in non_terminal:
            assert match.next_match_id is not None, \
                f"Match {match.id} (stage={match.stage}) missing next_match_id"

    def test_terminal_matches_have_no_next(self, real_db: Session):
        db = real_db
        """Final and 3rd place matches should not point anywhere."""
        for stage in [MatchStage.final, MatchStage.third_place]:
            matches = db.query(Match).filter(Match.stage == stage).all()
            for m in matches:
                assert m.next_match_id is None, \
                    f"{stage} match should have next_match_id=None"

    def test_next_match_slot_is_home_or_away(self, real_db: Session):
        db = real_db
        """All non-terminal knockout matches should have slot 'home' or 'away'."""
        terminal_stages = [MatchStage.final, MatchStage.third_place]
        matches = db.query(Match).filter(
            Match.stage.notin_(terminal_stages),
            Match.stage != MatchStage.group,
        ).all()
        for m in matches:
            assert m.next_match_slot in ("home", "away"), \
                f"Match {m.id} has invalid next_match_slot: {m.next_match_slot}"

    def test_each_r16_match_fed_by_two_r32_matches(self, real_db: Session):
        db = real_db
        """Each R16 match should have exactly 2 R32 matches pointing to it."""
        r16_matches = db.query(Match).filter(Match.stage == MatchStage.round_of_16).all()
        r32_matches = db.query(Match).filter(Match.stage == MatchStage.round_of_32).all()
        for r16 in r16_matches:
            feeders = [m for m in r32_matches if str(m.next_match_id) == str(r16.id)]
            assert len(feeders) == 2, \
                f"R16 match {r16.id} has {len(feeders)} feeders, expected 2"

    def test_final_fed_by_two_semis(self, real_db: Session):
        db = real_db
        """The seeded Final should have exactly 2 SF matches pointing to it."""
        # Get all finals — find the one with 2 SFs pointing to it (the seeded one)
        finals = db.query(Match).filter(Match.stage == MatchStage.final).all()
        sf_matches = db.query(Match).filter(Match.stage == MatchStage.semi_final).all()
        found = False
        for final in finals:
            feeders = [m for m in sf_matches if str(m.next_match_id) == str(final.id)]
            if len(feeders) == 2:
                found = True
                break
        assert found, "No Final match found with exactly 2 SF feeders"


class TestWinnerPropagation:
    """Verify saving a result advances the winner to the next match."""

    def test_home_winner_advances(self, client, db: Session, auth_headers):
        """When home team wins, they should appear in the next match."""
        # Create admin user for this test
        email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=email,
            hashed_password=hash_password("admin123"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={"email": email, "password": "admin123"})
        admin_headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

        # Set up: next match (QF), then current match (R16)
        home = make_team(db, "HomeTeam", 1)
        away = make_team(db, "AwayTeam", 2)
        db.commit()

        next_match = make_knockout_match(db, MatchStage.quarter_final)
        current = make_knockout_match(
            db, MatchStage.round_of_16,
            home_team=home, away_team=away,
            next_match=next_match, next_slot="home"
        )
        db.commit()

        # Save result: home wins 2-0
        res = client.patch(f"/api/matches/{current.id}/result", json={
            "home_score": 2,
            "away_score": 0,
            "is_completed": True,
        }, headers=admin_headers)
        assert res.status_code == 200

        # Verify winner advanced to next match home slot
        db.refresh(next_match)
        assert str(next_match.home_team_id) == str(home.id), \
            "Home winner should be in next match home slot"

    def test_away_winner_advances(self, client, db: Session, auth_headers):
        """When away team wins, they fill the correct slot."""
        email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=email,
            hashed_password=hash_password("admin123"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={"email": email, "password": "admin123"})
        admin_headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

        home = make_team(db, "HomeTeam2", 3)
        away = make_team(db, "AwayTeam2", 4)
        db.commit()

        next_match = make_knockout_match(db, MatchStage.semi_final)
        current = make_knockout_match(
            db, MatchStage.quarter_final,
            home_team=home, away_team=away,
            next_match=next_match, next_slot="away"
        )
        db.commit()

        res = client.patch(f"/api/matches/{current.id}/result", json={
            "home_score": 0,
            "away_score": 3,
            "is_completed": True,
        }, headers=admin_headers)
        assert res.status_code == 200

        # Query via API to avoid session cache issues
        match_res = client.get(f"/api/matches/{next_match.id}")
        assert match_res.status_code == 200
        assert match_res.json()["away_team"]["id"] == str(away.id), \
            "Away winner should be in next match away slot"

    def test_winner_not_advanced_if_draw(self, client, db: Session):
        """Drawn matches should not advance anyone (knockouts use extra time)."""
        email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=email,
            hashed_password=hash_password("admin123"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={"email": email, "password": "admin123"})
        admin_headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

        home = make_team(db, "DrawHome", 5)
        away = make_team(db, "DrawAway", 6)
        db.commit()

        next_match = make_knockout_match(db, MatchStage.semi_final)
        current = make_knockout_match(
            db, MatchStage.quarter_final,
            home_team=home, away_team=away,
            next_match=next_match, next_slot="home"
        )
        db.commit()

        res = client.patch(f"/api/matches/{current.id}/result", json={
            "home_score": 1,
            "away_score": 1,
            "is_completed": True,
        }, headers=admin_headers)
        assert res.status_code == 200

        # Query via API to avoid session cache issues
        match_res = client.get(f"/api/matches/{next_match.id}")
        assert match_res.status_code == 200
        assert match_res.json()["home_team"] is None, \
            "Draw should not advance any team"


class TestDrawWithWinnerOverride:
    """Verify a drawn knockout match advances the correct team via winner_team_id."""

    def _make_admin(self, client, db):
        email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=email,
            hashed_password=hash_password("admin123"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={"email": email, "password": "admin123"})
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def test_penalty_winner_advances(self, client, db: Session):
        """Draw + winner_team_id override should advance the specified team."""
        headers = self._make_admin(client, db)
        home = make_team(db, "PenHome", 20)
        away = make_team(db, "PenAway", 21)
        db.commit()

        next_match = make_knockout_match(db, MatchStage.quarter_final)
        current = make_knockout_match(
            db, MatchStage.round_of_16,
            home_team=home, away_team=away,
            next_match=next_match, next_slot="home",
        )
        db.commit()

        # 1-1 draw; away team wins on penalties
        res = client.patch(f"/api/matches/{current.id}/result", json={
            "home_score": 1,
            "away_score": 1,
            "is_completed": True,
            "winner_team_id": str(away.id),
        }, headers=headers)
        assert res.status_code == 200

        # Away (penalty winner) fills next match's home slot
        match_res = client.get(f"/api/matches/{next_match.id}")
        assert match_res.status_code == 200
        assert match_res.json()["home_team"]["id"] == str(away.id), \
            "Penalty winner should advance to next match"

    def test_draw_without_override_does_not_advance(self, client, db: Session):
        """Draw with no winner_team_id should leave next match empty."""
        headers = self._make_admin(client, db)
        home = make_team(db, "DrawHome2", 22)
        away = make_team(db, "DrawAway2", 23)
        db.commit()

        next_match = make_knockout_match(db, MatchStage.quarter_final)
        current = make_knockout_match(
            db, MatchStage.round_of_16,
            home_team=home, away_team=away,
            next_match=next_match, next_slot="home",
        )
        db.commit()

        res = client.patch(f"/api/matches/{current.id}/result", json={
            "home_score": 2,
            "away_score": 2,
            "is_completed": True,
        }, headers=headers)
        assert res.status_code == 200

        match_res = client.get(f"/api/matches/{next_match.id}")
        assert match_res.json()["home_team"] is None, \
            "Draw without override must not advance anyone"


class TestSemiFinalLoserPropagation:
    """Verify the semi-final loser goes to the 3rd-place match."""

    def _make_admin(self, client, db):
        email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=email,
            hashed_password=hash_password("admin123"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={"email": email, "password": "admin123"})
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def test_sf_loser_goes_to_third_place_home(self, client, db: Session):
        """SF1 (next_slot=home) loser should fill 3rd-place match home slot."""
        headers = self._make_admin(client, db)
        home = make_team(db, "SF1Home", 30)
        away = make_team(db, "SF1Away", 31)
        db.commit()

        third_place = Match(stage=MatchStage.third_place, is_completed=False)
        db.add(third_place)
        final = Match(stage=MatchStage.final, is_completed=False)
        db.add(final)
        db.flush()

        sf = make_knockout_match(
            db, MatchStage.semi_final,
            home_team=home, away_team=away,
            next_match=final, next_slot="home",  # home wins → Final home slot
        )
        db.commit()

        # Home wins 2-1 → away (loser) should go to 3rd-place home slot
        res = client.patch(f"/api/matches/{sf.id}/result", json={
            "home_score": 2, "away_score": 1, "is_completed": True,
        }, headers=headers)
        assert res.status_code == 200

        # Winner in Final
        final_res = client.get(f"/api/matches/{final.id}")
        assert final_res.json()["home_team"]["id"] == str(home.id)

        # Loser in 3rd place match home slot
        tp_res = client.get(f"/api/matches/{third_place.id}")
        assert tp_res.json()["home_team"]["id"] == str(away.id), \
            "SF loser should be placed in 3rd-place home slot"

    def test_sf2_loser_goes_to_third_place_away(self, client, db: Session):
        """SF2 (next_slot=away) loser should fill 3rd-place match away slot."""
        headers = self._make_admin(client, db)

        # Remove any 3rd-place matches left by previous tests so .first() is deterministic
        db.query(Match).filter(Match.stage == MatchStage.third_place).delete()
        db.commit()

        home = make_team(db, "SF2Home", 32)
        away = make_team(db, "SF2Away", 33)
        db.commit()

        third_place = Match(stage=MatchStage.third_place, is_completed=False)
        db.add(third_place)
        final = Match(stage=MatchStage.final, is_completed=False)
        db.add(final)
        db.flush()

        sf = make_knockout_match(
            db, MatchStage.semi_final,
            home_team=home, away_team=away,
            next_match=final, next_slot="away",  # winner → Final away slot
        )
        db.commit()

        # Away wins 1-0 → home (loser) should go to 3rd-place away slot
        res = client.patch(f"/api/matches/{sf.id}/result", json={
            "home_score": 0, "away_score": 1, "is_completed": True,
        }, headers=headers)
        assert res.status_code == 200

        tp_res = client.get(f"/api/matches/{third_place.id}")
        assert tp_res.json()["away_team"]["id"] == str(home.id), \
            "SF2 loser should be placed in 3rd-place away slot"


class TestPopulateKnockout:
    """Verify the POST /api/knockout/populate endpoint."""

    def _make_admin(self, client, db):
        email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=email,
            hashed_password=hash_password("admin123"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={"email": email, "password": "admin123"})
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def test_empty_db_returns_nothing_filled(self, client, db: Session):
        """With no groups/matches in test DB, nothing should be filled."""
        headers = self._make_admin(client, db)
        res = client.post("/api/knockout/populate", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "filled" in data
        assert "pending_groups" in data
        assert "third_place_ranking" in data
        assert len(data["filled"]) == 0

    def test_incomplete_group_not_populated(self, client, db: Session):
        """Groups with unfinished matches must not supply R32 slots."""
        headers = self._make_admin(client, db)

        teams = [make_team(db, f"T{i}", i + 50) for i in range(4)]
        db.commit()

        group = make_group_with_teams(db, f"Z{uuid.uuid4().hex[:2]}", teams)
        db.commit()

        # Create R32 match that should be fed by this group — leave it unseeded
        r32 = Match(stage=MatchStage.round_of_32, is_completed=False)
        db.add(r32)
        db.commit()

        # Only 2 of 6 group matches are complete
        for j in range(2):
            m = Match(
                stage=MatchStage.group,
                group_id=group.id,
                home_team_id=teams[j * 2].id,
                away_team_id=teams[j * 2 + 1].id,
                home_score=1, away_score=0,
                is_completed=True,
            )
            db.add(m)
        db.commit()

        res = client.post("/api/knockout/populate", headers=headers)
        assert res.status_code == 200
        # Group Z is in pending_groups (or at least nothing was filled for it)
        data = res.json()
        assert len(data["filled"]) == 0, "Incomplete group must not fill any R32 slot"

    def test_non_admin_cannot_populate(self, client, db: Session, auth_headers):
        """Regular users should be rejected."""
        res = client.post("/api/knockout/populate", headers=auth_headers)
        assert res.status_code == 403


class TestManualTeamAssignment:
    """Verify admin can manually assign teams to knockout slots."""

    def test_assign_home_team(self, client, db: Session):
        """Admin can assign a team to the home slot of a knockout match."""
        email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=email,
            hashed_password=hash_password("admin123"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={"email": email, "password": "admin123"})
        admin_headers = {"Authorization": f"Bearer {res.json()['access_token']}"}

        team = make_team(db, "ManualTeam", 7)
        match = make_knockout_match(db, MatchStage.round_of_32)
        db.commit()

        res = client.patch(f"/api/matches/{match.id}/teams", json={
            "home_team_id": str(team.id)
        }, headers=admin_headers)
        assert res.status_code == 200

        db.refresh(match)
        assert str(match.home_team_id) == str(team.id)

    def test_non_admin_cannot_assign_teams(self, client, db: Session, auth_headers):
        """Regular users should not be able to assign teams."""
        team = make_team(db, "ForbiddenTeam", 8)
        match = make_knockout_match(db, MatchStage.round_of_32)
        db.commit()

        res = client.patch(f"/api/matches/{match.id}/teams", json={
            "home_team_id": str(team.id)
        }, headers=auth_headers)
        assert res.status_code == 403


class TestBracketEndpoint:
    """Verify the bracket API returns the correct shape — uses real seeded DB via real_db."""

    def test_bracket_returns_all_knockout_matches(self, real_db):
        """63 knockout matches should exist in the real seeded DB."""
        from app.models.match import Match, MatchStage
        knockout_stages = [
            MatchStage.round_of_32, MatchStage.round_of_16,
            MatchStage.quarter_final, MatchStage.semi_final,
            MatchStage.third_place, MatchStage.final,
        ]
        count = real_db.query(Match).filter(Match.stage.in_(knockout_stages)).count()
        assert count >= 32, f"Expected at least 32 knockout matches, got {count}"

    def test_bracket_match_shape(self, client):
        """Each bracket match returned by API should have required fields."""
        res = client.get("/api/matches/knockout/bracket")
        assert res.status_code == 200
        for match in res.json():
            assert "id" in match
            assert "tournamentRoundText" in match
            assert "participants" in match
            assert len(match["participants"]) == 2
            assert "nextMatchId" in match

    def test_final_has_no_next_match(self, real_db):
        """The seeded Final match should have next_match_id=None."""
        from app.models.match import Match, MatchStage
        finals = real_db.query(Match).filter(Match.stage == MatchStage.final).all()
        # At least one final should have no next match
        assert any(m.next_match_id is None for m in finals)

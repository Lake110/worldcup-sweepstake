import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.match import Match, MatchStage
from app.models.standing import Standing
from app.models.team import Team
from app.services.football_api import fetch_draw, fetch_standings

logger = logging.getLogger(__name__)

TEAM_NAME_MAP: dict[str, str] = {
    "Bosnia & Herzegovina": "Bosnia Herzegovina",
    "D.R. Congo": "DR Congo",
}


def normalise(name: str) -> str:
    return TEAM_NAME_MAP.get(name, name)


def parse_goals(goals_str) -> tuple[int, int]:
    try:
        gf, ga = str(goals_str).split(":")
        return int(gf), int(ga)
    except Exception:
        logger.warning("parse_goals failed for: %r", goals_str)
        return (0, 0)


def find_match(db: Session, home: str, away: str) -> Optional[Match]:
    home_team = db.query(Team).filter(Team.name.ilike(home)).first()
    if not home_team:
        logger.warning("Team not found in DB: %r", home)
        return None
    away_team = db.query(Team).filter(Team.name.ilike(away)).first()
    if not away_team:
        logger.warning("Team not found in DB: %r", away)
        return None
    match = (
        db.query(Match)
        .filter(
            Match.home_team_id == home_team.id,
            Match.away_team_id == away_team.id,
            Match.stage == MatchStage.group,
        )
        .first()
    )
    if not match:
        logger.warning("Match not found in DB: %r vs %r", home, away)
        return None
    return match


async def sync_results() -> dict:
    from app.api.routes.matches import _recalculate_standings

    db: Session = SessionLocal()
    updated = []
    skipped = []
    errors = []
    try:
        draw = await fetch_draw()
        finished = [
            m for m in draw
            if m.get("status") == 3
            and m.get("scoreHome") is not None
            and m.get("scoreAway") is not None
        ]

        for item in finished:
            home_name = normalise(item["home"])
            away_name = normalise(item["away"])
            match = find_match(db, home_name, away_name)
            if not match:
                errors.append(f"{home_name} vs {away_name}: not found")
                continue

            new_home = item["scoreHome"]
            new_away = item["scoreAway"]

            if match.home_score == new_home and match.away_score == new_away:
                skipped.append(f"{home_name} vs {away_name}")
                continue

            match.home_score = new_home
            match.away_score = new_away
            match.is_completed = True
            db.commit()

            if match.group_id:
                _recalculate_standings(match.group_id, db)

            updated.append(f"{home_name} {new_home}-{new_away} {away_name}")

        return {
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "updated": updated,
            "skipped": skipped,
            "errors": errors,
            "total_finished": len(finished),
        }
    finally:
        db.close()


async def sync_standings() -> dict:
    db: Session = SessionLocal()
    groups_updated = 0
    teams_updated = 0
    errors = []
    try:
        groups_data = await fetch_standings()

        for group_data in groups_data:
            group_name = group_data.get("group", "")
            if "third-placed" in group_name.lower():
                continue

            for team_data in group_data.get("teams", []):
                team_name = normalise(team_data["name"])
                team = db.query(Team).filter(Team.name.ilike(team_name)).first()
                if not team:
                    errors.append(f"Team not found: {team_name}")
                    continue

                standing = (
                    db.query(Standing)
                    .filter(Standing.team_id == team.id)
                    .first()
                )
                if not standing:
                    errors.append(f"Standing not found for: {team_name}")
                    continue

                gf, ga = parse_goals(team_data.get("goals", "0:0"))
                standing.played = team_data.get("played", 0)
                standing.wins = team_data.get("won", 0)
                standing.draws = team_data.get("drawn", 0)
                standing.losses = team_data.get("lost", 0)
                standing.goals_for = gf
                standing.goals_against = ga
                standing.points = team_data.get("points", 0)
                teams_updated += 1

            db.commit()
            groups_updated += 1

        return {
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "groups_updated": groups_updated,
            "teams_updated": teams_updated,
            "errors": errors,
        }
    finally:
        db.close()

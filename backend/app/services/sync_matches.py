import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.match import Match, MatchStage
from app.models.team import Team

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
        return None
    away_team = db.query(Team).filter(Team.name.ilike(away)).first()
    if not away_team:
        return None
    return (
        db.query(Match)
        .filter(
            Match.home_team_id == home_team.id,
            Match.away_team_id == away_team.id,
            Match.stage == MatchStage.group,
        )
        .first()
    )


async def sync_results() -> dict:
    logger.info("sync_results: API sync disabled")
    return {
        "synced_at": None,
        "updated": [],
        "skipped": [],
        "errors": [],
        "total_finished": 0,
        "disabled": True,
    }


async def sync_standings() -> dict:
    logger.info("sync_standings: API sync disabled")
    return {
        "synced_at": None,
        "groups_updated": 0,
        "teams_updated": 0,
        "errors": [],
        "disabled": True,
    }

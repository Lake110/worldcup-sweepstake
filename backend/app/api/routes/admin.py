import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user
from app.db.database import get_db
from app.models.match import Match, MatchStage
from app.models.sweepstake import Participant, Sweepstake
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/reset-scores")
def reset_scores(
    db: Session = Depends(get_db),
    user: User = Depends(get_admin_user),
):
    from app.api.routes.matches import _recalculate_standings
    from app.models.group import Group

    sweepstake_count = db.query(Sweepstake).count()
    participant_count = db.query(Participant).count()
    logger.info(
        "reset-scores: sweepstakes=%d participants=%d — clearing all match scores",
        sweepstake_count,
        participant_count,
    )

    group_matches = (
        db.query(Match)
        .filter(Match.stage == MatchStage.group)
        .all()
    )
    for match in group_matches:
        match.home_score = None
        match.away_score = None
        match.is_completed = False

    db.commit()

    groups = db.query(Group).all()
    for group in groups:
        _recalculate_standings(group.id, db)

    logger.info("reset-scores: cleared %d group matches, recalculated %d groups", len(group_matches), len(groups))
    return {"matches_reset": len(group_matches)}

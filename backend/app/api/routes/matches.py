from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.database import get_db
from app.core.deps import get_current_user, get_admin_user
from app.models.user import User
from app.models.match import Match, MatchStage
from app.models.standing import Standing
from app.schemas.match import MatchCreate, MatchUpdate, MatchOut

router = APIRouter()


@router.get("/", response_model=list[MatchOut])
def list_matches(
    stage: str | None = None,
    group_id: str | None = None,
    db: Session = Depends(get_db)
):
    """
    List all matches, optionally filtered by stage or group_id.
    Added group_id filter so the admin page can load one group at a time.
    """
    query = db.query(Match)
    if stage:
        query = query.filter(Match.stage == stage)
    if group_id:
        query = query.filter(Match.group_id == group_id)
    return query.order_by(Match.match_date).all()


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: UUID, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(404, "Match not found")
    return match


@router.post("/", response_model=MatchOut, status_code=201)
def create_match(
    data: MatchCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    match = Match(**data.model_dump())
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.patch("/{match_id}/result", response_model=MatchOut)
def update_result(
    match_id: UUID,
    data: MatchUpdate,
    db: Session = Depends(get_db),
    # FIX: was get_current_user — now requires is_admin=True.
    # Any logged-in user could previously update match scores.
    user: User = Depends(get_admin_user)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(404, "Match not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(match, field, value)

    db.commit()
    db.refresh(match)

    # Recalculate standings whenever a group match result changes
    if match.group_id:
        _recalculate_standings(match.group_id, db)

    return match


def _recalculate_standings(group_id: UUID, db: Session):
    """
    Recalculate standings for every team in a group from scratch.

    Why from scratch instead of incrementing?
    If an admin corrects a score (e.g. 2-1 entered as 1-2 by mistake),
    incrementing would add the correction on top of the wrong values.
    Starting from zero and replaying all completed matches is always correct.

    This is the same approach used by real football data systems —
    standings are a derived view, not a ledger.
    """
    # Step 1: Reset all standings for this group to zero
    standings = db.query(Standing).filter(Standing.group_id == group_id).all()
    for s in standings:
        s.played       = 0
        s.wins         = 0
        s.draws        = 0
        s.losses       = 0
        s.goals_for    = 0
        s.goals_against = 0
        s.points       = 0

    # Step 2: Replay every completed match in this group
    completed = db.query(Match).filter(
        Match.group_id == group_id,
        Match.is_completed == True,
        Match.home_score != None,
        Match.away_score != None,
    ).all()

    # Build a lookup dict so we don't query inside the loop
    standing_map = {s.team_id: s for s in standings}

    for match in completed:
        home = standing_map.get(match.home_team_id)
        away = standing_map.get(match.away_team_id)

        if not home or not away:
            continue

        home.played += 1
        away.played += 1
        home.goals_for      += match.home_score
        home.goals_against  += match.away_score
        away.goals_for      += match.away_score
        away.goals_against  += match.home_score

        if match.home_score > match.away_score:
            home.wins   += 1; home.points += 3
            away.losses += 1
        elif match.home_score == match.away_score:
            home.draws  += 1; home.points += 1
            away.draws  += 1; away.points += 1
        else:
            away.wins   += 1; away.points += 3
            home.losses += 1

    db.commit()
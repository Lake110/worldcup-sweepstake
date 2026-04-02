from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.match import Match
from app.models.standing import Standing
from app.schemas.match import MatchCreate, MatchUpdate, MatchOut

router = APIRouter()

@router.get("/", response_model=list[MatchOut])
def list_matches(
    stage: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Match)
    if stage:
        query = query.filter(Match.stage == stage)
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
    user: User = Depends(get_current_user)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(404, "Match not found")

    # Update only fields that were sent
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(match, field, value)

    db.commit()
    db.refresh(match)

    # Recalculate standings if this is a group match
    if match.is_completed and match.group_id:
        _update_standings(match, db)

    return match

def _update_standings(match: Match, db: Session):
    """Recalculate standings for both teams after a result."""
    for team_id, goals_for, goals_against in [
        (match.home_team_id, match.home_score, match.away_score),
        (match.away_team_id, match.away_score, match.home_score),
    ]:
        standing = db.query(Standing).filter(
            Standing.team_id == team_id,
            Standing.group_id == match.group_id
        ).first()

        if not standing:
            continue

        standing.played += 1
        standing.goals_for += goals_for
        standing.goals_against += goals_against

        if goals_for > goals_against:
            standing.wins += 1
            standing.points += 3
        elif goals_for == goals_against:
            standing.draws += 1
            standing.points += 1
        else:
            standing.losses += 1

    db.commit()
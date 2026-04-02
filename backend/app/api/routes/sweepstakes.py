from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
import random
import string
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.team import Team
from app.models.sweepstake import Sweepstake, Participant, TeamAssignment
from app.schemas.sweepstake import SweepstakeCreate, SweepstakeOut, ParticipantOut

router = APIRouter()

def generate_invite_code(length: int = 6) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@router.post("/", response_model=SweepstakeOut, status_code=201)
def create_sweepstake(
    data: SweepstakeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    sweepstake = Sweepstake(
        **data.model_dump(),
        owner_id=user.id,
        invite_code=generate_invite_code()
    )
    db.add(sweepstake)
    db.commit()
    db.refresh(sweepstake)

    # Owner automatically joins as first participant
    participant = Participant(sweepstake_id=sweepstake.id, user_id=user.id)
    db.add(participant)
    db.commit()

    return sweepstake

@router.get("/", response_model=list[SweepstakeOut])
def list_sweepstakes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Return sweepstakes the user is part of
    return db.query(Sweepstake)\
             .join(Participant)\
             .filter(Participant.user_id == user.id)\
             .all()

@router.get("/{sweepstake_id}", response_model=SweepstakeOut)
def get_sweepstake(
    sweepstake_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    sweepstake = db.query(Sweepstake).filter(Sweepstake.id == sweepstake_id).first()
    if not sweepstake:
        raise HTTPException(404, "Sweepstake not found")
    return sweepstake

@router.post("/join/{invite_code}", response_model=SweepstakeOut)
def join_sweepstake(
    invite_code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    sweepstake = db.query(Sweepstake)\
                   .filter(Sweepstake.invite_code == invite_code)\
                   .first()
    if not sweepstake:
        raise HTTPException(404, "Invalid invite code")
    if sweepstake.is_locked:
        raise HTTPException(400, "Sweepstake is locked — draw already happened")

    # Check not already in it
    existing = db.query(Participant).filter(
        Participant.sweepstake_id == sweepstake.id,
        Participant.user_id == user.id
    ).first()
    if existing:
        raise HTTPException(400, "Already in this sweepstake")

    # Check not full
    count = db.query(Participant)\
              .filter(Participant.sweepstake_id == sweepstake.id)\
              .count()
    if count >= sweepstake.max_participants:
        raise HTTPException(400, "Sweepstake is full")

    participant = Participant(sweepstake_id=sweepstake.id, user_id=user.id)
    db.add(participant)
    db.commit()
    return sweepstake

@router.post("/{sweepstake_id}/draw", response_model=list[ParticipantOut])
def run_draw(
    sweepstake_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    sweepstake = db.query(Sweepstake).filter(Sweepstake.id == sweepstake_id).first()
    if not sweepstake:
        raise HTTPException(404, "Sweepstake not found")
    if sweepstake.owner_id != user.id:
        raise HTTPException(403, "Only the owner can run the draw")
    if sweepstake.is_locked:
        raise HTTPException(400, "Draw already completed")

    participants = db.query(Participant)\
                     .filter(Participant.sweepstake_id == sweepstake_id)\
                     .all()

    total_teams_needed = len(participants) * sweepstake.teams_per_person

    # Weighted random draw — lower FIFA ranking = stronger team = higher weight
    all_teams = db.query(Team).order_by(Team.fifa_ranking).all()
    if len(all_teams) < total_teams_needed:
        raise HTTPException(400, "Not enough teams in database")

    # Weight = inverse of ranking (rank 1 gets highest weight)
    max_rank = max(t.fifa_ranking for t in all_teams)
    weights = [max_rank - t.fifa_ranking + 1 for t in all_teams]

    selected_teams = random.choices(
        all_teams,
        weights=weights,
        k=total_teams_needed * 3  # oversample to handle duplicates
    )

    # Remove duplicates while preserving weighting effect
    seen = set()
    unique_teams = []
    for team in selected_teams:
        if team.id not in seen:
            seen.add(team.id)
            unique_teams.append(team)
        if len(unique_teams) == total_teams_needed:
            break

    if len(unique_teams) < total_teams_needed:
        raise HTTPException(400, "Could not select enough unique teams")

    # Shuffle and assign
    random.shuffle(unique_teams)
    for i, participant in enumerate(participants):
        start = i * sweepstake.teams_per_person
        end   = start + sweepstake.teams_per_person
        for team in unique_teams[start:end]:
            assignment = TeamAssignment(
                participant_id=participant.id,
                team_id=team.id
            )
            db.add(assignment)

    sweepstake.is_locked = True
    db.commit()

    return participants
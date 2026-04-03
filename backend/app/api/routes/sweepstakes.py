from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
import random
import string
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.team import Team
from app.models.sweepstake import Sweepstake, Participant, TeamAssignment
from app.schemas.sweepstake import SweepstakeCreate, SweepstakeOut, ParticipantOut
from app.models.standing import Standing

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

@router.get("/{sweepstake_id}/participants/", response_model=list[ParticipantOut])
def get_participants(
    sweepstake_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return db.query(Participant)\
             .options(joinedload(Participant.assignments).joinedload(TeamAssignment.team))\
             .filter(Participant.sweepstake_id == sweepstake_id)\
             .all()

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

    existing = db.query(Participant).filter(
        Participant.sweepstake_id == sweepstake.id,
        Participant.user_id == user.id
    ).first()
    if existing:
        raise HTTPException(400, "Already in this sweepstake")

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

    num_participants = len(participants)
    teams_per_person = sweepstake.teams_per_person
    total_needed     = num_participants * teams_per_person

    all_teams = db.query(Team).order_by(Team.fifa_ranking).all()
    if len(all_teams) < total_needed:
        raise HTTPException(400, "Not enough teams in database")

    # Build tiers based on teams_per_person
    # Slot 1 → top 10, Slot 2 → top 20, Slot 3 → top 30, Slot 4+ → rest
    def get_tier_limit(slot: int) -> int:
        return min(slot * 10, len(all_teams))

    # For each slot, pick one team per participant from that tier
    # ensuring no duplicates across all slots
    used_ids: set = set()
    # slots[slot_index] = list of teams, one per participant
    slots: list[list] = []

    for slot in range(teams_per_person):
        tier_limit  = get_tier_limit(slot + 1)
        tier_teams  = [t for t in all_teams[:tier_limit] if t.id not in used_ids]

        if len(tier_teams) < num_participants:
            # Not enough teams in this tier — fall back to remaining teams
            tier_teams = [t for t in all_teams if t.id not in used_ids]

        if len(tier_teams) < num_participants:
            raise HTTPException(400, f"Not enough teams for slot {slot + 1}")

        # Weight within the tier — better ranked = higher weight
        max_rank = max(t.fifa_ranking for t in tier_teams)
        weights  = [max_rank - t.fifa_ranking + 1 for t in tier_teams]

        # Oversample and deduplicate to pick exactly num_participants unique teams
        sampled  = random.choices(tier_teams, weights=weights, k=num_participants * 3)
        seen_this_slot: set = set()
        picked: list = []
        for team in sampled:
            if team.id not in seen_this_slot and team.id not in used_ids:
                seen_this_slot.add(team.id)
                picked.append(team)
            if len(picked) == num_participants:
                break

        # Fallback — if weighted sampling didn't get enough unique teams
        if len(picked) < num_participants:
            remaining = [t for t in tier_teams if t.id not in used_ids and t.id not in seen_this_slot]
            picked += remaining[:num_participants - len(picked)]

        if len(picked) < num_participants:
            raise HTTPException(400, f"Could not select enough unique teams for slot {slot + 1}")

        # Shuffle so participants don't always get the best team in the tier
        random.shuffle(picked)
        slots.append(picked)

        for t in picked:
            used_ids.add(t.id)

    # Assign teams — participant i gets slots[0][i], slots[1][i], slots[2][i] etc
    for i, participant in enumerate(participants):
        for slot in range(teams_per_person):
            db.add(TeamAssignment(
                participant_id=participant.id,
                team_id=slots[slot][i].id
            ))

    sweepstake.is_locked = True
    db.commit()

    return db.query(Participant)\
             .options(joinedload(Participant.assignments).joinedload(TeamAssignment.team))\
             .filter(Participant.sweepstake_id == sweepstake_id)\
             .all()

@router.get("/{sweepstake_id}/leaderboard/")
def leaderboard(
    sweepstake_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    sweepstake = db.query(Sweepstake).filter(Sweepstake.id == sweepstake_id).first()
    if not sweepstake:
        raise HTTPException(404, "Sweepstake not found")

    participants = db.query(Participant)\
                     .options(
                         joinedload(Participant.assignments).joinedload(TeamAssignment.team)
                     )\
                     .filter(Participant.sweepstake_id == sweepstake_id)\
                     .all()

    users = db.query(User).all()
    user_map = {str(u.id): u.full_name or u.email for u in users}

    results = []
    for p in participants:
        team_scores = []
        total_points = 0

        for assignment in p.assignments:
            team = assignment.team
            standing = db.query(Standing)\
                         .filter(Standing.team_id == team.id)\
                         .first()

            match_points = standing.points if standing else 0

            # Bonus points based on how far team progressed
            # For now 0 since tournament hasn't started
            bonus_points = 0

            team_total = match_points + bonus_points
            total_points += team_total

            team_scores.append({
                "team": {
                    "id": str(team.id),
                    "name": team.name,
                    "flag_emoji": team.flag_emoji,
                    "fifa_ranking": team.fifa_ranking,
                    "confederation": team.confederation,
                    "code": team.code,
                },
                "match_points": match_points,
                "bonus_points": bonus_points,
                "total": team_total,
            })

        results.append({
            "participant_id": str(p.id),
            "user_id": str(p.user_id),
            "user_name": user_map.get(str(p.user_id), "Unknown"),
            "teams": team_scores,
            "total_points": total_points,
        })

    # Sort by total points descending
    results.sort(key=lambda x: x["total_points"], reverse=True)

    # Add position
    for i, r in enumerate(results):
        r["position"] = i + 1

    return results
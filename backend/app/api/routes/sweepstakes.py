import random
import string
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.core.security import decode_token
from app.db.database import get_db
from app.models.match import Match, MatchStage
from app.models.standing import Standing
from app.models.sweepstake import Participant, Sweepstake, TeamAssignment
from app.models.team import Team
from app.models.user import User
from app.schemas.sweepstake import ParticipantOut, SweepstakeCreate, SweepstakeOut

router = APIRouter()

# Optional auth — returns the user if a valid token is present, None otherwise.
# Used on endpoints that are public but can personalise when logged in.
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_optional_user(
    token: str | None = Depends(oauth2_optional), db: Session = Depends(get_db)
) -> User | None:
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    return db.query(User).filter(User.id == payload.get("sub")).first()


def generate_invite_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


@router.post("/", response_model=SweepstakeOut, status_code=201)
def create_sweepstake(
    data: SweepstakeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quick_draw_names = data.quick_draw_names
    sweepstake_data = data.model_dump(exclude={"quick_draw_names"})

    sweepstake = Sweepstake(
        **sweepstake_data, owner_id=user.id, invite_code=generate_invite_code()
    )
    db.add(sweepstake)
    db.commit()
    db.refresh(sweepstake)

    if data.is_quick_draw:
        for name in quick_draw_names:
            participant = Participant(
                sweepstake_id=sweepstake.id, user_id=None, guest_name=name.strip()
            )
            db.add(participant)
    else:
        participant = Participant(sweepstake_id=sweepstake.id, user_id=user.id)
        db.add(participant)

    db.commit()
    return sweepstake


@router.get("/", response_model=list[SweepstakeOut])
def list_sweepstakes(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    joined = (
        db.query(Sweepstake)
        .join(Participant)
        .filter(Participant.user_id == user.id)
        .all()
    )

    owned_quick_draws = (
        db.query(Sweepstake)
        .filter(Sweepstake.owner_id == user.id, Sweepstake.is_quick_draw.is_(True))
        .all()
    )

    seen = set()
    results = []
    for s in joined + owned_quick_draws:
        if s.id not in seen:
            seen.add(s.id)
            results.append(s)

    return results


@router.get("/public", response_model=list[SweepstakeOut])
def list_public_sweepstakes(db: Session = Depends(get_db)):
    """
    Return all public sweepstakes — no auth required.
    Anyone can browse and join these rooms via invite code.
    Quick draw rooms are excluded (they are personal/ephemeral).
    """
    return (
        db.query(Sweepstake)
        .filter(Sweepstake.is_public.is_(True), Sweepstake.is_quick_draw.is_(False))
        .order_by(Sweepstake.created_at.desc())
        .all()
    )


@router.get("/share/{invite_code}")
def get_shared_sweepstake(invite_code: str, db: Session = Depends(get_db)):
    sweepstake = (
        db.query(Sweepstake).filter(Sweepstake.invite_code == invite_code).first()
    )
    if not sweepstake:
        raise HTTPException(404, "Sweepstake not found")

    participants = (
        db.query(Participant)
        .options(joinedload(Participant.assignments).joinedload(TeamAssignment.team))
        .filter(Participant.sweepstake_id == sweepstake.id)
        .all()
    )

    users = db.query(User).all()
    user_map = {str(u.id): u.full_name or u.email for u in users}

    participant_data = []
    for p in participants:
        name = p.guest_name if p.guest_name else user_map.get(str(p.user_id), "Unknown")
        participant_data.append(
            {
                "id": str(p.id),
                "user_name": name,
                "assignments": [
                    {
                        "team": {
                            "id": str(a.team.id),
                            "name": a.team.name,
                            "flag_emoji": a.team.flag_emoji,
                            "fifa_ranking": a.team.fifa_ranking,
                            "confederation": a.team.confederation,
                            "code": a.team.code,
                        }
                    }
                    for a in p.assignments
                ],
            }
        )

    return {
        "id": str(sweepstake.id),
        "name": sweepstake.name,
        "is_locked": sweepstake.is_locked,
        "is_quick_draw": sweepstake.is_quick_draw,
        "teams_per_person": sweepstake.teams_per_person,
        "invite_code": sweepstake.invite_code,
        "participants": participant_data,
    }


@router.get("/{sweepstake_id}", response_model=SweepstakeOut)
def get_sweepstake(
    sweepstake_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sweepstake = db.query(Sweepstake).filter(Sweepstake.id == sweepstake_id).first()
    if not sweepstake:
        raise HTTPException(404, "Sweepstake not found")
    return sweepstake


@router.get("/{sweepstake_id}/participants/", response_model=list[ParticipantOut])
def get_participants(
    sweepstake_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    participants = (
        db.query(Participant)
        .options(joinedload(Participant.assignments).joinedload(TeamAssignment.team))
        .filter(Participant.sweepstake_id == sweepstake_id)
        .all()
    )

    users = db.query(User).all()
    user_map = {str(u.id): u.full_name or u.email for u in users}

    results = []
    for p in participants:
        name = p.guest_name if p.guest_name else user_map.get(str(p.user_id), "Unknown")
        results.append(
            {
                "id": p.id,
                "user_id": p.user_id,
                "sweepstake_id": p.sweepstake_id,
                "user_name": name,
                "assignments": p.assignments,
            }
        )
    return results


@router.post("/join/{invite_code}", response_model=SweepstakeOut)
def join_sweepstake(
    invite_code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sweepstake = (
        db.query(Sweepstake).filter(Sweepstake.invite_code == invite_code).first()
    )
    if not sweepstake:
        raise HTTPException(404, "Invalid invite code")
    if sweepstake.is_locked:
        raise HTTPException(400, "Sweepstake is locked — draw already happened")

    existing = (
        db.query(Participant)
        .filter(
            Participant.sweepstake_id == sweepstake.id, Participant.user_id == user.id
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "Already in this sweepstake")

    count = (
        db.query(Participant).filter(Participant.sweepstake_id == sweepstake.id).count()
    )
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
    user: User = Depends(get_current_user),
):
    sweepstake = db.query(Sweepstake).filter(Sweepstake.id == sweepstake_id).first()
    if not sweepstake:
        raise HTTPException(404, "Sweepstake not found")
    if sweepstake.owner_id != user.id:
        raise HTTPException(403, "Only the owner can run the draw")
    if sweepstake.is_locked:
        raise HTTPException(400, "Draw already completed")

    participants = (
        db.query(Participant).filter(Participant.sweepstake_id == sweepstake_id).all()
    )

    num_participants = len(participants)
    teams_per_person = sweepstake.teams_per_person
    total_needed = num_participants * teams_per_person

    all_teams = db.query(Team).order_by(Team.fifa_ranking).all()
    if len(all_teams) < total_needed:
        raise HTTPException(400, "Not enough teams in database")

    def get_tier_limit(slot: int) -> int:
        return min(slot * 10, len(all_teams))

    used_ids: set = set()
    slots: list[list] = []

    for slot in range(teams_per_person):
        tier_limit = get_tier_limit(slot + 1)
        tier_teams = [t for t in all_teams[:tier_limit] if t.id not in used_ids]

        if len(tier_teams) < num_participants:
            tier_teams = [t for t in all_teams if t.id not in used_ids]

        if len(tier_teams) < num_participants:
            raise HTTPException(400, f"Not enough teams for slot {slot + 1}")

        max_rank = max(t.fifa_ranking for t in tier_teams)
        weights = [max_rank - t.fifa_ranking + 1 for t in tier_teams]

        sampled = random.choices(tier_teams, weights=weights, k=num_participants * 3)
        seen_this_slot: set = set()
        picked: list = []
        for team in sampled:
            if team.id not in seen_this_slot and team.id not in used_ids:
                seen_this_slot.add(team.id)
                picked.append(team)
            if len(picked) == num_participants:
                break

        if len(picked) < num_participants:
            remaining = [
                t
                for t in tier_teams
                if t.id not in used_ids and t.id not in seen_this_slot
            ]
            picked += remaining[: num_participants - len(picked)]

        if len(picked) < num_participants:
            raise HTTPException(
                400, f"Could not select enough unique teams for slot {slot + 1}"
            )

        random.shuffle(picked)
        slots.append(picked)

        for t in picked:
            used_ids.add(t.id)

    for i, participant in enumerate(participants):
        for slot in range(teams_per_person):
            db.add(
                TeamAssignment(participant_id=participant.id, team_id=slots[slot][i].id)
            )

    sweepstake.is_locked = True
    db.commit()

    participants = (
        db.query(Participant)
        .options(joinedload(Participant.assignments).joinedload(TeamAssignment.team))
        .filter(Participant.sweepstake_id == sweepstake_id)
        .all()
    )

    users = db.query(User).all()
    user_map = {str(u.id): u.full_name or u.email for u in users}

    results = []
    for p in participants:
        name = p.guest_name if p.guest_name else user_map.get(str(p.user_id), "Unknown")
        results.append(
            {
                "id": p.id,
                "user_id": p.user_id,
                "sweepstake_id": p.sweepstake_id,
                "user_name": name,
                "assignments": p.assignments,
            }
        )
    return results


@router.get("/{sweepstake_id}/leaderboard/")
def leaderboard(
    sweepstake_id: UUID,
    scoring_method: str = "total",
    db: Session = Depends(get_db),
    # Changed from get_current_user to get_optional_user so the share page
    # (which has no token) can still fetch the leaderboard.
    # Logged-in users continue to work exactly as before.
    user: User | None = Depends(get_optional_user),
):
    sweepstake = db.query(Sweepstake).filter(Sweepstake.id == sweepstake_id).first()
    if not sweepstake:
        raise HTTPException(404, "Sweepstake not found")

    participants = (
        db.query(Participant)
        .options(joinedload(Participant.assignments).joinedload(TeamAssignment.team))
        .filter(Participant.sweepstake_id == sweepstake_id)
        .all()
    )

    users = db.query(User).all()
    user_map = {str(u.id): u.full_name or u.email for u in users}

    results = []
    for p in participants:
        team_scores = []
        total_points = 0

        for assignment in p.assignments:
            team = assignment.team
            standing = db.query(Standing).filter(Standing.team_id == team.id).first()

            match_points = standing.points if standing else 0

            # ── Upset bonus ──────────────────────────────────────────
            # For each completed knockout match where this team won,
            # check if they beat a higher-ranked (lower number) team.
            # Bonus = ranking_gap * multiplier (only if upset_bonus_enabled)
            bonus_points = 0
            if sweepstake.upset_bonus_enabled:
                knockout_stages = [
                    MatchStage.round_of_32,
                    MatchStage.round_of_16,
                    MatchStage.quarter_final,
                    MatchStage.semi_final,
                    MatchStage.third_place,
                    MatchStage.final,
                ]
                # Find all completed knockout matches where this team won
                won_as_home = (
                    db.query(Match)
                    .filter(
                        Match.stage.in_(knockout_stages),
                        Match.is_completed.is_(True),
                        Match.home_team_id == team.id,
                        Match.home_score > Match.away_score,
                    )
                    .all()
                )
                won_as_away = (
                    db.query(Match)
                    .filter(
                        Match.stage.in_(knockout_stages),
                        Match.is_completed.is_(True),
                        Match.away_team_id == team.id,
                        Match.away_score > Match.home_score,
                    )
                    .all()
                )
                for match in won_as_home + won_as_away:
                    # Get the losing team
                    loser_id = (
                        match.away_team_id
                        if match.home_team_id == team.id
                        else match.home_team_id
                    )
                    from app.models.team import Team as TeamModel

                    loser = db.query(TeamModel).filter(TeamModel.id == loser_id).first()
                    if loser:
                        # Lower FIFA ranking number = better team
                        # Upset = winner has HIGHER number (worse ranked) than loser
                        ranking_gap = team.fifa_ranking - loser.fifa_ranking
                        if ranking_gap > 0:
                            bonus_points += (
                                ranking_gap * sweepstake.upset_bonus_multiplier
                            )

            team_total = match_points + bonus_points
            total_points += team_total

            team_scores.append(
                {
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
                }
            )

        num_teams = len(team_scores)
        if scoring_method == "average":
            display_points = round(total_points / num_teams, 1) if num_teams > 0 else 0
        elif scoring_method == "best":
            display_points = max((ts["total"] for ts in team_scores), default=0)
        else:
            display_points = total_points

        results.append(
            {
                "participant_id": str(p.id),
                "user_id": str(p.user_id) if p.user_id else None,
                "user_name": (
                    p.guest_name
                    if p.guest_name
                    else user_map.get(str(p.user_id) if p.user_id else "", "Unknown")
                ),
                "teams": team_scores,
                "total_points": display_points,
            }
        )

    results.sort(key=lambda x: x["total_points"], reverse=True)

    for i, r in enumerate(results):
        r["position"] = i + 1

    return results


@router.delete("/{sweepstake_id}")
def delete_sweepstake(
    sweepstake_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sweep = db.query(Sweepstake).filter(Sweepstake.id == sweepstake_id).first()
    if not sweep:
        raise HTTPException(status_code=404, detail="Sweepstake not found")
    if sweep.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your sweepstake")
    db.delete(sweep)
    db.commit()
    return {"ok": True}

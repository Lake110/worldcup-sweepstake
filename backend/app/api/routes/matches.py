from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_current_user
from app.db.database import get_db
from app.models.match import Match, MatchStage
from app.models.standing import Standing
from app.models.user import User
from app.schemas.match import MatchCreate, MatchOut, MatchUpdate

router = APIRouter()


@router.get("/", response_model=list[MatchOut])
def list_matches(
    stage: str | None = None, group_id: str | None = None, db: Session = Depends(get_db)
):
    query = db.query(Match)
    if stage:
        query = query.filter(Match.stage == stage)
    if group_id:
        query = query.filter(Match.group_id == group_id)
    return query.order_by(Match.match_date).all()


@router.get("/knockout/bracket")
def get_knockout_bracket(db: Session = Depends(get_db)):
    """
    Return all 63 knockout matches shaped for @g-loot/react-tournament-brackets.

    The library expects a flat list of match objects. Each match has:
    - id, name, nextMatchId, tournamentRoundText, startTime, state
    - participants: list of { id, name, resultText, isWinner, status }

    We return None for team slots not yet filled (TBD positions).
    The frontend transform function will handle rendering TBD labels.
    """
    knockout_stages = [
        MatchStage.round_of_32,
        MatchStage.round_of_16,
        MatchStage.quarter_final,
        MatchStage.semi_final,
        MatchStage.third_place,
        MatchStage.final,
    ]

    matches = (
        db.query(Match)
        .filter(Match.stage.in_(knockout_stages))
        .order_by(Match.match_date)
        .all()
    )

    # Map stage enum → display label for the bracket round headers
    stage_labels = {
        MatchStage.round_of_32: "R32",
        MatchStage.round_of_16: "R16",
        MatchStage.quarter_final: "QF",
        MatchStage.semi_final: "SF",
        MatchStage.third_place: "3rd",
        MatchStage.final: "Final",
    }

    def make_participant(team, score, is_winner):
        if team is None:
            return {
                "id": "tbd",
                "name": "TBD",
                "resultText": None,
                "isWinner": False,
                "status": None,
            }
        return {
            "id": str(team.id),
            "name": f"{team.flag_emoji} {team.name}",
            "resultText": str(score) if score is not None else None,
            "isWinner": is_winner,
            "status": "PLAYED" if score is not None else None,
        }

    def get_winner(match):
        """Returns 'home', 'away', or None if not completed."""
        if not match.is_completed:
            return None
        if match.home_score is None or match.away_score is None:
            return None
        if match.home_score > match.away_score:
            return "home"
        if match.away_score > match.home_score:
            return "away"
        return None  # draw (shouldn't happen in knockouts but handle it)

    result = []
    for match in matches:
        winner = get_winner(match)
        home_wins = winner == "home"
        away_wins = winner == "away"

        # Determine bracket state for the library
        if match.is_completed:
            state = "SCORE_DONE"
        elif match.home_team_id or match.away_team_id:
            state = "NO_PARTY"
        else:
            state = "NO_PARTY"

        result.append(
            {
                "id": str(match.id),
                "name": f"{stage_labels[match.stage]} Match",
                "nextMatchId": (
                    str(match.next_match_id) if match.next_match_id else None
                ),
                "nextMatchSlot": match.next_match_slot,
                "tournamentRoundText": stage_labels[match.stage],
                "startTime": match.match_date.isoformat() if match.match_date else None,
                "state": state,
                "participants": [
                    make_participant(match.home_team, match.home_score, home_wins),
                    make_participant(match.away_team, match.away_score, away_wins),
                ],
            }
        )

    return result


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
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_admin_user),
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(404, "Match not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(match, field, value)

    db.commit()
    db.refresh(match)

    # Recalculate standings for group matches
    if match.group_id:
        _recalculate_standings(match.group_id, db)

    # Advance winner to next knockout match
    if match.is_completed and match.next_match_id:
        _advance_winner(match, db)

    return match


def _advance_winner(match: Match, db: Session):
    """
    When a knockout match is completed, copy the winning team into
    the correct slot (home or away) of the next match.

    This is how real tournament software works — the bracket fills
    itself in as results come in. next_match_slot tells us which
    slot to fill: 'home' or 'away'.
    """
    if match.home_score is None or match.away_score is None:
        return

    if match.home_score > match.away_score:
        winner_id = match.home_team_id
    elif match.away_score > match.home_score:
        winner_id = match.away_team_id
    else:
        # Drawn knockout match — real tournament uses extra time/pens.
        # We can't determine winner from score alone, so skip for now.
        return

    next_match = db.query(Match).filter(Match.id == match.next_match_id).first()
    if not next_match:
        return

    if match.next_match_slot == "home":
        next_match.home_team_id = winner_id
    else:
        next_match.away_team_id = winner_id

    db.commit()


def _recalculate_standings(group_id: UUID, db: Session):
    """
    Recalculate standings for every team in a group from scratch.
    Starting from zero and replaying all completed matches is always correct.
    """
    standings = db.query(Standing).filter(Standing.group_id == group_id).all()
    for s in standings:
        s.played = 0
        s.wins = 0
        s.draws = 0
        s.losses = 0
        s.goals_for = 0
        s.goals_against = 0
        s.points = 0

    completed = (
        db.query(Match)
        .filter(
            Match.group_id == group_id,
            Match.is_completed.is_(True),
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
        )
        .all()
    )

    standing_map = {s.team_id: s for s in standings}

    for match in completed:
        home = standing_map.get(match.home_team_id)
        away = standing_map.get(match.away_team_id)

        if not home or not away:
            continue

        home.played += 1
        away.played += 1
        home.goals_for += match.home_score
        home.goals_against += match.away_score
        away.goals_for += match.away_score
        away.goals_against += match.home_score

        if match.home_score > match.away_score:
            home.wins += 1
            home.points += 3
            away.losses += 1
        elif match.home_score == match.away_score:
            home.draws += 1
            home.points += 1
            away.draws += 1
            away.points += 1
        else:
            away.wins += 1
            away.points += 3
            home.losses += 1

    db.commit()


# ── Manual team assignment (admin override) ────────────────────────────────


class MatchTeamUpdate(BaseModel):
    home_team_id: str | None = None
    away_team_id: str | None = None

@router.patch("/{match_id}/teams", response_model=MatchOut)
def update_match_teams(
    match_id: UUID,
    data: MatchTeamUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_admin_user),
):
    """
    Manually assign teams to a knockout match slot.
    Used when auto-population gets the 3rd place slots wrong,
    or to correct any bracket error.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(404, "Match not found")
    if data.home_team_id is not None:
        match.home_team_id = UUID(data.home_team_id) if data.home_team_id else None
    if data.away_team_id is not None:
        match.away_team_id = UUID(data.away_team_id) if data.away_team_id else None
    db.commit()
    db.refresh(match)
    return match


@router.post("/knockout/populate-r32")
<<<<<<< HEAD
def populate_r32(
    db: Session = Depends(get_db),
    user: User = Depends(get_admin_user)
):
=======
def populate_r32(db: Session = Depends(get_db), user: User = Depends(get_admin_user)):
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
    """
    Populate R32 slots from completed group standings.
    Fills in 1st and 2nd place slots automatically.
    3rd place slots require manual assignment via PATCH /{id}/teams.
    Returns a summary of what was filled and what still needs manual work.
    """
<<<<<<< HEAD
    from app.models.standing import Standing
    from app.models.group import Group
    from app.models.team import Team as TeamModel
=======
    from app.models.group import Group
    from app.models.standing import Standing
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b

    # Build standings per group: group_name -> [team_id ordered by pts/gd]
    groups = db.query(Group).all()
    group_standings: dict[str, list] = {}

    for group in groups:
<<<<<<< HEAD
        standings = (
            db.query(Standing)
            .filter(Standing.group_id == group.id)
            .all()
        )
=======
        standings = db.query(Standing).filter(Standing.group_id == group.id).all()
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
        # Sort: points desc, goal_difference desc, goals_for desc
        sorted_standings = sorted(
            standings,
            key=lambda s: (s.points, s.goal_difference, s.goals_for),
<<<<<<< HEAD
            reverse=True
=======
            reverse=True,
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
        )
        group_standings[group.name] = [s.team_id for s in sorted_standings]

    def get_team(group_name: str, position: int):
        """position: 0=1st, 1=2nd, 2=3rd"""
        teams = group_standings.get(group_name, [])
        return teams[position] if len(teams) > position else None

    # Fetch all R32 matches ordered by date (same order as seed)
    r32_matches = (
        db.query(Match)
        .filter(Match.stage == MatchStage.round_of_32)
        .order_by(Match.match_date)
        .all()
    )

    # Map match index to slot assignment (based on seed order)
    # Index 0=M73, 1=M74, ..., 15=M88
    slot_map = [
        # (home_group, home_pos, away_group, away_pos)
        # pos: 0=1st, 1=2nd, 2=3rd(manual)
<<<<<<< HEAD
        ("A", 1, "B", 1),   # M73: 2A v 2B
        ("E", 0, None, 2),  # M74: 1E v 3rd(manual)
        ("F", 0, "C", 1),   # M75: 1F v 2C
        ("C", 0, "F", 1),   # M76: 1C v 2F
        ("I", 0, None, 2),  # M77: 1I v 3rd(manual)
        ("E", 1, "I", 1),   # M78: 2E v 2I
=======
        ("A", 1, "B", 1),  # M73: 2A v 2B
        ("E", 0, None, 2),  # M74: 1E v 3rd(manual)
        ("F", 0, "C", 1),  # M75: 1F v 2C
        ("C", 0, "F", 1),  # M76: 1C v 2F
        ("I", 0, None, 2),  # M77: 1I v 3rd(manual)
        ("E", 1, "I", 1),  # M78: 2E v 2I
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
        ("A", 0, None, 2),  # M79: 1A v 3rd(manual)
        ("L", 0, None, 2),  # M80: 1L v 3rd(manual)
        ("D", 0, None, 2),  # M81: 1D v 3rd(manual)
        ("G", 0, None, 2),  # M82: 1G v 3rd(manual)
<<<<<<< HEAD
        ("K", 1, "L", 1),   # M83: 2K v 2L
        ("H", 0, "J", 1),   # M84: 1H v 2J
        ("B", 0, None, 2),  # M85: 1B v 3rd(manual)
        ("J", 0, "H", 1),   # M86: 1J v 2H
        ("K", 0, None, 2),  # M87: 1K v 3rd(manual)
        ("D", 1, "G", 1),   # M88: 2D v 2G
=======
        ("K", 1, "L", 1),  # M83: 2K v 2L
        ("H", 0, "J", 1),  # M84: 1H v 2J
        ("B", 0, None, 2),  # M85: 1B v 3rd(manual)
        ("J", 0, "H", 1),  # M86: 1J v 2H
        ("K", 0, None, 2),  # M87: 1K v 3rd(manual)
        ("D", 1, "G", 1),  # M88: 2D v 2G
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
    ]

    filled = []
    needs_manual = []

    for i, match in enumerate(r32_matches):
        if i >= len(slot_map):
            break
        home_group, home_pos, away_group, away_pos = slot_map[i]

<<<<<<< HEAD
        updated = False

=======
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
        # Home slot
        if home_pos != 2 and not match.home_team_id:
            team_id = get_team(home_group, home_pos)
            if team_id:
                match.home_team_id = team_id
<<<<<<< HEAD
                updated = True
=======
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
                filled.append(f"M{73+i} home: {home_group} pos {home_pos+1}")

        # Away slot
        if away_group and away_pos != 2 and not match.away_team_id:
            team_id = get_team(away_group, away_pos)
            if team_id:
                match.away_team_id = team_id
<<<<<<< HEAD
                updated = True
=======
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
                filled.append(f"M{73+i} away: {away_group} pos {away_pos+1}")

        # Flag manual slots
        if home_pos == 2:
            needs_manual.append(f"M{73+i} home: best 3rd place team")
        if away_pos == 2:
            needs_manual.append(f"M{73+i} away: best 3rd place team")

    db.commit()

    return {
        "filled": filled,
        "needs_manual": needs_manual,
<<<<<<< HEAD
        "message": f"Auto-filled {len(filled)} slots. {len(needs_manual)} slots need manual assignment."
=======
        "message": f"Auto-filled {len(filled)} slots. {len(needs_manual)} slots need manual assignment.",
>>>>>>> ae36f81bb48e34b442b7264a003131e2c557679b
    }

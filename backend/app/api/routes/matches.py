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
        MatchStage.round_of_32:   "R32",
        MatchStage.round_of_16:   "R16",
        MatchStage.quarter_final: "QF",
        MatchStage.semi_final:    "SF",
        MatchStage.third_place:   "3rd",
        MatchStage.final:         "Final",
    }

    def make_participant(team, score, is_winner):
        if team is None:
            return {
                "id":         "tbd",
                "name":       "TBD",
                "resultText": None,
                "isWinner":   False,
                "status":     None,
            }
        return {
            "id":         str(team.id),
            "name":       f"{team.flag_emoji} {team.name}",
            "resultText": str(score) if score is not None else None,
            "isWinner":   is_winner,
            "status":     "PLAYED" if score is not None else None,
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

        result.append({
            "id":                   str(match.id),
            "name":                 f"{stage_labels[match.stage]} Match",
            "nextMatchId":          str(match.next_match_id) if match.next_match_id else None,
            "nextMatchSlot":        match.next_match_slot,
            "tournamentRoundText":  stage_labels[match.stage],
            "startTime":            match.match_date.isoformat() if match.match_date else None,
            "state":                state,
            "participants": [
                make_participant(match.home_team, match.home_score, home_wins),
                make_participant(match.away_team, match.away_score, away_wins),
            ],
        })

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
    user: User = Depends(get_admin_user)
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
        s.played        = 0
        s.wins          = 0
        s.draws         = 0
        s.losses        = 0
        s.goals_for     = 0
        s.goals_against = 0
        s.points        = 0

    completed = db.query(Match).filter(
        Match.group_id == group_id,
        Match.is_completed == True,
        Match.home_score != None,
        Match.away_score != None,
    ).all()

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

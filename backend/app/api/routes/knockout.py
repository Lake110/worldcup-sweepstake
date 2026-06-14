"""
Knockout-bracket management endpoints.

POST /populate  — fill R32 winner/runner-up slots from completed group standings.
                  Idempotent; only fills slots from groups where all 6 matches are done.
                  Third-place slots are left for manual admin assignment.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user
from app.db.database import get_db
from app.models.group import Group
from app.models.match import Match, MatchStage
from app.models.standing import Standing
from app.models.team import Team
from app.models.user import User

router = APIRouter()

# R32 match index (0 = M73 … 15 = M88) → (home_group, home_pos, away_group, away_pos)
# pos: 0=1st place, 1=2nd place, 2=3rd place (manual assignment)
_SLOT_MAP = [
    ("A", 1, "B",  1),  # M73: 2A v 2B
    ("E", 0, None, 2),  # M74: 1E v 3rd(A/B/C/D/F)
    ("F", 0, "C",  1),  # M75: 1F v 2C
    ("C", 0, "F",  1),  # M76: 1C v 2F
    ("I", 0, None, 2),  # M77: 1I v 3rd(C/D/F/G/H)
    ("E", 1, "I",  1),  # M78: 2E v 2I
    ("A", 0, None, 2),  # M79: 1A v 3rd(C/E/F/H/I)
    ("L", 0, None, 2),  # M80: 1L v 3rd(E/H/I/J/K)
    ("D", 0, None, 2),  # M81: 1D v 3rd(B/E/F/I/J)
    ("G", 0, None, 2),  # M82: 1G v 3rd(A/E/H/I/J)
    ("K", 1, "L",  1),  # M83: 2K v 2L
    ("H", 0, "J",  1),  # M84: 1H v 2J
    ("B", 0, None, 2),  # M85: 1B v 3rd(E/F/G/I/J)
    ("J", 0, "H",  1),  # M86: 1J v 2H
    ("K", 0, None, 2),  # M87: 1K v 3rd(D/E/I/J/L)
    ("D", 1, "G",  1),  # M88: 2D v 2G
]


@router.post("/populate")
def populate_knockout(
    db: Session = Depends(get_db),
    _user: User = Depends(get_admin_user),
):
    """
    Populate R32 winner/runner-up slots from completed group standings.

    Rules:
    - A group is only used once ALL 6 of its matches are marked is_completed=True.
    - Slots already filled are skipped (idempotent).
    - Third-place slots (8 of the 16 R32 away/home positions) require manual
      assignment via PATCH /api/matches/{id}/teams.

    Returns a summary of what was filled, which groups are still pending,
    which slots need manual assignment, and the full ranked 3rd-place list
    for admin reference.
    """
    groups = db.query(Group).order_by(Group.name).all()

    # ── Build per-group data ────────────────────────────────────────────────
    group_data: dict[str, dict] = {}
    for group in groups:
        standings = db.query(Standing).filter(Standing.group_id == group.id).all()
        sorted_st = sorted(
            standings,
            key=lambda s: (s.points, s.goal_difference, s.goals_for),
            reverse=True,
        )
        group_matches = (
            db.query(Match)
            .filter(Match.group_id == group.id, Match.stage == MatchStage.group)
            .all()
        )
        complete = len(group_matches) == 6 and all(
            m.is_completed for m in group_matches
        )
        group_data[group.name] = {
            "complete": complete,
            "team_ids": [s.team_id for s in sorted_st],
            "sorted": sorted_st,
        }

    # ── Fetch R32 matches in seeded date order ──────────────────────────────
    r32_matches = (
        db.query(Match)
        .filter(Match.stage == MatchStage.round_of_32)
        .order_by(Match.match_date)
        .all()
    )

    filled: list[str] = []
    needs_manual: list[str] = []
    pending_groups: list[str] = []

    for i, match in enumerate(r32_matches):
        if i >= len(_SLOT_MAP):
            break
        home_group, home_pos, away_group, away_pos = _SLOT_MAP[i]
        label = f"M{73 + i}"

        # Home slot
        if home_pos != 2:
            gd = group_data.get(home_group, {})
            if not gd.get("complete"):
                if home_group not in pending_groups:
                    pending_groups.append(home_group)
            elif not match.home_team_id:
                ids = gd["team_ids"]
                if len(ids) > home_pos:
                    match.home_team_id = ids[home_pos]
                    rank = "1st" if home_pos == 0 else "2nd"
                    filled.append(f"{label} home: Group {home_group} {rank}")
        else:
            needs_manual.append(f"{label} home: best 3rd-place team")

        # Away slot
        if away_group and away_pos != 2:
            gd = group_data.get(away_group, {})
            if not gd.get("complete"):
                if away_group not in pending_groups:
                    pending_groups.append(away_group)
            elif not match.away_team_id:
                ids = gd["team_ids"]
                if len(ids) > away_pos:
                    match.away_team_id = ids[away_pos]
                    rank = "1st" if away_pos == 0 else "2nd"
                    filled.append(f"{label} away: Group {away_group} {rank}")
        elif away_pos == 2:
            needs_manual.append(f"{label} away: best 3rd-place team")

    db.commit()

    # ── Ranked 3rd-place list (from complete groups only) ──────────────────
    third_place_list = []
    for group_name, gd in sorted(group_data.items()):
        if gd["complete"] and len(gd["sorted"]) >= 3:
            s = gd["sorted"][2]
            team = db.query(Team).filter(Team.id == s.team_id).first()
            if team:
                third_place_list.append(
                    {
                        "id": str(team.id),
                        "name": team.name,
                        "flag_emoji": team.flag_emoji,
                        "group": group_name,
                        "points": s.points,
                        "goal_difference": s.goal_difference,
                        "goals_for": s.goals_for,
                        "fifa_ranking": team.fifa_ranking,
                    }
                )

    # Sort: pts DESC → GD DESC → GF DESC → FIFA ranking ASC (lower = better)
    third_place_list.sort(
        key=lambda x: (x["points"], x["goal_difference"], x["goals_for"], -x["fifa_ranking"]),
        reverse=True,
    )

    return {
        "filled": filled,
        "needs_manual": needs_manual,
        "pending_groups": sorted(pending_groups),
        "third_place_ranking": third_place_list,
        "message": (
            f"Filled {len(filled)} slots. "
            f"{len(pending_groups)} group(s) still incomplete. "
            f"{len(needs_manual)} slot(s) need manual 3rd-place assignment."
        ),
    }

"""
Seed all 63 knockout matches for FIFA World Cup 2026.

Strategy: create matches from Final backwards to R32.
This way next_match_id always references an already-created match.

Match numbers follow the official FIFA schedule (73–104).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.match import Match, MatchStage


def dt(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def seed_knockout_matches(db: Session) -> None:
    existing = db.query(Match).filter(Match.stage != MatchStage.group).count()
    if existing > 0:
        print(f"Knockout matches already seeded ({existing} found), skipping.")
        return

    # ------------------------------------------------------------------
    # Pre-assign UUIDs so we can wire next_match_id before inserting
    # ------------------------------------------------------------------

    # FINAL (Match 104) & THIRD PLACE (Match 103)
    id_104 = uuid.uuid4()  # Final
    id_103 = uuid.uuid4()  # Third place

    # SEMI FINALS (Matches 101, 102)
    id_101 = uuid.uuid4()  # SF1 — winners go to Final, losers to 3rd place
    id_102 = uuid.uuid4()  # SF2

    # QUARTER FINALS (Matches 97–100)
    id_97 = uuid.uuid4()
    id_98 = uuid.uuid4()
    id_99 = uuid.uuid4()
    id_100 = uuid.uuid4()

    # ROUND OF 16 (Matches 89–96)
    id_89 = uuid.uuid4()
    id_90 = uuid.uuid4()
    id_91 = uuid.uuid4()
    id_92 = uuid.uuid4()
    id_93 = uuid.uuid4()
    id_94 = uuid.uuid4()
    id_95 = uuid.uuid4()
    id_96 = uuid.uuid4()

    # ROUND OF 32 (Matches 73–88)
    id_73 = uuid.uuid4()
    id_74 = uuid.uuid4()
    id_75 = uuid.uuid4()
    id_76 = uuid.uuid4()
    id_77 = uuid.uuid4()
    id_78 = uuid.uuid4()
    id_79 = uuid.uuid4()
    id_80 = uuid.uuid4()
    id_81 = uuid.uuid4()
    id_82 = uuid.uuid4()
    id_83 = uuid.uuid4()
    id_84 = uuid.uuid4()
    id_85 = uuid.uuid4()
    id_86 = uuid.uuid4()
    id_87 = uuid.uuid4()
    id_88 = uuid.uuid4()

    # ------------------------------------------------------------------
    # Build all match objects
    # next_match_id / next_match_slot wiring follows official bracket:
    #
    # R32 → R16 → QF → SF → Final
    #
    # SF losers → 3rd place match
    # ------------------------------------------------------------------

    matches = [
        # ── FINAL ──────────────────────────────────────────────────────
        Match(
            id=id_104,
            stage=MatchStage.final,
            match_date=dt("2026-07-19"),
            next_match_id=None,
            next_match_slot=None,
        ),
        # ── THIRD PLACE ────────────────────────────────────────────────
        Match(
            id=id_103,
            stage=MatchStage.third_place,
            match_date=dt("2026-07-18"),
            next_match_id=None,
            next_match_slot=None,
        ),
        # ── SEMI FINALS ────────────────────────────────────────────────
        # Match 101: winner → Final (home), loser → 3rd place (home)
        Match(
            id=id_101,
            stage=MatchStage.semi_final,
            match_date=dt("2026-07-14"),
            next_match_id=id_104,
            next_match_slot="home",
        ),
        # Match 102: winner → Final (away), loser → 3rd place (away)
        Match(
            id=id_102,
            stage=MatchStage.semi_final,
            match_date=dt("2026-07-15"),
            next_match_id=id_104,
            next_match_slot="away",
        ),
        # ── QUARTER FINALS ─────────────────────────────────────────────
        # Match 97: W89 v W90 → winner → SF1 home
        Match(
            id=id_97,
            stage=MatchStage.quarter_final,
            match_date=dt("2026-07-09"),
            next_match_id=id_101,
            next_match_slot="home",
        ),
        # Match 98: W93 v W94 → winner → SF1 away
        Match(
            id=id_98,
            stage=MatchStage.quarter_final,
            match_date=dt("2026-07-10"),
            next_match_id=id_101,
            next_match_slot="away",
        ),
        # Match 99: W91 v W92 → winner → SF2 home
        Match(
            id=id_99,
            stage=MatchStage.quarter_final,
            match_date=dt("2026-07-11"),
            next_match_id=id_102,
            next_match_slot="home",
        ),
        # Match 100: W95 v W96 → winner → SF2 away
        Match(
            id=id_100,
            stage=MatchStage.quarter_final,
            match_date=dt("2026-07-11"),
            next_match_id=id_102,
            next_match_slot="away",
        ),
        # ── ROUND OF 16 ────────────────────────────────────────────────
        # Match 89: W74 v W77 → winner → QF97 home
        Match(
            id=id_89,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-04"),
            next_match_id=id_97,
            next_match_slot="home",
        ),
        # Match 90: W73 v W75 → winner → QF97 away
        Match(
            id=id_90,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-04"),
            next_match_id=id_97,
            next_match_slot="away",
        ),
        # Match 91: W76 v W78 → winner → QF99 home
        Match(
            id=id_91,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-05"),
            next_match_id=id_99,
            next_match_slot="home",
        ),
        # Match 92: W79 v W80 → winner → QF99 away
        Match(
            id=id_92,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-05"),
            next_match_id=id_99,
            next_match_slot="away",
        ),
        # Match 93: W83 v W84 → winner → QF98 home
        Match(
            id=id_93,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-06"),
            next_match_id=id_98,
            next_match_slot="home",
        ),
        # Match 94: W81 v W82 → winner → QF98 away
        Match(
            id=id_94,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-06"),
            next_match_id=id_98,
            next_match_slot="away",
        ),
        # Match 95: W86 v W88 → winner → QF100 home
        Match(
            id=id_95,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-07"),
            next_match_id=id_100,
            next_match_slot="home",
        ),
        # Match 96: W85 v W87 → winner → QF100 away
        Match(
            id=id_96,
            stage=MatchStage.round_of_16,
            match_date=dt("2026-07-07"),
            next_match_id=id_100,
            next_match_slot="away",
        ),
        # ── ROUND OF 32 ────────────────────────────────────────────────
        # Match 73: 2A v 2B → winner → R16-90 home
        Match(
            id=id_73,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-06-28"),
            next_match_id=id_90,
            next_match_slot="home",
        ),
        # Match 74: 1E v 3rd(ABCDF) → winner → R16-89 home
        Match(
            id=id_74,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-06-29"),
            next_match_id=id_89,
            next_match_slot="home",
        ),
        # Match 75: 1F v 2C → winner → R16-90 away
        Match(
            id=id_75,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-06-29"),
            next_match_id=id_90,
            next_match_slot="away",
        ),
        # Match 76: 1C v 2F → winner → R16-91 home
        Match(
            id=id_76,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-06-29"),
            next_match_id=id_91,
            next_match_slot="home",
        ),
        # Match 77: 1I v 3rd(CDFGH) → winner → R16-89 away
        Match(
            id=id_77,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-06-30"),
            next_match_id=id_89,
            next_match_slot="away",
        ),
        # Match 78: 2E v 2I → winner → R16-91 away
        Match(
            id=id_78,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-06-30"),
            next_match_id=id_91,
            next_match_slot="away",
        ),
        # Match 79: 1A v 3rd(CEFHI) → winner → R16-92 home
        Match(
            id=id_79,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-06-30"),
            next_match_id=id_92,
            next_match_slot="home",
        ),
        # Match 80: 1L v 3rd(EHIJK) → winner → R16-92 away
        Match(
            id=id_80,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-01"),
            next_match_id=id_92,
            next_match_slot="away",
        ),
        # Match 81: 1D v 3rd(BEFIJ) → winner → R16-94 home
        Match(
            id=id_81,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-01"),
            next_match_id=id_94,
            next_match_slot="home",
        ),
        # Match 82: 1G v 3rd(AEHIJ) → winner → R16-94 away
        Match(
            id=id_82,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-01"),
            next_match_id=id_94,
            next_match_slot="away",
        ),
        # Match 83: 2K v 2L → winner → R16-93 home
        Match(
            id=id_83,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-02"),
            next_match_id=id_93,
            next_match_slot="home",
        ),
        # Match 84: 1H v 2J → winner → R16-93 away
        Match(
            id=id_84,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-02"),
            next_match_id=id_93,
            next_match_slot="away",
        ),
        # Match 85: 1B v 3rd(EFGIJ) → winner → R16-96 away
        Match(
            id=id_85,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-02"),
            next_match_id=id_96,
            next_match_slot="away",
        ),
        # Match 86: 1J v 2H → winner → R16-95 home
        Match(
            id=id_86,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-03"),
            next_match_id=id_95,
            next_match_slot="home",
        ),
        # Match 87: 1K v 3rd(DEIJL) → winner → R16-96 home
        Match(
            id=id_87,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-03"),
            next_match_id=id_96,
            next_match_slot="home",
        ),
        # Match 88: 2D v 2G → winner → R16-95 away
        Match(
            id=id_88,
            stage=MatchStage.round_of_32,
            match_date=dt("2026-07-03"),
            next_match_id=id_95,
            next_match_slot="away",
        ),
    ]

    for m in matches:
        db.add(m)

    db.commit()
    print(f"Seeded {len(matches)} knockout matches.")

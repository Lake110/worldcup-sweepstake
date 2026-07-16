"""
Enter all completed World Cup 2026 knockout results via the admin API.

Run inside the backend container:
    docker compose exec backend python3 scripts/enter_knockout_results.py

Idempotent: skips any match that already has a score recorded.

R32 note: as of this run the group stage isn't complete in the DB, so the
16 round-of-32 slots are still empty (home_team_id/away_team_id = NULL) and
/matches/knockout/populate-r32 (which relies on group standings) can't be
used. The R32 -> M73..M88 slot mapping below was reverse-engineered from the
group letters baked into matches.py's populate-r32 slot_map cross-referenced
against each team's actual group in the DB (see team_groups below) - every
pairing, and every downstream R16/QF/SF/Final/3rd-place matchup it produces,
was cross-validated against the results supplied for this task and lines up
exactly (including the Final landing on Spain v Argentina and the 3rd-place
match landing on France v England, as expected). R32 teams are assigned
directly via PATCH /matches/{id}/teams; everything from R16 onward advances
automatically through the existing winner-propagation logic.
"""

import asyncio
import sys

import httpx

BASE_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "admin@worldcup-sweepstake.com"
ADMIN_PASSWORD = "admin1234"

# Which two teams occupy each of the 16 R32 slots, in the order produced by
# recursively expanding the bracket top-down from the Final
# (Final -> [home, away], each expanded to its own [home, away], ...).
# Determined by matching this task's results against the group letters in
# each slot's populate-r32 definition (see matches.py slot_map) — this is
# the only manual mapping needed; R16 onward is populated by propagation.
#
# NOTE: match_date has ties within every round below the Final/semis (e.g.
# four R32 matches share 2026-06-29..07-03), and id is a random UUID, so
# sorting by either does NOT reliably reproduce bracket slot order. Instead
# each match is located deterministically by walking next_match_id/
# next_match_slot down from the Final (see resolve_slot_order() below).
R32_SLOTS = [
    ("Germany", "Paraguay"),        # M74
    ("France", "Sweden"),           # M77
    ("Canada", "South Africa"),     # M73
    ("Netherlands", "Morocco"),     # M75
    ("Portugal", "Croatia"),        # M83
    ("Spain", "Austria"),           # M84
    ("USA", "Bosnia Herzegovina"),  # M81
    ("Belgium", "Senegal"),         # M82
    ("Brazil", "Japan"),            # M76
    ("Norway", "Ivory Coast"),      # M78
    ("Mexico", "Ecuador"),          # M79
    ("England", "DR Congo"),        # M80
    ("Argentina", "Cape Verde"),    # M86
    ("Egypt", "Australia"),         # M88
    ("Colombia", "Ghana"),          # M87
    ("Switzerland", "Algeria"),     # M85
]

# (home, away, home_score, away_score, penalty_winner_name_or_None)
RESULTS = [
    # ROUND OF 32
    ("Canada", "South Africa", 1, 0, None),
    ("Brazil", "Japan", 2, 1, None),
    ("Germany", "Paraguay", 1, 1, "Paraguay"),
    ("Netherlands", "Morocco", 1, 1, "Morocco"),
    ("Norway", "Ivory Coast", 2, 1, None),
    ("France", "Sweden", 3, 0, None),
    ("Mexico", "Ecuador", 2, 0, None),
    ("England", "DR Congo", 2, 1, None),
    ("Belgium", "Senegal", 3, 2, None),
    ("USA", "Bosnia Herzegovina", 2, 0, None),
    ("Spain", "Austria", 3, 0, None),
    ("Portugal", "Croatia", 2, 1, None),
    ("Switzerland", "Algeria", 2, 0, None),
    ("Egypt", "Australia", 1, 1, "Egypt"),
    ("Argentina", "Cape Verde", 3, 2, None),
    ("Colombia", "Ghana", 1, 0, None),
    # ROUND OF 16
    ("Morocco", "Canada", 3, 0, None),
    ("France", "Paraguay", 1, 0, None),
    ("Norway", "Brazil", 2, 1, None),
    ("England", "Mexico", 3, 2, None),
    ("Spain", "Portugal", 1, 0, None),
    ("Belgium", "USA", 4, 1, None),
    ("Argentina", "Egypt", 3, 2, None),
    ("Switzerland", "Colombia", 0, 0, "Switzerland"),
    # QUARTER-FINALS
    ("France", "Morocco", 2, 0, None),
    ("Spain", "Belgium", 2, 1, None),
    ("England", "Norway", 2, 1, None),
    ("Argentina", "Switzerland", 3, 1, None),
    # SEMI-FINALS
    ("Spain", "France", 2, 0, None),
    ("Argentina", "England", 2, 1, None),
]


async def login(client: httpx.AsyncClient) -> str:
    resp = await client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def get_teams(client: httpx.AsyncClient) -> dict[str, str]:
    resp = await client.get("/teams/")
    resp.raise_for_status()
    return {t["name"]: t["id"] for t in resp.json()}


async def get_knockout_matches(client: httpx.AsyncClient) -> list[dict]:
    resp = await client.get("/matches/", params={"stage": "round_of_32"})
    resp.raise_for_status()
    r32 = resp.json()
    all_matches = list(r32)
    for stage in (
        "round_of_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
    ):
        resp = await client.get("/matches/", params={"stage": stage})
        resp.raise_for_status()
        all_matches.extend(resp.json())
    return all_matches


async def resolve_r32_order(client: httpx.AsyncClient) -> list[dict]:
    """
    Return the 16 R32 match dicts (from /matches/knockout/bracket) in the
    order produced by recursively expanding [home, away] starting from the
    Final. This order has no date/id ambiguity since it's built purely by
    following next_match_id/next_match_slot links down from the single,
    uniquely-identifiable Final match.
    """
    resp = await client.get("/matches/knockout/bracket")
    resp.raise_for_status()
    bracket = resp.json()
    by_next: dict[tuple[str, str], dict] = {}
    for m in bracket:
        if m["nextMatchId"]:
            by_next[(m["nextMatchId"], m["nextMatchSlot"])] = m
    by_stage_final = [m for m in bracket if m["tournamentRoundText"] == "Final"]
    assert len(by_stage_final) == 1, "expected exactly one Final match"

    frontier = [by_stage_final[0]]
    for _ in range(4):  # Final -> SF -> QF -> R16 -> R32
        next_frontier = []
        for m in frontier:
            home_child = by_next.get((m["id"], "home"))
            away_child = by_next.get((m["id"], "away"))
            assert home_child and away_child, f"broken bracket wiring at match {m['id']}"
            next_frontier.extend([home_child, away_child])
        frontier = next_frontier
    assert len(frontier) == 16, f"expected 16 R32 matches, got {len(frontier)}"
    return frontier


async def assign_r32_teams(
    client: httpx.AsyncClient, headers: dict, teams: dict[str, str]
) -> None:
    """Manually assign the 16 R32 pairings to the pre-wired, still-empty slots."""
    r32_ordered = await resolve_r32_order(client)

    for bracket_match, (home_name, away_name) in zip(r32_ordered, R32_SLOTS):
        already_has_teams = bracket_match["participants"][0]["id"] != "tbd" or (
            bracket_match["participants"][1]["id"] != "tbd"
        )
        if already_has_teams:
            print(f"  SKIP (already assigned): slot for {home_name} v {away_name}")
            continue
        home_id = teams[home_name]
        away_id = teams[away_name]
        resp = await client.patch(
            f"/matches/{bracket_match['id']}/teams",
            json={"home_team_id": home_id, "away_team_id": away_id},
            headers=headers,
        )
        resp.raise_for_status()
        print(f"  Assigned R32 slot: {home_name} v {away_name}")


def find_match(matches: list[dict], teams: dict[str, str], home: str, away: str):
    home_id = teams.get(home)
    away_id = teams.get(away)
    if home_id is None or away_id is None:
        return None
    for m in matches:
        ids = {m["home_team_id"], m["away_team_id"]}
        if ids == {home_id, away_id}:
            return m
    return None


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        token = await login(client)
        headers = {"Authorization": f"Bearer {token}"}

        teams = await get_teams(client)

        print("Assigning Round of 32 slots (group stage incomplete in DB)...")
        await assign_r32_teams(client, headers, teams)

        entered = 0
        skipped = 0
        errors = []

        for home_name, away_name, home_score, away_score, pens_winner in RESULTS:
            matches = await get_knockout_matches(client)
            match = find_match(matches, teams, home_name, away_name)
            if match is None:
                errors.append(f"{home_name} v {away_name}: match not found (not yet propagated?)")
                continue

            if match["home_score"] is not None and match["away_score"] is not None:
                print(f"  SKIP (already entered): {home_name} v {away_name}")
                skipped += 1
                continue

            # Scores map to whichever slot actually holds each team in the DB —
            # not necessarily the same home/away order listed in RESULTS.
            if match["home_team_id"] == teams[home_name]:
                payload = {"home_score": home_score, "away_score": away_score}
            else:
                payload = {"home_score": away_score, "away_score": home_score}

            if pens_winner:
                payload["winner_team_id"] = teams[pens_winner]

            resp = await client.patch(
                f"/matches/{match['id']}/result", json=payload, headers=headers
            )
            resp.raise_for_status()
            print(f"  Entered: {home_name} {home_score}-{away_score} {away_name}")
            entered += 1

        print(f"\nDone. Entered {entered}, skipped {skipped} (already set).")
        if errors:
            print(f"\n{len(errors)} match(es) could not be found:")
            for e in errors:
                print(f"  - {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

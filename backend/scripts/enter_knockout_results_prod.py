"""
Enter all completed World Cup 2026 knockout results against PRODUCTION via
the admin API. Same RESULTS corpus as enter_knockout_results.py, but skips
R32 team assignment (production's R32 slots are already correctly populated
from real group standings, via /populate-r32 plus two manual fixes applied
directly beforehand for the two "best 3rd place" slots that were still
broken/incomplete).

Idempotent: skips any match that already has a score recorded.

Run inside the backend container:
    docker compose exec backend python3 scripts/enter_knockout_results_prod.py
"""

import asyncio
import sys

import httpx

BASE_URL = "https://worldcup-sweepstake-production.up.railway.app/api"
ADMIN_EMAIL = "michael@sweepstake.com"
ADMIN_PASSWORD = "password123"

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
    all_matches = []
    for stage in (
        "round_of_32",
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

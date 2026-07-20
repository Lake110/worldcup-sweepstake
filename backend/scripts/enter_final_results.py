"""
Enter the final two World Cup 2026 results via the admin API:
  - 3rd place: France 4-6 England (England win bronze)
  - Final:     Spain 1-0 Argentina, AET (Spain are champions)

Follows the same pattern as enter_knockout_results.py — goes through the
admin API (not a raw DB session) so PATCH /matches/{id}/result's existing
winner-propagation and standings-recalc logic runs exactly as it would for
a normal admin result entry.

Idempotent: skips either match if it already has a score recorded.

Run inside the backend container:
    docker compose exec backend python3 scripts/enter_final_results.py
"""

import asyncio
import sys

import httpx

BASE_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "admin@worldcup-sweepstake.com"
ADMIN_PASSWORD = "admin1234"

# (home, away, home_score, away_score)
RESULTS = [
    ("France", "England", 4, 6),
    ("Spain", "Argentina", 1, 0),
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


async def get_matches(client: httpx.AsyncClient, stage: str) -> list[dict]:
    resp = await client.get("/matches/", params={"stage": stage})
    resp.raise_for_status()
    return resp.json()


def find_match(matches: list[dict], teams: dict[str, str], home: str, away: str):
    home_id = teams.get(home)
    away_id = teams.get(away)
    if home_id is None or away_id is None:
        return None
    for m in matches:
        ids = {str(m["home_team_id"]), str(m["away_team_id"])}
        if ids == {home_id, away_id}:
            return m
    return None


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        token = await login(client)
        headers = {"Authorization": f"Bearer {token}"}

        teams = await get_teams(client)

        third_place = await get_matches(client, "third_place")
        final = await get_matches(client, "final")
        stage_matches = {"third_place": third_place, "final": final}
        stage_for = {"France": "third_place", "England": "third_place",
                     "Spain": "final", "Argentina": "final"}

        entered = 0
        skipped = 0
        errors = []

        for home_name, away_name, home_score, away_score in RESULTS:
            stage = stage_for[home_name]
            match = find_match(stage_matches[stage], teams, home_name, away_name)
            if match is None:
                errors.append(f"{home_name} v {away_name}: match not found")
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

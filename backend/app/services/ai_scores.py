import base64
import json
import logging
from datetime import date

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.match import Match
from app.models.team import Team

logger = logging.getLogger(__name__)

TEAM_NAME_MAP: dict[str, str] = {
    "Bosnia & Herzegovina": "Bosnia Herzegovina",
    "D.R. Congo": "DR Congo",
    "Côte d'Ivoire": "Ivory Coast",
    "Cote d'Ivoire": "Ivory Coast",
    "United States": "USA",
    "United States of America": "USA",
    "Republic of Ireland": "Ireland",
    "Korea Republic": "South Korea",
    "Korea DPR": "North Korea",
    "Congo DR": "DR Congo",
}

TEAM_LIST = [
    "Argentina", "Spain", "France", "England", "Portugal", "Brazil", "Morocco",
    "Netherlands", "Belgium", "Germany", "Croatia", "Colombia", "Mexico", "Senegal",
    "Uruguay", "USA", "Japan", "Switzerland", "Iran", "Turkey", "Ecuador", "Austria",
    "South Korea", "Australia", "Algeria", "Egypt", "Canada", "Norway",
    "Ivory Coast", "Panama", "Sweden", "Czech Republic", "Paraguay", "Scotland",
    "Tunisia", "DR Congo", "Uzbekistan", "Qatar", "Iraq", "South Africa",
    "Saudi Arabia", "Bosnia Herzegovina", "Cape Verde", "Ghana", "Curacao",
    "Haiti", "New Zealand", "Jordan",
]


def _normalise_team_name(name: str) -> str:
    return TEAM_NAME_MAP.get(name, name)


def _parse_json_response(text: str) -> list[dict]:
    """Extract a JSON array from Claude's response, handling preamble text and code fences."""
    import re

    text = text.strip()
    if not text:
        return []

    # Extract from ```json ... ``` or ``` ... ``` code fences first
    fence_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    else:
        # Find the outermost JSON array anywhere in the text
        array_match = re.search(r"\[.*\]", text, re.DOTALL)
        if array_match:
            text = array_match.group(0).strip()

    if not text:
        return []

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("ai_scores: JSON parse failed: %s | text was: %r", exc, text[:200])
        return []

    if not isinstance(parsed, list):
        logger.warning("ai_scores: expected JSON array, got %s", type(parsed))
        return []
    return parsed


async def fetch_scores_via_web_search() -> list[dict]:
    """Use Anthropic web search + structured tool to get all World Cup 2026 results."""
    import anthropic

    today = date.today().strftime("%B %d, %Y")
    team_list_str = ", ".join(TEAM_LIST)

    # Define a custom tool Claude must call to submit structured results — this
    # guarantees structured JSON output without any text parsing.
    submit_tool = {
        "name": "submit_match_results",
        "description": "Submit all completed World Cup 2026 match results as structured data",
        "input_schema": {
            "type": "object",
            "properties": {
                "matches": {
                    "type": "array",
                    "description": "All completed matches with confirmed final scores",
                    "items": {
                        "type": "object",
                        "properties": {
                            "home_team": {"type": "string"},
                            "away_team": {"type": "string"},
                            "home_score": {"type": "integer"},
                            "away_score": {"type": "integer"},
                        },
                        "required": ["home_team", "away_team", "home_score", "away_score"],
                    },
                }
            },
            "required": ["matches"],
        },
    }

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            tools=[
                {"type": "web_search_20250305", "name": "web_search"},
                submit_tool,
            ],
            messages=[{
                "role": "user",
                "content": (
                    f"Today is {today}. Search the web for ALL FIFA World Cup 2026 match results "
                    f"that have been played so far (from June 11 2026 up to and including today). "
                    f"Include every completed match from the group stage and any knockout rounds. "
                    f"After searching, call submit_match_results with all the completed match data you found. "
                    f"Only include fully finished matches with confirmed scores. "
                    f"For team names, use the closest match from this list: {team_list_str}"
                ),
            }],
        )

        # Look for our custom tool_use call in the response content
        for block in response.content:
            if block.type == "tool_use" and block.name == "submit_match_results":
                matches = block.input.get("matches", [])
                logger.info("ai_scores web_search: found %d matches via structured tool", len(matches))
                return matches

        # Fallback: if Claude didn't call the tool, try parsing any text blocks
        text_blocks = [b for b in response.content if b.type == "text"]
        if text_blocks:
            raw_text = text_blocks[-1].text
            logger.warning("ai_scores web_search: no tool call found, trying text parse. Text: %s", raw_text[:300])
            return _parse_json_response(raw_text)

        logger.warning("ai_scores web_search: no usable content in response")
        return []

    except Exception as exc:
        logger.warning("ai_scores web_search error: %s: %s", type(exc).__name__, exc)
        return []


async def extract_scores_from_image(image_data: bytes, media_type: str) -> list[dict]:
    """Use Anthropic vision to extract scores from an uploaded image."""
    import anthropic

    image_b64 = base64.standard_b64encode(image_data).decode("utf-8")
    team_list_str = ", ".join(TEAM_LIST)

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"""This image shows FIFA World Cup 2026 match scores. \
Extract all visible COMPLETED match scores. \
Return ONLY a JSON array, no other text, no markdown fences:
[
  {{"home_team": "Team Name", "away_team": "Team Name", "home_score": 0, "away_score": 0}}
]

Only include matches where:
- Both team names are clearly visible
- Both scores are clearly visible
- The match is finished (not in progress)

Match team names as closely as possible to this list:
{team_list_str}

If no completed scores are visible, return: []""",
                    },
                ],
            }]
        )

        text_blocks = [b for b in response.content if b.type == "text"]
        if not text_blocks:
            logger.warning("ai_scores image: no text blocks in response")
            return []

        raw_text = text_blocks[-1].text
        logger.info("ai_scores image raw response: %s", raw_text[:200])
        return _parse_json_response(raw_text)

    except Exception as exc:
        logger.warning("ai_scores image error: %s", exc)
        return []


def apply_scores_to_db(db: Session, scores: list[dict]) -> dict:
    """Apply a list of extracted scores to the database and recalculate standings."""
    from app.api.routes.matches import _recalculate_standings

    updated: list[str] = []
    skipped: list[str] = []
    not_found: list[str] = []
    groups_to_recalc: set = set()

    for score in scores:
        home_name = _normalise_team_name(score.get("home_team", ""))
        away_name = _normalise_team_name(score.get("away_team", ""))
        home_score = score.get("home_score")
        away_score = score.get("away_score")

        if not home_name or not away_name or home_score is None or away_score is None:
            logger.warning("ai_scores: incomplete score dict: %s", score)
            not_found.append(f"{home_name or '?'} vs {away_name or '?'}")
            continue

        try:
            home_score = int(home_score)
            away_score = int(away_score)
        except (TypeError, ValueError):
            logger.warning("ai_scores: invalid score values: %s", score)
            not_found.append(f"{home_name} vs {away_name}")
            continue

        home_team = db.query(Team).filter(Team.name.ilike(f"%{home_name}%")).first()
        if not home_team:
            logger.warning("ai_scores: home team not found: %r", home_name)
            not_found.append(f"{home_name} vs {away_name}")
            continue

        away_team = db.query(Team).filter(Team.name.ilike(f"%{away_name}%")).first()
        if not away_team:
            logger.warning("ai_scores: away team not found: %r", away_name)
            not_found.append(f"{home_name} vs {away_name}")
            continue

        match = (
            db.query(Match)
            .filter(
                Match.home_team_id == home_team.id,
                Match.away_team_id == away_team.id,
            )
            .first()
        )
        if not match:
            logger.warning("ai_scores: match not found: %r vs %r", home_name, away_name)
            not_found.append(f"{home_name} vs {away_name}")
            continue

        label = f"{home_name} {home_score}–{away_score} {away_name}"

        if match.home_score == home_score and match.away_score == away_score:
            skipped.append(label)
            # Still recalc in case standings are stale
            if match.group_id:
                groups_to_recalc.add(match.group_id)
            continue

        match.home_score = home_score
        match.away_score = away_score
        match.is_completed = True
        db.commit()

        if match.group_id:
            groups_to_recalc.add(match.group_id)

        updated.append(label)
        logger.info("ai_scores: updated %s", label)

    for group_id in groups_to_recalc:
        _recalculate_standings(group_id, db)

    logger.info(
        "ai_scores apply: updated=%d skipped=%d not_found=%d",
        len(updated), len(skipped), len(not_found),
    )

    return {
        "updated": updated,
        "skipped": skipped,
        "not_found": not_found,
        "total_extracted": len(scores),
    }

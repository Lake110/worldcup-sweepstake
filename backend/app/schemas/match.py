from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.match import MatchStage
from app.schemas.team import TeamOut


class MatchCreate(BaseModel):
    home_team_id: UUID | None = None
    away_team_id: UUID | None = None
    stage: MatchStage
    match_date: datetime | None = None
    group_id: UUID | None = None


class MatchUpdate(BaseModel):
    home_score: int | None = None
    away_score: int | None = None
    is_completed: bool | None = None


class MatchOut(BaseModel):
    id: UUID
    stage: MatchStage
    home_score: int | None
    away_score: int | None
    is_completed: bool
    match_date: datetime | None
    home_team: TeamOut | None
    away_team: TeamOut | None
    model_config = {"from_attributes": True}

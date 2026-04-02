from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.models.sweepstake import ScoringMethod
from app.schemas.team import TeamOut

class SweepstakeCreate(BaseModel):
    name: str
    max_participants: int = 8
    teams_per_person: int = 2
    scoring_method: ScoringMethod = ScoringMethod.total
    pts_round_of_32: int = 1
    pts_round_of_16: int = 2
    pts_quarter_final: int = 4
    pts_semi_final: int = 8
    pts_final: int = 12
    pts_winner: int = 20

class SweepstakeOut(BaseModel):
    id: UUID
    name: str
    max_participants: int
    teams_per_person: int
    scoring_method: ScoringMethod
    is_locked: bool
    invite_code: str
    pts_round_of_32: int
    pts_round_of_16: int
    pts_quarter_final: int
    pts_semi_final: int
    pts_final: int
    pts_winner: int
    created_at: datetime
    model_config = {"from_attributes": True}

class ParticipantOut(BaseModel):
    id: UUID
    user_id: UUID
    sweepstake_id: UUID
    teams: list[TeamOut] = []
    model_config = {"from_attributes": True}

class LeaderboardEntry(BaseModel):
    participant_id: UUID
    user_name: str | None
    teams: list[TeamOut]
    total_points: int
    position: int
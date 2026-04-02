from pydantic import BaseModel, computed_field
from uuid import UUID
from app.schemas.team import TeamOut

class StandingOut(BaseModel):
    id: UUID
    team: TeamOut
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    points: int

    @computed_field
    @property
    def goal_difference(self) -> int:
        return self.goals_for - self.goals_against

    model_config = {"from_attributes": True}
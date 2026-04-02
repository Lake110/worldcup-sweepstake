from pydantic import BaseModel
from uuid import UUID
from app.schemas.team import TeamOut

class GroupOut(BaseModel):
    id: UUID
    name: str
    members: list[TeamOut] = []
    model_config = {"from_attributes": True}

class GroupWithStandings(BaseModel):
    id: UUID
    name: str
    members: list[TeamOut] = []
    model_config = {"from_attributes": True}
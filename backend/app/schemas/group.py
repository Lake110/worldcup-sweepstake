from pydantic import BaseModel
from uuid import UUID
from app.schemas.team import TeamOut

class GroupMemberOut(BaseModel):
    team: TeamOut
    model_config = {"from_attributes": True}

class GroupOut(BaseModel):
    id: UUID
    name: str
    members: list[GroupMemberOut] = []
    model_config = {"from_attributes": True}
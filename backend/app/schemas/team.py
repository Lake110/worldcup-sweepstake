from uuid import UUID

from pydantic import BaseModel


class TeamBase(BaseModel):
    name: str
    code: str
    flag_emoji: str | None = None
    confederation: str
    fifa_ranking: int
    latitude: float | None = None
    longitude: float | None = None


class TeamCreate(TeamBase):
    pass


class TeamOut(TeamBase):
    id: UUID
    model_config = {"from_attributes": True}

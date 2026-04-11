from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None
    is_admin: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

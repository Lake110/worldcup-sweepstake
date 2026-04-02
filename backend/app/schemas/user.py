from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None
    created_at: datetime
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
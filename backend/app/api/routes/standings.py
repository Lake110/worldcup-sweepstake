from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_optional_user
from app.db.database import get_db
from app.models.group import Group
from app.models.standing import Standing
from app.models.user import User
from app.schemas.standing import StandingOut

router = APIRouter()


@router.get("/")
async def list_standings(
    source: str | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    if source == "api":
        from app.services.football_api import fetch_standings
        if current_user is None:
            raise HTTPException(401, "Authentication required")
        if not current_user.is_admin:
            raise HTTPException(403, "Admin access required")
        return await fetch_standings()
    return [StandingOut.model_validate(s) for s in db.query(Standing).all()]


@router.get("/group/{group_id}", response_model=list[StandingOut])
def group_standings(group_id: UUID, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")
    return (
        db.query(Standing)
        .filter(Standing.group_id == group_id)
        .order_by(Standing.points.desc())
        .all()
    )

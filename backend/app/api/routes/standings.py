from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.group import Group
from app.models.standing import Standing
from app.schemas.standing import StandingOut

router = APIRouter()


@router.get("/", response_model=list[StandingOut])
def list_standings(db: Session = Depends(get_db)):
    return db.query(Standing).all()


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

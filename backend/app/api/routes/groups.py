from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.database import get_db
from app.models.group import Group
from app.schemas.group import GroupOut

router = APIRouter()

@router.get("/", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db)):
    return db.query(Group).order_by(Group.name).all()

@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: UUID, db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")
    return group
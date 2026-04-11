from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.group import Group, GroupMember
from app.schemas.group import GroupOut

router = APIRouter()


@router.get("/", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db)):
    return (
        db.query(Group)
        .options(joinedload(Group.members).joinedload(GroupMember.team))
        .order_by(Group.name)
        .all()
    )


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: UUID, db: Session = Depends(get_db)):
    group = (
        db.query(Group)
        .options(joinedload(Group.members).joinedload(GroupMember.team))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(404, "Group not found")
    return group

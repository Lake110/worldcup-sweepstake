from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.database import get_db
from app.models.team import Team
from app.schemas.team import TeamOut

router = APIRouter()

@router.get("/", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db)):
    return db.query(Team).order_by(Team.fifa_ranking).all()

@router.get("/{team_id}", response_model=TeamOut)
def get_team(team_id: UUID, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(404, "Team not found")
    return team
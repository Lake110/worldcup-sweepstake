from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.team import Team
from app.schemas.team import TeamCreate, TeamOut

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

@router.post("/", response_model=TeamOut, status_code=201)
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    team = Team(**data.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team
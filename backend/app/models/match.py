from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from app.models.base import Base

class MatchStage(str, enum.Enum):
    group       = "group"
    round_of_32 = "round_of_32"    # new in 2026 — 48 teams means extra round
    round_of_16 = "round_of_16"
    quarter_final = "quarter_final"
    semi_final  = "semi_final"
    third_place = "third_place"
    final       = "final"

class Match(Base):
    __tablename__ = "matches"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id     = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)  # null for knockouts
    home_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)   # null before draw
    away_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    home_score   = Column(Integer, nullable=True)   # null = not played yet
    away_score   = Column(Integer, nullable=True)
    stage        = Column(SAEnum(MatchStage), nullable=False)
    match_date   = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    group     = relationship("Group", back_populates="matches")
    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_matches")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_matches")
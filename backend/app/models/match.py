import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class MatchStage(str, enum.Enum):
    group = "group"
    round_of_32 = "round_of_32"
    round_of_16 = "round_of_16"
    quarter_final = "quarter_final"
    semi_final = "semi_final"
    third_place = "third_place"
    final = "final"


class Match(Base):
    __tablename__ = "matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    home_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    away_team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    stage = Column(SAEnum(MatchStage), nullable=False)
    match_date = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Points to the match the winner of this match advances to.
    # null for the Final and 3rd place match (no next match).
    next_match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=True)

    # Which slot does the winner fill in the next match? "home" or "away"
    next_match_slot = Column(String, nullable=True)

    group = relationship("Group", back_populates="matches")
    home_team = relationship(
        "Team", foreign_keys=[home_team_id], back_populates="home_matches"
    )
    away_team = relationship(
        "Team", foreign_keys=[away_team_id], back_populates="away_matches"
    )

    # Self-referential relationship — lets us do match.next_match to get the Match object
    next_match = relationship(
        "Match", foreign_keys=[next_match_id], remote_side="Match.id"
    )

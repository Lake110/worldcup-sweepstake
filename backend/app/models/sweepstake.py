from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, func, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from app.models.base import Base

class ScoringMethod(str, enum.Enum):
    total   = "total"    # add up all team scores
    average = "average"  # average across teams
    best    = "best"     # only your best team counts

class Sweepstake(Base):
    __tablename__ = "sweepstakes"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name             = Column(String, nullable=False)
    owner_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    max_participants = Column(Integer, nullable=False, default=8)
    teams_per_person = Column(Integer, nullable=False, default=2)
    scoring_method   = Column(SAEnum(ScoringMethod), default=ScoringMethod.total)
    is_locked        = Column(Boolean, default=False)  # locked after draw happens
    invite_code      = Column(String, unique=True, nullable=False)  # share this to join
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Bonus point values (configurable per sweepstake)
    pts_round_of_32    = Column(Integer, default=1)
    pts_round_of_16    = Column(Integer, default=2)
    pts_quarter_final  = Column(Integer, default=4)
    pts_semi_final     = Column(Integer, default=8)
    pts_final          = Column(Integer, default=12)
    pts_winner         = Column(Integer, default=20)

    owner        = relationship("User", foreign_keys=[owner_id])
    participants = relationship("Participant", back_populates="sweepstake", cascade="all, delete")


class Participant(Base):
    __tablename__ = "participants"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sweepstake_id  = Column(UUID(as_uuid=True), ForeignKey("sweepstakes.id"), nullable=False)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    sweepstake  = relationship("Sweepstake", back_populates="participants")
    user        = relationship("User", back_populates="participations")
    assignments = relationship("TeamAssignment", back_populates="participant", cascade="all, delete")


class TeamAssignment(Base):
    __tablename__ = "team_assignments"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("participants.id"), nullable=False)
    team_id        = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    participant = relationship("Participant", back_populates="assignments")
    team        = relationship("Team", back_populates="assignments")
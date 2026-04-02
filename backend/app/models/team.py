from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base

class Team(Base):
    __tablename__ = "teams"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name         = Column(String, nullable=False, unique=True)
    code         = Column(String(3), nullable=False, unique=True)  # e.g. ENG, BRA, FRA
    flag_emoji   = Column(String, nullable=True)                   # e.g. 🏴󠁧󠁢󠁥󠁮󠁧󠁿
    confederation = Column(String, nullable=False)                  # UEFA, CONMEBOL, etc.
    fifa_ranking = Column(Integer, nullable=False)                  # used for weighted draw
    latitude     = Column(Float, nullable=True)                    # for Leaflet map
    longitude    = Column(Float, nullable=True)                    # for Leaflet map

    # Relationships
    group_memberships = relationship("GroupMember", back_populates="team")
    home_matches      = relationship("Match", foreign_keys="Match.home_team_id", back_populates="home_team")
    away_matches      = relationship("Match", foreign_keys="Match.away_team_id", back_populates="away_team")
    standings         = relationship("Standing", back_populates="team")
    assignments       = relationship("TeamAssignment", back_populates="team")
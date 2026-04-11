import uuid

from sqlalchemy import Boolean, Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    # New: is_admin flag — False for all normal users, True for the admin account
    # seeded in seed.py. Used to gate the match results admin page.
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # A user can be a participant in many sweepstakes
    participations = relationship(
        "Participant", back_populates="user", cascade="all, delete"
    )

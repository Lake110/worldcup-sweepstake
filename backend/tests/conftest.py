import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import get_db
from app.models.base import Base
# Import all models so SQLAlchemy can resolve string relationships
import app.models.user
import app.models.team
import app.models.group
import app.models.match
import app.models.standing
import app.models.sweepstake

# IMPORTANT: Always use a dedicated test DB, never worldcupdb
# This prevents test teardown from wiping production seed data
import os as _os
# In Docker: DATABASE_URL points to db:5432/worldcupdb — swap to worldcupdb_test
# In CI: DATABASE_URL already points to postgres:5432/worldcupdb_test
_base_url = _os.getenv("DATABASE_URL", "postgresql://worldcup:worldcup123@db:5432/worldcupdb")
TEST_DATABASE_URL = _os.getenv("TEST_DATABASE_URL", _base_url.rsplit("/", 1)[0] + "/worldcupdb_test")

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()

@pytest.fixture
def client(db):
    from app.main import app
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers(client):
    import uuid
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "password123",
        "full_name": "Test User"
    })
    res = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "password123"
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
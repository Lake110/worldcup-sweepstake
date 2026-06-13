import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import auth, groups, matches, standings, sweepstakes, teams, users
from app.api.routes import sync as sync_router
from app.api.routes import knockout as knockout_router
from app.db.database import SessionLocal, engine
from app.db.seed import run_seed
from app.models import base

base.Base.metadata.create_all(bind=engine)

# Idempotent schema migrations (no Alembic in this project)
_db = SessionLocal()
try:
    _db.execute(text(
        "ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team_id UUID REFERENCES teams(id)"
    ))
    _db.commit()
    run_seed(_db)
finally:
    _db.close()

app = FastAPI(title="World Cup Sweepstake API", version="1.0.0")

origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(sweepstakes.router, prefix="/api/sweepstakes", tags=["sweepstakes"])
app.include_router(standings.router, prefix="/api/standings", tags=["standings"])
app.include_router(sync_router.router, prefix="/api/sync", tags=["sync"])
app.include_router(knockout_router.router, prefix="/api/knockout", tags=["knockout"])


@app.get("/health")
def health():
    return {"status": "ok"}

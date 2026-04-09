import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, users, teams, groups, matches, sweepstakes, standings
from app.db.database import engine, SessionLocal
from app.db.seed import run_seed
from app.models import base


base.Base.metadata.create_all(bind=engine)

# Run seed on startup
db = SessionLocal()
try:
    run_seed(db)
finally:
    db.close()

app = FastAPI(title="World Cup Sweepstake API", version="1.0.0")

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["auth"])
app.include_router(users.router,       prefix="/api/users",       tags=["users"])
app.include_router(teams.router,       prefix="/api/teams",       tags=["teams"])
app.include_router(groups.router,      prefix="/api/groups",      tags=["groups"])
app.include_router(matches.router,     prefix="/api/matches",     tags=["matches"])
app.include_router(sweepstakes.router, prefix="/api/sweepstakes", tags=["sweepstakes"])
app.include_router(standings.router,   prefix="/api/standings",   tags=["standings"])

@app.get("/health")
def health():
    return {"status": "ok"}

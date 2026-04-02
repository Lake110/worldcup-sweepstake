from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, users, teams, groups, matches, sweepstakes, standings
from app.db.database import engine
from app.models import base

base.Base.metadata.create_all(bind=engine)

app = FastAPI(title="World Cup Sweepstake API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
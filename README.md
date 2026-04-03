# World Cup 2026 Sweepstake

A full-stack web app for running a World Cup 2026 sweepstake with tournament visualisation.

> **To resume development:** paste this README into a new Claude chat and say "here is my project README, please read it before we continue"

---

## Who I am
- Developer: Michael (GitLab: mlake3244414)
- Learning full stack development via Makers bootcamp
- Experience: Java/Spring Boot, Flask, FastAPI, React

---

## What we are building
A World Cup 2026 sweepstake app where users can:
- View the full tournament — all 48 teams, 12 groups, standings
- Create a sweepstake room, invite friends, run a weighted random draw
- Track points as the tournament progresses
- View all 48 teams on an interactive Leaflet world map

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.12) |
| Frontend | React + TypeScript + Tailwind CSS |
| Database | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT tokens + bcrypt |
| Maps | Leaflet + react-leaflet |
| Data fetching | React Query |
| State management | Zustand |
| HTTP client | Axios |
| Dev environment | Docker Compose |
| IDE | VS Code |
| Repo | GitLab — https://gitlab.com/mlake3244414/Worldcup_26.git |

---

## Project structure
```
worldcup-sweepstake/
├── docker-compose.yml
├── .env                          # gitignored — never on GitLab
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py               # FastAPI app + seed on startup
│       ├── api/routes/
│       │   ├── auth.py           # POST /api/auth/register, /api/auth/login
│       │   ├── users.py          # GET /api/users/me
│       │   ├── teams.py          # GET /api/teams/ (read only — seeded)
│       │   ├── groups.py         # GET /api/groups/ (with nested teams)
│       │   ├── matches.py        # GET/POST/PATCH /api/matches/
│       │   ├── sweepstakes.py    # GET/POST /api/sweepstakes/ + draw + join
│       │   └── standings.py      # GET /api/standings/
│       ├── core/
│       │   ├── config.py         # reads .env
│       │   ├── security.py       # bcrypt + JWT
│       │   └── deps.py           # get_current_user bouncer
│       ├── db/
│       │   ├── database.py       # SQLAlchemy engine + session
│       │   └── seed.py           # all 48 teams + 12 groups seeded on startup
│       ├── models/
│       │   ├── user.py
│       │   ├── team.py           # 48 teams with FIFA ranking + lat/lng
│       │   ├── group.py          # 12 groups + GroupMember join table
│       │   ├── match.py          # matches with MatchStage enum
│       │   ├── sweepstake.py     # Sweepstake + Participant + TeamAssignment
│       │   └── standing.py       # P W D L GF GA GD Pts per team per group
│       └── schemas/
│           ├── user.py
│           ├── team.py
│           ├── group.py          # GroupMemberOut wraps TeamOut
│           ├── match.py
│           ├── sweepstake.py     # includes LeaderboardEntry
│           └── standing.py       # computed goal_difference field
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── main.tsx              # QueryClientProvider + BrowserRouter
        ├── App.tsx               # Routes + PrivateRoute guard
        ├── store/authStore.ts    # Zustand auth (persisted)
        ├── services/api.ts       # Axios + JWT interceptor
        ├── components/layout/Layout.tsx
        └── pages/
            ├── Dashboard.tsx     # ✅ Countdown, stats, opening match, bracket overview
            ├── Tournament.tsx    # ✅ Groups tab + All Teams tab with search/filter
            ├── Sweepstake.tsx    # 🔲 Stub
            └── Map.tsx           # 🔲 Stub
```

---

## Environment variables (.env)
```
POSTGRES_USER=worldcup
POSTGRES_PASSWORD=worldcup123
POSTGRES_DB=worldcupdb
SECRET_KEY=change-me-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ENVIRONMENT=development
```

---

## Docker services & ports

| Service | Container | External port |
|---|---|---|
| PostgreSQL 16 | worldcup_db | 5433 |
| FastAPI backend | worldcup_backend | 8001 |
| React frontend | worldcup_frontend | 5174 |

Note: ports are offset by 1 so both this and the finance app can run simultaneously.

---

## Key URLs when Docker is running

- Frontend: http://localhost:5174
- API docs: http://localhost:8001/docs
- Health check: http://localhost:8001/health

---

## Daily workflow
```bash
cd ~/projects/worldcup-sweepstake
docker compose up
# make changes — hot reload is on for both frontend and backend
docker compose down

git add .
git commit -m "describe what you built"
git push origin main
```

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Register + returns JWT |
| POST | /api/auth/login | No | Login + returns JWT |
| GET | /api/users/me | Yes | Current user |
| GET | /api/teams/ | No | All 48 teams ordered by FIFA ranking |
| GET | /api/groups/ | No | All 12 groups with nested team data |
| GET | /api/matches/ | No | All matches (filterable by stage) |
| PATCH | /api/matches/{id}/result | Yes | Update match score + recalculate standings |
| GET | /api/standings/ | No | All standings |
| GET | /api/standings/group/{id} | No | Standings for one group |
| POST | /api/sweepstakes/ | Yes | Create sweepstake room |
| GET | /api/sweepstakes/ | Yes | List your sweepstakes |
| POST | /api/sweepstakes/join/{code} | Yes | Join via invite code |
| POST | /api/sweepstakes/{id}/draw | Yes | Run weighted random draw |

---

## Tournament data

- **48 teams** seeded with FIFA rankings, flag emojis, lat/lng coordinates
- **12 groups** (A–L) with official 2026 draw assignments
- **Tournament dates:** June 11 – July 19, 2026
- **Opening match:** Mexico vs South Africa, Estadio Azteca, Mexico City
- **Format:** 12 groups → Round of 32 → R16 → QF → SF → Final

## Known issues / fixes applied

- `bcrypt==4.0.1` pinned in requirements.txt to fix passlib compatibility
- `email-validator==2.2.0` added to requirements.txt
- `ForeignKey` import missing from group.py — fixed
- `joinedload` must use class attributes not strings in SQLAlchemy 2.0
- Backend on port 8001, frontend on 5174 to avoid clash with finance app

---

## Current status

✅ Full backend running — all endpoints verified  
✅ All 48 teams seeded and confirmed correct  
✅ All 12 groups seeded with official draw assignments  
✅ Auth working — register + login + JWT  
✅ Dashboard page — countdown, stats, opening match, toughest group, bracket overview  
✅ Tournament page — groups view with standings tables + teams view with search/filter  
🔲 Sweepstake page — stub, not built yet  
🔲 Map page — stub, Leaflet not integrated yet  
🔲 Knockout bracket — placeholder only, needs proper visual bracket  
🔲 Match results — endpoints exist, no UI yet  

---

## What to build next

1. **Map page** — Leaflet map with 48 pins, click for team popup
2. **Sweepstake page** — create room, invite code, run weighted draw
3. **Match results UI** — enter scores, watch standings update
4. **Proper knockout bracket** — winners feeding into next round visually

---

Future feature — Upset bonus: If a team ranked significantly lower beats a higher ranked team, they earn bonus points. Could be configurable per sweepstake (e.g. "upset bonus: +5 points if you beat a team ranked 15+ places above you").

---

## Notes for Claude
- Michael is learning — always explain what code does and why
- Compare FastAPI to Spring Boot MVC where helpful (he has Java background)
- Compare to Flask where relevant (his Makers bootcamp framework)
- Build one file at a time, explain before moving on
- Always provide learning notes after each section in Notion-friendly format
- Remind him to commit to GitLab at natural stopping points
- When picking back up: `cd ~/projects/worldcup-sweepstake && docker compose up`
- Both projects run simultaneously — finance app on :5173/:8000, worldcup on :5174/:8001
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
- See a full mirrored knockout bracket with group colour coding

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
| Visualisation | D3.js (bracket curves) |
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
│       │   ├── sweepstakes.py    # GET/POST /api/sweepstakes/ + draw + join + leaderboard
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
        ├── main.tsx
        ├── App.tsx
        ├── index.css             # group-A through group-L permanent CSS classes
        ├── store/authStore.ts
        ├── services/api.ts
        ├── components/
        │   ├── layout/Layout.tsx          # desktop sidebar + mobile hamburger nav
        │   └── tournament/BracketView.tsx # reusable D3 bracket component
        └── pages/
            ├── Dashboard.tsx     # countdown, stats, opening match, toughest group
            ├── Tournament.tsx    # Groups / All Teams / Bracket tabs
            ├── Sweepstake.tsx    # list, create, room (Leaderboard/Participants/Groups/Bracket tabs)
            └── Map.tsx           # stub
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

Note: ports are offset so both this and the finance app can run simultaneously.

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
# make changes — hot reload on both services

# Feature branch workflow (new features only go via branches)
git checkout -b feature/my-feature-name
git add .
git commit -m "describe what you built"
git push origin feature/my-feature-name
# Create merge request on GitLab → CI runs → merge to main

# Hotfixes can go straight to main
git checkout main
git add .
git commit -m "fix: description"
git push origin main
```

---

## Branch naming convention
```
feature/bracket-in-sweepstake    # new features
fix/mobile-overflow              # bug fixes
chore/update-dependencies        # maintenance
test/add-sweepstake-tests        # adding tests
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
| POST | /api/sweepstakes/{id}/draw | Yes | Run tiered weighted draw |
| GET | /api/sweepstakes/{id}/participants/ | Yes | Participants with team assignments |
| GET | /api/sweepstakes/{id}/leaderboard/ | Yes | Ranked leaderboard with points |

---

## Tournament data

- **48 teams** seeded with FIFA rankings, flag emojis, lat/lng coordinates
- **12 groups** (A–L) with official 2026 draw assignments
- **Tournament dates:** June 11 – July 19, 2026
- **Opening match:** Mexico vs South Africa, Estadio Azteca, Mexico City
- **Format:** 12 groups → Round of 32 → R16 → QF → SF → Final
- **Draw algorithm:** Tiered — Slot 1 from top 10, Slot 2 from top 20, etc.

---

## Known issues / fixes applied

- `bcrypt==4.0.1` pinned — passlib compatibility
- `email-validator==2.2.0` added
- `ForeignKey` import missing from group.py — fixed
- `joinedload` must use class attributes not strings (SQLAlchemy 2.0)
- Backend on port 8001, frontend on 5174 to avoid clash with finance app
- D3 installed manually in container: `docker compose exec frontend npm install d3 @types/d3 --save`
- Group colours I/J/K/L defined as permanent CSS classes in index.css to avoid Tailwind purging

---

## Current status

✅ Full backend running — all endpoints verified  
✅ All 48 teams seeded and confirmed correct  
✅ All 12 groups seeded with official draw assignments  
✅ Auth working — register + login + JWT  
✅ Dashboard — countdown, stats, opening match, toughest group, confederation breakdown  
✅ Tournament page — Groups / All Teams / Bracket tabs  
✅ Sweepstake page — create, join, tiered draw, leaderboard, participants, groups, bracket tabs  
✅ Participant names showing throughout sweepstake room  
✅ Waiting room shows who has joined before draw runs  
✅ Mobile navbar — hamburger menu with slide-in panel  
✅ Knockout bracket — mirrored D3 curved lines, all 12 group colours, fits screen  
✅ BracketView — reusable component used in both Tournament and Sweepstake pages  
✅ Group colours — permanent CSS classes (group-A through group-L) in index.css  
🔲 Admin user system — is_admin flag on User model  
🔲 Match results UI — admin-only page to enter scores  
🔲 Standings update — recalculate after each result  
🔲 Mobile polish — all pages need responsive fixes  
🔲 Map page — stub, Leaflet not integrated yet  
🔲 CI/CD pipeline — .gitlab-ci.yml not yet created  
🔲 Backend tests — pytest for auth, teams, sweepstakes  
🔲 Frontend tests — Vitest + Playwright end-to-end  

---

## What to build next session

### Priority 1 — Admin + Match Results
1. Add `is_admin` flag to User model
2. Create first admin user via seed or Postman
3. Seed all 144 group stage matches
4. Build admin match results page — list matches, enter scores
5. Wire up standings recalculation after each result
6. Sweepstake leaderboard updates with live points

### Priority 2 — CI/CD and Tests
1. Create feature branch: `git checkout -b feature/ci-pipeline-and-tests`
2. Add `.gitlab-ci.yml` — runs pytest on every push
3. Add pytest tests for auth, teams, sweepstakes endpoints
4. Add Playwright end-to-end tests for critical user journeys
5. Set up GitLab branch protection — force merge requests

### Priority 3 — Polish
1. Mobile polish — fix all pages for small screens
2. Map page — Leaflet map with 48 pins
3. Bracket on Dashboard — replace placeholder

---

## Branch strategy (to implement next session)

All new features go via feature branches:
```bash
git checkout -b feature/admin-match-results
# build feature
git push origin feature/admin-match-results
# create merge request on GitLab → CI runs → merge to main
```

Naming convention:
- `feature/` — new features
- `fix/` — bug fixes  
- `chore/` — maintenance
- `test/` — adding tests
---

## Future features (backlog)

- Upset bonus points — configurable per sweepstake
- Live standings — points update as match results are entered
- Push notifications — alert when your team plays
- Public sweepstake rooms — joinable without invite code
- Tournament history — past World Cups

---

## Notes for Claude
- Michael is learning — always explain what code does and why
- Compare FastAPI to Spring Boot MVC where helpful (Java background)
- Compare to Flask where relevant (Makers bootcamp framework)
- Build one file at a time, explain before moving on
- Always provide learning notes after each section in Notion-friendly format
- Remind to commit at natural stopping points
- When picking back up: `cd ~/projects/worldcup-sweepstake && docker compose up`
- Both projects run simultaneously — finance app :5173/:8000, worldcup :5174/:8001
- Next session starts with CI/CD pipeline setup, then Playwright tests
- All new features should use feature branches from now on

---

What was completed tonight:
✅ CI/CD pipeline running on GitLab
✅ pytest backend tests — all passing
✅ Branch protection on main
✅ Quick draw backend — model, schema, routes
✅ d3 baked into frontend Dockerfile
Next session — pick up with:

Quick draw frontend UI in Sweepstake.tsx
Toggle between Account mode and Quick draw mode
Name input fields for quick draw
Share link page after draw
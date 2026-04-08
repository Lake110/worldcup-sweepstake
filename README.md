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
- Run a quick draw — no accounts needed, just enter names and go
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
worldcup-sweepstake/
├── docker-compose.yml
├── .env                          # gitignored — never on GitLab
├── .gitignore
├── .gitlab-ci.yml                # CI pipeline — runs pytest on every push
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
│       │   └── deps.py           # get_current_user + get_admin_user
│       ├── db/
│       │   ├── database.py       # SQLAlchemy engine + session
│       │   └── seed.py           # teams, groups, standings, 72 matches, admin user
│       ├── models/
│       │   ├── user.py           # is_admin flag added
│       │   ├── team.py           # 48 teams with FIFA ranking + lat/lng
│       │   ├── group.py          # 12 groups + GroupMember join table
│       │   ├── match.py          # matches with MatchStage enum
│       │   ├── sweepstake.py     # Sweepstake + Participant + TeamAssignment
│       │   └── standing.py       # P W D L GF GA GD Pts per team per group
│       └── schemas/
│           ├── user.py           # UserOut includes is_admin
│           ├── team.py
│           ├── group.py          # GroupMemberOut wraps TeamOut
│           ├── match.py
│           ├── sweepstake.py     # includes LeaderboardEntry
│           └── standing.py       # computed goal_difference field
└── frontend/
    ├── Dockerfile                # includes d3 + @types/d3 baked in
    ├── package.json
    └── src/
        ├── main.tsx
        ├── App.tsx               # AdminRoute guard added
        ├── index.css             # group-A through group-L permanent CSS classes
        ├── store/authStore.ts    # is_admin added to User interface
        ├── services/api.ts
        ├── components/
        │   ├── layout/Layout.tsx          # admin nav link shown to admin users only
        │   └── tournament/BracketView.tsx # reusable D3 bracket component
        └── pages/
            ├── Dashboard.tsx     # countdown, stats, opening match, toughest group
            ├── Tournament.tsx    # Groups / All Teams / Bracket tabs
            ├── Sweepstake.tsx    # list, create, room, quick draw mode
            ├── Admin.tsx         # match results — group tabs, score entry, standings recalc
            └── Map.tsx           # stub

---

## Environment variables (.env)
POSTGRES_USER=worldcup
POSTGRES_PASSWORD=worldcup123
POSTGRES_DB=worldcupdb
SECRET_KEY=change-me-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ENVIRONMENT=development

---

## Docker services & ports

| Service | Container | External port |
|---|---|---|
| PostgreSQL 16 | worldcup_db | 5433 |
| FastAPI backend | worldcup_backend | 8001 |
| React frontend | worldcup_frontend | 5174 |

Note: ports are offset so both this and the finance app can run simultaneously.
Service names for docker compose exec are: `db`, `backend`, `frontend`

---

## Key URLs when Docker is running

- Frontend: http://localhost:5174
- API docs: http://localhost:8001/docs
- Health check: http://localhost:8001/health

---

## Admin credentials
- Email: `admin@worldcup-sweepstake.com`
- Password: `admin1234`
- The admin nav link (🔧 Admin) only appears when logged in as admin

---

## Daily workflow
```bash
cd ~/projects/worldcup-sweepstake
docker compose up -d   # run in background
docker compose logs backend --tail=30  # check seed output

# Feature branch workflow
git checkout -b feature/my-feature-name
git add .
git commit -m "describe what you built"
git push origin feature/my-feature-name
# Create merge request on GitLab → CI runs → merge to main

# After merging, sync local main:
git checkout main
git pull
```

---

## Branch naming convention
feature/bracket-in-sweepstake    # new features
fix/mobile-overflow              # bug fixes
chore/update-dependencies        # maintenance
test/add-sweepstake-tests        # adding tests

---

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Register + returns JWT |
| POST | /api/auth/login | No | Login + returns JWT |
| GET | /api/users/me | Yes | Current user |
| GET | /api/teams/ | No | All 48 teams ordered by FIFA ranking |
| GET | /api/groups/ | No | All 12 groups with nested team data |
| GET | /api/matches/ | No | All matches (filterable by stage, group_id) |
| PATCH | /api/matches/{id}/result | Admin | Update match score + recalculate standings from scratch |
| GET | /api/standings/ | No | All standings |
| GET | /api/standings/group/{id} | No | Standings for one group |
| POST | /api/sweepstakes/ | Yes | Create sweepstake room (account or quick draw) |
| GET | /api/sweepstakes/ | Yes | List your sweepstakes + owned quick draws |
| POST | /api/sweepstakes/join/{code} | Yes | Join via invite code |
| POST | /api/sweepstakes/{id}/draw | Yes | Run tiered weighted draw |
| GET | /api/sweepstakes/{id}/participants/ | Yes | Participants with team assignments |
| GET | /api/sweepstakes/{id}/leaderboard/ | Yes | Ranked leaderboard — accepts ?scoring_method=total\|average\|best |
| GET | /api/sweepstakes/share/{invite_code} | No | Public read-only draw results |

---

## Tournament data

- **48 teams** seeded with FIFA rankings, flag emojis, lat/lng coordinates
- **12 groups** (A–L) with official 2026 draw assignments
- **72 group stage matches** seeded (6 per group × 12 groups)
- **48 standing rows** seeded (one per team per group, all zeros until results entered)
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
- D3 baked into frontend Dockerfile — no manual install needed
- Group colours I/J/K/L defined as permanent CSS classes in index.css to avoid Tailwind purging
- Quick draw participants use guest_name (no user_id) — leaderboard and participants endpoints handle both
- Leaderboard scoring toggle re-fetches with ?scoring_method= query param
- Race condition fixed in handleQuickDraw — participants set directly from draw response, not re-fetched
- Admin email must not use .local TLD — Pydantic EmailStr rejects it. Use admin@worldcup-sweepstake.com
- docker compose exec uses service names (db, backend, frontend) not container names
- Standings recalculation is from-scratch (not incremental) — safe to correct scores after the fact

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
✅ CI/CD pipeline — .gitlab-ci.yml running on GitLab
✅ pytest backend tests — auth, teams, sweepstakes all passing
✅ Branch protection on main
✅ Quick draw mode — full list, setup, and room views
✅ Quick draw — draw name, teams per person, side-by-side name input layout
✅ Quick draw — opens directly into full room view after draw
✅ Quick draw — leaderboard, participants, groups, bracket tabs all working
✅ Quick draw — invite code hidden, ⚡ badge shown in room header
✅ Quick draw — previous draws persist and show in quick draw list
✅ Leaderboard scoring toggle — ∑ Total / ⌀ Average / ★ Best on all rooms
✅ Backend leaderboard endpoint accepts ?scoring_method query param
✅ Backend list endpoint returns owned quick draws alongside account sweepstakes
✅ Mobile polish — Dashboard, Tournament, Sweepstake, BracketView all responsive
✅ Admin user system — is_admin flag on User model, seeded admin account
✅ Match results UI — admin-only page with group tabs, score entry, progress bar
✅ Standings recalculation — from-scratch recalc after every result, safe to correct scores
✅ 72 group stage matches seeded, 48 standing rows seeded
🔲 Map page — stub, Leaflet not integrated yet
🔲 Share link page — /share/:invite_code public route (no login needed)
🔲 Frontend tests — Vitest + Playwright end-to-end

---

## What to build next session

### Priority 3 — Share Link Page
1. Add `/share/:invite_code` public route in React Router (no login needed)
2. Fetch draw results via existing `GET /api/sweepstakes/share/{invite_code}` endpoint
3. Read-only results page — show participants and their assigned teams
4. Copy link button on quick draw room header (links to this page)

### Priority 4 — Map Page
1. Integrate Leaflet + react-leaflet
2. Show all 48 team countries as markers on a world map
3. Clicking a marker shows the team name, flag, FIFA ranking, group

### Priority 5 — Frontend Tests
1. Vitest unit tests for key components
2. Playwright end-to-end tests — login, create sweepstake, run draw

---

## Branch strategy

All new features go via feature branches:
```bash
git checkout -b feature/share-link
# build feature
git push origin feature/share-link
# create merge request on GitLab → CI runs → merge to main
```

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
- When picking back up: `cd ~/projects/worldcup-sweepstake && docker compose up -d`
- Both projects run simultaneously — finance app :5173/:8000, worldcup :5174/:8001
- All new features should use feature branches from now on
- docker compose exec uses service names: db, backend, frontend (not container names)
- Leaderboard scoring toggle re-fetches with ?scoring_method= — don't remove this param from fetchLeaderboard
- Standings recalc is from-scratch — never incremental
- Admin credentials: admin@worldcup-sweepstake.com / admin1234
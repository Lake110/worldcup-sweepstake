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
- Share a public link to any quick draw so friends can see results without an account

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
│       │   ├── sweepstakes.py    # GET/POST /api/sweepstakes/ + draw + join + leaderboard + share
│       │   └── standings.py      # GET /api/standings/
│       ├── core/
│       │   ├── config.py         # reads .env
│       │   ├── security.py       # bcrypt + JWT
│       │   └── deps.py           # get_current_user + get_admin_user + get_optional_user
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
    ├── Dockerfile                # multi-stage build: Node → Nginx, d3 included
    ├── nginx.conf                # serves React + proxies /api to backend (URL hardcoded)
    ├── entrypoint.sh             # starts nginx — envsubst removed, URL hardcoded in nginx.conf
    ├── package.json
    └── src/
        ├── main.tsx
        ├── App.tsx               # AdminRoute guard + public /share/:invite_code route
        ├── index.css             # group-A through group-L permanent CSS classes
        ├── store/authStore.ts    # is_admin added to User interface
        ├── services/api.ts
        ├── components/
        │   ├── layout/Layout.tsx          # admin nav link shown to admin users only
        │   └── tournament/BracketView.tsx # reusable D3 bracket component
        └── pages/
            ├── Dashboard.tsx     # countdown, stats, opening match, toughest group
            ├── Tournament.tsx    # Groups / All Teams / Bracket tabs
            ├── Sweepstake.tsx    # list, create, room, quick draw mode + share link button
            ├── Share.tsx         # public read-only draw results — no login needed
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

## Production (Railway)

- **Live URL:** https://divine-victory-production.up.railway.app
- **API docs:** https://worldcup-sweepstake-production.up.railway.app/docs
- **Health check:** https://worldcup-sweepstake-production.up.railway.app/health
- **Platform:** Railway (truthful-miracle project)
- **Services:** worldcup-sweepstake (backend), divine-victory (frontend), Postgres
- **GitHub repo:** https://github.com/Lake110/worldcup-sweepstake (Railway deploys from here)

### Railway environment variables (backend)
| Variable | Value |
|---|---|
| DATABASE_URL | postgresql://...@postgres.railway.internal:5432/railway |
| SECRET_KEY | worldcup-super-secret-2026 |
| ALGORITHM | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | 10080 |
| ENVIRONMENT | production |
| ALLOWED_ORIGINS | https://worldcup-sweepstake-production.up.railway.app,https://divine-victory-production.up.railway.app |
| PORT | 8000 |

### Railway environment variables (frontend)
| Variable | Value |
|---|---|
| BACKEND_URL | http://worldcup-sweepstake.railway.internal:8000 |

Note: `BACKEND_URL` is set as a variable but is **not used at runtime** — it is hardcoded directly in `frontend/nginx.conf`. The `envsubst` approach was removed because it fails silently on Railway. If the backend service is ever renamed on Railway, update `nginx.conf` directly and redeploy.

---

## Admin credentials (production)
- Email: `michael@sweepstake.com`
- Password: `password123`
- Promoted to admin via: `psql $DATABASE_PUBLIC_URL -c "UPDATE users SET is_admin = true WHERE email = 'michael@sweepstake.com';"`
- The admin nav link (🔧 Admin) only appears when logged in as admin

## Admin credentials (local)
- Email: `admin@worldcup-sweepstake.com`
- Password: `admin1234`

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

# Push to GitHub (triggers Railway deploy):
git push github main
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
| GET | /api/sweepstakes/{id}/leaderboard/ | Optional | Ranked leaderboard — public for share page, accepts ?scoring_method=total\|average\|best |
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
- Leaderboard endpoint uses get_optional_user (not get_current_user) — allows public share page access
- PARTICIPANT_COLOURS[findIndex()] can return undefined if index is -1 — fixed with (idx >= 0 ? idx : 0) fallback
- Groups tab colour rows use owner && ownerIndex >= 0 guard to avoid undefined colour crash
- Tab buttons have outline-none to remove browser focus ring
- Railway deployment: backend Dockerfile was missing CMD — added `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Railway deployment: frontend uses multi-stage Docker build (Node → Nginx)
- Railway deployment: Nginx proxy buffer sizes increased to handle Railway's large X-Forwarded-For headers
- Railway deployment: BACKEND_URL hardcoded in nginx.conf — envsubst fails silently on Railway, do not use it
- Railway deployment: frontend lockfile deleted in Dockerfile to avoid rollup musl binary platform mismatch
- Railway deployment: admin user seeded but must be manually promoted via psql UPDATE on first deploy

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
✅ Share link — public /share/:invite_code page with Participants, Groups, Leaderboard tabs
✅ Share link — Copy share link button on quick draw room header
✅ Share link — leaderboard endpoint made public (get_optional_user) for unauthenticated access
✅ Deployed to Railway — live at https://divine-victory-production.up.railway.app
✅ Production: multi-stage Docker build for frontend (Node → Nginx)
✅ Production: Nginx proxies /api to backend via Railway internal network (hardcoded)
✅ Production: backend CMD fixed, PORT variable set, ALLOWED_ORIGINS configured
🔲 Map page — stub, Leaflet not integrated yet
🔲 Frontend tests — Vitest + Playwright end-to-end

---

## What to build next session

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
git checkout -b feature/map-page
# build feature
git push origin feature/map-page
# create merge request on GitLab → CI runs → merge to main
```

---

## Future features (backlog)

- Upset bonus points — configurable per sweepstake
- Live standings — points update as match results are entered
- Push notifications — alert when your team plays
- Public sweepstake rooms — joinable without invite code
- Tournament history — past World Cups
- **Interactive knockout bracket** — replace current D3 bracket with @g-loot/react-tournament-brackets (see below)

---

## Backlog: Interactive Knockout Bracket

**Library:** https://github.com/g-loot/react-tournament-brackets
**npm:** `npm install @g-loot/react-tournament-brackets`

### Why
Current D3 bracket is custom-built and static. This library gives us:
- Clean dark-themed bracket out of the box matching the app style
- Built-in score display — updates live as match results are entered
- Pannable/zoomable via SVGViewer — essential for 48-team knockout
- Theming via `createTheme` — easy to match group colours

### What needs building

**Backend:**
1. Seed all 63 knockout matches (R32 × 16, R16 × 8, QF × 4, SF × 2, Final × 1, 3rd place × 1)
2. Add `next_match_id` column to the `Match` model so each match points to the next round match
3. New endpoint `GET /api/matches/knockout/bracket` that returns matches shaped for the library
4. Wire up result propagation — when a match result is entered, winning team advances to next_match_id

**Frontend:**
1. Install library: `npm install @g-loot/react-tournament-brackets`
2. Replace `BracketView.tsx` with new component using `SingleEliminationBracket`
3. Transform API response into library data structure (see below)
4. Use `SVGViewer` with `useWindowSize()` hook for responsive sizing
5. Theme to match app dark style using `createTheme`

### Data structure the library needs
```typescript
// Each match must have this shape:
{
  id: number,                    // unique match id
  name: string,                  // e.g. "Quarter Final - Match 1"
  nextMatchId: number | null,    // id of next match winner advances to (null for Final)
  tournamentRoundText: string,   // e.g. "QF", "SF", "Final"
  startTime: string,             // ISO date string
  state: "DONE" | "SCORE_DONE" | "NO_PARTY",
  participants: [
    {
      id: string,                // team id
      name: string,              // team name + flag emoji
      resultText: string | null, // score or "WON"/"LOST"
      isWinner: boolean,
      status: null | "PLAYED"
    }
  ]
}
```

### Backend model change needed
```python
# In backend/app/models/match.py — add to Match model:
next_match_id = Column(UUID, ForeignKey("matches.id"), nullable=True)
```

### Transform function needed in frontend
```typescript
// In a new file: frontend/src/utils/bracketTransform.ts
// Takes your API matches and converts to library format
// Key mapping:
// match.id → id
// match.home_team + match.away_team → participants[]
// match.home_score + match.away_score → resultText
// match.next_match_id → nextMatchId
// match.stage → tournamentRoundText
```

### Theming to match app
```typescript
import { createTheme } from '@g-loot/react-tournament-brackets';

const AppTheme = createTheme({
  textColor: { main: '#ffffff', highlighted: '#f97316', dark: '#94a3b8' },
  matchBackground: { wonColor: '#1e293b', lostColor: '#0f172a' },
  score: {
    background: { wonColor: '#f97316', lostColor: '#1e293b' },
    text: { highlightedWonColor: '#ffffff', highlightedLostColor: '#94a3b8' },
  },
  border: { color: '#334155', highlightedColor: '#f97316' },
  roundHeader: { backgroundColor: '#1e293b', fontColor: '#f97316' },
  connectorColor: '#334155',
  connectorColorHighlight: '#f97316',
  svgBackground: '#0f172a',
});
```

### Priority
Build this when:
- Tournament knockout stage begins (July 2026)
- OR as a dry run with seeded placeholder bracket data before then
- Do NOT start until `next_match_id` is added to the Match model and all 63 knockout matches are seeded

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
- Admin credentials (local): admin@worldcup-sweepstake.com / admin1234
- Admin credentials (production): michael@sweepstake.com / password123
- get_optional_user dependency allows unauthenticated access to leaderboard — don't change back to get_current_user
- PARTICIPANT_COLOURS array lookups must use (idx >= 0 ? idx : 0) fallback to avoid undefined crash
- Railway deploys from GitHub (Lake110/worldcup-sweepstake) not GitLab — push to both remotes
- BACKEND_URL is hardcoded in frontend/nginx.conf — do not use envsubst, it fails silently on Railway
- Never commit Railway credentials or DATABASE_URL to GitLab
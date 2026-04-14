# Development Notes

## ⚠️ Critical workflow reminders

### Always push to BOTH remotes
Railway deploys from GitHub only. GitLab is the source of truth for CI.

```bash
git push origin main   # GitLab (CI pipeline runs here)
git push github main   # Triggers Railway deploy
```

Forgetting `git push github main` = production not updated.

---

### Feature branch workflow
```bash
git checkout -b feature/my-feature
# build feature
git add . && git commit -m "feat: describe feature"
git push origin feature/my-feature
# Create MR on GitLab → CI (ruff + black + tsc) → merge to main
git checkout main && git pull origin main
git push github main   # deploy to Railway
```

---

## 🚀 Railway deployment

- Deploys from: **GitHub** (Lake110/worldcup-sweepstake)
- Live URL: https://divine-victory-production.up.railway.app
- Deploy time: ~2-3 minutes after push

### DB migrations on Railway
When adding new columns, always run manually:
```bash
psql "postgresql://postgres:iILvdrbcKWnkMXZFuwNAUdWBRtQiFoTf@mainline.proxy.rlwy.net:16695/railway" -c "ALTER TABLE ..."
```
Railway doesn't run Alembic — migrations are manual SQL.

---

## 🧪 Running tests locally
```bash
# All tests
docker compose exec backend python3 -m pytest tests/ -v

# Seeding/bracket tests (need real DB)
RUN_SEEDING_TESTS=1 docker compose exec -e RUN_SEEDING_TESTS=1 backend python3 -m pytest tests/ -v

# Lint check
docker compose exec backend ruff check /app/app --select E,W,F,I --ignore E501
docker compose exec backend black --check /app/app
```

---

## 🗄️ Database

### Local
- Host: `db` (inside Docker) / `localhost:5433` (from host machine)
- DB: `worldcupdb`
- User: `worldcup` / Password: `worldcup123`
- Test DB: `worldcupdb_test`

### Production (Railway)
- Connection: `postgresql://postgres:...@mainline.proxy.rlwy.net:16695/railway`
- 32 knockout matches seeded
- Admin user: `michael@sweepstake.com` / `password123`
- To promote admin: `UPDATE users SET is_admin = true WHERE email = '...';`

### Reseed knockout matches (if wiped)
```bash
docker compose exec backend python3 -c "
import app.models.user, app.models.team, app.models.group, app.models.match, app.models.standing, app.models.sweepstake
from app.db.database import SessionLocal
from app.db.seed_knockout import seed_knockout_matches
db = SessionLocal()
seed_knockout_matches(db)
db.close()
"
```

---

## 🐛 Common issues & fixes

| Issue | Fix |
|---|---|
| Production not updating | Run `git push github main` |
| Bracket stuck on "Loading..." | Railway DB missing knockout matches — run migration |
| Confederation shows 0 teams | Frontend hasn't redeployed — push to GitHub |
| Admin login fails | Reset password via psql or recreate admin user |
| `db` hostname not found in tests | Tests run inside Docker — use `db`, not `localhost` |
| Black CI fails | Run `docker compose exec backend black /app/app` then commit |
| Merge conflicts in matches.py | Take the black-formatted version (theirs) |

---

## 📦 Adding new DB columns

1. Add to SQLAlchemy model (`backend/app/models/`)
2. Add to Pydantic schema (`backend/app/schemas/`)
3. Run locally: `docker compose restart backend` (auto-migrates via create_all)
4. Run on Railway:
```bash
psql "$RAILWAY_DB_URL" -c "ALTER TABLE x ADD COLUMN IF NOT EXISTS y TYPE DEFAULT z;"
```

---

## 🔧 Local admin account

If admin login fails after DB wipe:
```bash
docker compose exec backend python3 -c "
import app.models.user, app.models.team, app.models.group, app.models.match, app.models.standing, app.models.sweepstake
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password
db = SessionLocal()
u = db.query(User).filter(User.email == 'admin@worldcup-sweepstake.com').first()
if u:
    u.hashed_password = hash_password('admin1234')
    u.is_admin = True
    db.commit()
    print('Reset')
else:
    db.add(User(email='admin@worldcup-sweepstake.com', hashed_password=hash_password('admin1234'), full_name='Admin', is_active=True, is_admin=True))
    db.commit()
    print('Created')
db.close()
"
```

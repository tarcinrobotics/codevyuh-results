# Codevyuh Competition & Assessment Analytics Platform

A high-performance enterprise analytics and scoring platform for inter-school coding competitions, hackathons, and technical assessments. Designed with an obsidian-slate SaaS interface, cumulative multi-challenge scoring engines, and scoped role-based access control (RBAC).

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Web Browser (Linear/Stripe UI)               │
│     /login  ·  /dolphin/dashboard  ·  /kln/dashboard        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON
┌──────────────────────────────▼──────────────────────────────┐
│                  Node.js / Express Backend                  │
│       Session Security · RBAC Middleware · REST APIs        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼─────────────┐ ┌──────────────▼───────────────┐
│     PostgreSQL Database    │ │    MongoDB Auth (Optional)   │
│  User, Event, Submission,  │ │  UserAccount Collection /    │
│  ChallengeStatus, Problem  │ │  Fallback Memory Store       │
└────────────────────────────┘ └──────────────────────────────┘
```

- **Backend**: Node.js & Express with connection pooling (`pg`), rate limiting, and session security.
- **Frontend**: Vanilla ES modules with high-density enterprise components, Chart.js visualizations, and Lucide SVG icons.
- **Scoring Engine**: Cumulative multi-challenge evaluation ($\sum_{c} \max(\text{score on } c)$) scoring students up to 10,000+ points across 300+ challenges.
- **Authentication**: Single-field login with automatic routing to scoped dashboards (`admin@dolphin` → `/dolphin/dashboard`, `admin@kln` → `/kln/dashboard`).

---

## 2. Production Deployment & Database Strategy

### *Does the database, data, and credentials get seeded in the codebase itself?*
**No. In production software engineering, code and persistent state are strictly decoupled:**

1. **The Database (Data & Submissions)**:
   - The PostgreSQL database runs as a standalone service (Managed cloud DB like Supabase/Neon/RDS or a persistent Docker volume).
   - The database is initialized **once** during infrastructure setup via `pg_restore` from a baseline backup dump.
   - Application deployments (`git pull` or container updates) do **not** re-seed or wipe the database; your student data, submissions, and scores persist untouched across deploys.
2. **Credentials & Secrets**:
   - Passwords and secrets are **never committed to Git**.
   - They are injected securely at runtime via **Environment Variables** (`.env` or cloud secret managers).
   - On server startup, the backend reads these environment variables, hashes them using `bcrypt` (10 salt rounds), and provisions the admin accounts in the auth store.

---

## 3. Quick Start & Local Setup

### Prerequisites
- Node.js >= 18.x
- PostgreSQL 14+ running on port `5432` with database `codevyuh_db`

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your local PostgreSQL password

# 3. Initialize an empty database from the included baseline backup
npm run db:init

# 4. Start development server
npm run dev
# Server boots at http://localhost:3001
```

On Windows, run `npm run db:init` from PowerShell in the project folder. It uses the database connection settings in `.env` and restores `backup_codevyuh_db_20261021_193140.dump`. PostgreSQL's `pg_restore` command must be installed and available on `PATH`. The command creates the configured database if needed, or restores into it only if it is empty; it will refuse to overwrite a populated database. To generate sample tournament submissions after initialization, run `npm run seed:tournament` separately.

---

## 4. Production Deployment Options

### Option A: Turnkey Docker Compose (Recommended for VPS / Cloud VMs)
A single command builds the application, spins up PostgreSQL, sets up persistent volumes, and configures healthchecks:

```bash
# 1. Configure production environment
cp .env.example .env
# Set your secure PGPASSWORD, SESSION_SECRET, and ADMIN passwords

# 2. Start all services
docker compose up -d

# 3. Check health and logs
docker compose ps
docker compose logs -f app
```

### Option B: Traditional Linux VPS (Ubuntu / Debian + PM2 + Nginx)

```bash
# 1. Install Node.js 20 and PM2 globally
sudo apt update && sudo apt install -y nodejs npm postgresql
sudo npm install -g pm2

# 2. Clone repository & install dependencies
git clone https://github.com/your-org/codevyuh-results.git /var/www/codevyuh
cd /var/www/codevyuh
npm ci --omit=dev

# 3. Restore database dump into PostgreSQL
createdb -U postgres codevyuh_db
pg_restore -U postgres -d codevyuh_db backup_codevyuh_db.dump

# 4. Configure environment
cp .env.example .env
nano .env

# 5. Start with PM2 process manager
pm2 start server.js --name "codevyuh-api"
pm2 save
pm2 startup
```

### Option C: Cloud PaaS (Render / Railway / Fly.io)
1. Link your repository.
2. Attach a Managed PostgreSQL database.
3. Set the environment variables (`DATABASE_URL`, `SESSION_SECRET`, `KLN_ADMIN_PASSWORD`, etc.).
4. Start Command: `npm start`.

---

## 5. Environment Variables Reference

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | HTTP Server port | `3001` |
| `DATABASE_URL` | Full Postgres connection string | `postgresql://user:pass@host:5432/codevyuh_db` |
| `PGHOST` | Postgres host | `localhost` |
| `PGPORT` | Postgres port | `5432` |
| `PGUSER` | Postgres username | `postgres` |
| `PGPASSWORD` | Postgres password | `your_secure_password` |
| `PGDATABASE` | Postgres database name | `codevyuh_db` |
| `PGSSLMODE` | Postgres SSL mode (`disable`, `require`) | `disable` |
| `SESSION_SECRET` | Cryptographically random secret for express-session | `openssl rand -hex 32` |
| `SUPER_ADMIN_PASSWORD` | Password for `admin` account | Injected at runtime |
| `DOLPHIN_ADMIN_PASSWORD` | Password for `admin@dolphin` account | Injected at runtime |
| `KLN_ADMIN_PASSWORD` | Password for `admin@kln` account | Injected at runtime |
| `MONGO_URI` | Optional MongoDB URI for user/session storage | Resilient fallback if omitted |

---

## 6. Seed Scripts

```bash
# Seed or reset tournament submissions across all 306 challenges
npm run seed:tournament

# Seed shared administrative accounts into auth store
npm run seed:auth
```

---

## 7. Security & Compliance

- **Role-Based Access Control (RBAC)**: All API routes and static HTML pages are guarded by server-side middleware (`requireApiRoles`, `requireEventAccess`, `blockProtectedStaticFiles`).
- **No Client Secrets**: Client-side JavaScript never receives database credentials or unhashed passwords.
- **Rate Limiting**: Brute-force protection on `/api/auth/login` (5 attempts per minute per IP/username).
- **Session Security**: HTTP-only, SameSite lax cookies with configurable session expiry.

---

## License & Copyright
&copy; 2026 Codevyuh Platform &nbsp;&bull;&nbsp; Madurai Tech Cup Series. All rights reserved.

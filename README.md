# Nutanix Slot Machine

A real-time multiplayer slot machine tournament app. Players compete in timed sessions, spinning reels to accumulate the highest balance. An admin controls session flow; a live scoreboard and Hall of Fame track results.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite (SPA), plain JavaScript |
| Styling | Custom CSS (BEM, no framework) |
| Backend | Express + Socket.io |
| Database | MongoDB 7 + Mongoose |
| Deployment | Docker + Docker Compose |
| Serving | Nginx (static files + reverse proxy) |
| CI/CD | GitHub Actions |
| Container Registry | Docker Hub (`pkhamdee/slotmachine`) |
| GitOps | Kustomize → `pkhamdee/slotmachine-deployment` |
| SAST | CodeQL (security-extended queries) |
| DAST | OWASP ZAP (baseline on PRs, full scan on main) |
| Container scanning | Trivy (HIGH/CRITICAL CVEs, SARIF → GitHub Security) |

---

## Architecture Overview

```
Browser
  └── Nginx :8080
        ├── /            → React SPA (static build)
        ├── /api/*       → Express server :3001
        └── /socket.io/* → Socket.io server :3001

Express + Socket.io
  └── MongoDB :27017
```

All real-time updates (scoreboard, session state, winner) are pushed over a single Socket.io connection per client. HTTP REST handles player actions (register, spin).

---

## Project Structure

```
slotmachine/
├── .env.example                # Template for required environment variables
├── .github/
│   └── workflows/
│       └── ci.yml              # CI/CD pipeline (6 jobs)
├── .zap/
│   └── rules.tsv               # OWASP ZAP scan rules (FAIL/WARN/IGNORE per alert ID)
├── docker-compose.yml          # Orchestrates mongo, server, client
├── tests/
│   └── locustfile.py           # Locust performance test scenarios
├── client/
│   ├── nginx.conf              # SPA serving + /api, /socket.io proxy
│   ├── Dockerfile              # node:20-alpine build → nginx:alpine
│   └── src/
│       ├── api/
│       │   └── gameApi.js      # All HTTP fetch wrappers (single source of truth)
│       ├── components/
│       │   ├── SlotMachine.jsx # Main game UI; reels + controls
│       │   ├── Reel.jsx        # Individual reel animation
│       │   ├── BetControls.jsx
│       │   ├── BalanceDisplay.jsx
│       │   ├── Scoreboard.jsx  # Live leaderboard (pushed via Socket.io)
│       │   ├── Timer.jsx       # Session countdown
│       │   ├── HallOfFame.jsx  # All-time top winners
│       │   ├── HistoryPanel.jsx
│       │   ├── MessageBanner.jsx
│       │   ├── NameEntry.jsx   # Player registration
│       │   ├── WinnerAnnouncement.jsx
│       │   ├── TournamentOver.jsx
│       │   ├── AdminLogin.jsx
│       │   └── AdminPage.jsx   # Session management UI
│       ├── constants/
│       │   └── symbols.js      # 8 slot symbols with weights + payouts
│       ├── hooks/
│       │   ├── useGame.js      # Spin logic, optimistic balance update
│       │   └── useSession.js   # Socket.io connection + session state
│       ├── styles/
│       │   └── game.css        # Single global stylesheet (BEM)
│       └── src/__tests__/      # Vitest unit tests (97 tests)
│           ├── api/
│           ├── components/
│           └── hooks/
└── server/
    ├── server.js               # Entry: Express + Socket.io + Mongoose boot
    ├── Dockerfile              # node:20-alpine
    └── src/
        ├── config/
        │   └── gameConfig.js   # sessionDuration, lobbyDuration from env
        ├── controllers/
        │   ├── gameController.js     # Player register + spin endpoints
        │   └── sessionController.js  # Admin session control endpoints
        ├── middleware/
        │   ├── adminAuth.js          # Random token auth (issued at server start)
        │   └── adminAuth.test.js     # Unit tests (8 tests)
        ├── models/
        │   ├── Player.js
        │   ├── GameSession.js
        │   ├── GameRound.js
        │   ├── PlayerSession.js
        │   └── HallOfFame.js
        ├── routes/
        │   ├── gameRoutes.js
        │   └── sessionRoutes.js
        └── services/
            ├── SessionManager.js     # Singleton — owns all timer + state logic
            ├── slotEngine.js         # Pure functions: spinReels, evaluatePayout
            └── slotEngine.test.js    # Unit tests (13 tests)
```

---

## Session State Machine

```
waiting ──(admin starts)──► lobby ──(timer)──► active ──(timer)──► ended
                                                                      │
                                                     ┌────────────────┘
                                                     ▼
                                            waiting (admin reset)
                                            lobby   (admin next round)
```

- **waiting** — idle, players can register
- **lobby** — countdown before round starts; all balances reset to **1,000**
- **active** — spins accepted; scoreboard pushed every 1 second
- **ended** — no more spins; winner announced; Hall of Fame updated

---

## Slot Symbols & Payouts

| Symbol | Weight | 3-match | 4-match | 5-match |
|---|---|---|---|---|
| Cherry 🍒 | 20 | 10 | 25 | 50 |
| Watermelon 🍉 | 18 | 10 | 25 | 50 |
| Lemon 🍋 | 16 | 15 | 30 | 75 |
| Orange 🍊 | 14 | 15 | 30 | 75 |
| Bell 🔔 | 10 | 20 | 50 | 100 |
| BAR 💰 | 6 | 50 | 100 | 250 |
| Diamond 💎 | 4 | 100 | 250 | 500 |
| Seven 7️⃣ | 2 | 200 | 500 | 1,000 |

Grid: **5 columns × 3 rows**. Payline = **middle row only**. Lower weight = rarer symbol.

---

## Key Flows

### Spin Flow
1. Client deducts bet optimistically from local balance
2. `POST /api/players/:id/spin` — server runs `spinReels()` + `evaluatePayout()`
3. Atomic DB update: `$inc: { balance: payout - bet }`
4. Response: `grid`, `payout`, `balanceAfter`, `matchCount`, `matchSymbol`
5. Client staggers reel stops 380 ms apart (left → right); final result applied

### Player Identity
- UUID generated server-side on registration, stored in `localStorage`
- Auto-login on app mount via `GET /api/players/:id`
- Duplicate names rejected with 409

### Admin Auth
- Single random token generated at server start
- `POST /api/admin/login` validates `ADMIN_PASSWORD` env var → returns token
- Token stored in React state only (lost on page refresh = re-login required)

---

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set ADMIN_PASSWORD to a strong value
```

### 2. Run with Docker

```bash
# Start full stack (app available at http://localhost:8080)
docker compose up -d

# Rebuild after code changes
docker compose up -d --build

# View server logs
docker compose logs -f server

# Stop everything
docker compose stop
```

### Local Development (no Docker)

```bash
# Install all workspace dependencies (run from repo root)
npm install

# Terminal 1 — client dev server (http://localhost:5173)
cd client && npm run dev

# Terminal 2 — API server (requires local MongoDB)
cd server && node server.js
```

---

## Environment Variables (server)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API server port |
| `MONGO_URI` | — | MongoDB connection string |
| `SESSION_DURATION` | `180` | Active round length (seconds) |
| `LOBBY_DURATION` | `10` | Lobby countdown (seconds) |
| `ADMIN_PASSWORD` | — | Admin login password (required) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin. In production, Nginx proxies all `/api/` calls same-origin so this is only needed for local dev. |

Copy `.env.example` to `.env` and set values before running. Never commit `.env`.

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/players` | — | Register a new player |
| GET | `/api/players/:id` | — | Get player info |
| POST | `/api/players/:id/spin` | — | Spin the reels |
| POST | `/api/admin/login` | — | Get admin token |
| POST | `/api/admin/next-round` | Admin | Start lobby / advance to next round |
| POST | `/api/admin/session/reset` | Admin | Reset to waiting state |
| GET | `/api/sessions/current` | — | Get current session state |
| GET | `/api/hall-of-fame` | — | All-time top scores |

---

## Socket.io Events (server → client)

| Event | Payload | When emitted |
|---|---|---|
| `session:state` | `{ phase, timeRemaining }` | On state change + new connection |
| `session:scoreboard` | `[{ name, balance }]` | Every 1s during active phase |
| `session:ended` | `{ winner, scores }` | When round ends |

---

## Testing

The project has **118 unit tests** across client and server.

### Run tests locally

```bash
# Server unit tests (Node.js built-in test runner)
cd server && npm test

# Client unit tests (Vitest + @testing-library/react)
cd client && npm test

# Client tests in watch mode
cd client && npm run test:watch
```

### Test coverage

| Layer | Runner | Tests | What is covered |
|---|---|---|---|
| Server — `slotEngine.js` | `node --test` | 13 | `spinReels()` shape, all `evaluatePayout()` outcomes |
| Server — `adminAuth.js` | `node --test` | 8 | Token generation, middleware pass/block |
| Client — `gameApi.js` | Vitest | 11 | All fetch wrappers with mocked `fetch` |
| Client — components | Vitest | 67 | BalanceDisplay, BetControls, HallOfFame, MessageBanner, NameEntry, Scoreboard, Timer, WinnerAnnouncement |
| Client — `useGame` hook | Vitest | 22 | Initial state, bet adjustment, spin guards, optimistic update, error recovery |

---

## Performance Testing

[Locust](https://locust.io/) headless load tests run as part of the CI pipeline.

```bash
# Run manually (requires a running server at localhost:3001)
pip install locust requests
locust -f tests/locustfile.py \
  --headless --users 10 --spawn-rate 5 --run-time 30s \
  --host http://localhost:3001
```

The test bootstraps an admin session automatically, then simulates mixed traffic: spin (weight 5), get session (2), get player (1), get Hall of Fame (1).

---

## Security Hardening

The following controls are applied to every API response in `server/server.js`:

| Control | Value | Addresses |
|---|---|---|
| `X-Powered-By` | Removed | Server fingerprinting (ZAP 10037) |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing (ZAP 10021) |
| `X-Frame-Options` | `DENY` | Clickjacking (ZAP 10020) |
| `Content-Security-Policy` | `default-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; navigate-to 'none'` | XSS / injection (ZAP 10038, 10055) |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` | Feature abuse (ZAP 10063) |
| CORS origin | `CORS_ORIGIN` env var (not wildcard `*`) | CORS misconfiguration (ZAP 10098, 40040) |

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to `main`. All actions run on Node.js 24 (`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`).

```
code-scan (CodeQL SAST) ────────────────────────────────────►
                                                              │
build-and-test ──────────────────────────────────────────────┤
    ├── performance-test (Locust) ────────────────────────►  │
    └── dast-zap (OWASP ZAP) ───────────────────────────►   │
              └── container-build-scan-push ────────────────►│
                       └── update-gitops (main only) ───────►
```

| Job | Trigger | What it does |
|---|---|---|
| **code-scan** | push + PR | CodeQL SAST (security-extended queries) → GitHub Security tab |
| **build-and-test** | push + PR | `npm ci`, Vitest (client), `node --test` (server), build client, upload `client-dist` artifact |
| **performance-test** | push + PR | MongoDB service + API server + Locust 2-user 10s headless test → `locust-performance-report` artifact |
| **dast-zap** | push + PR | OWASP ZAP via Docker (`--network host`). Baseline scan (passive) on PRs; full scan + Ajax Spider on `main` push. Rules in `.zap/rules.tsv`. Reports uploaded as `zap-scan-report` artifact |
| **container-build-scan-push** | push + PR | Builds client + server images; Trivy scans (HIGH/CRITICAL) → GitHub Security tab + `trivy-scan-reports` artifact; pushes to Docker Hub on `main` only |
| **update-gitops** | main push | Updates image tags in `pkhamdee/slotmachine-deployment` (`development` branch) via Kustomize |

### CI Artifacts

| Artifact | Produced by | Contents |
|---|---|---|
| `client-dist` | build-and-test | Built React SPA (used by downstream jobs) |
| `locust-performance-report` | performance-test | Locust HTML report |
| `zap-scan-report` | dast-zap | ZAP HTML + JSON + Markdown reports |
| `trivy-scan-reports` | container-build-scan-push | Trivy table report for client and server images |

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub login |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `ADMIN_PASSWORD` | Password used to bootstrap the admin session during performance and ZAP tests |
| `DEPLOY_REPO_TOKEN` | Personal access token with `repo` scope for pushing to `pkhamdee/slotmachine-deployment` |

### Security Scan Results

| Scanner | Output location | Scope |
|---|---|---|
| CodeQL | GitHub Security → Code scanning (`codeql`) | JavaScript/TypeScript SAST |
| OWASP ZAP | `zap-scan-report` artifact | API DAST — all endpoints at `:3001` |
| Trivy | GitHub Security → Code scanning (`trivy-client`, `trivy-server`) + `trivy-scan-reports` artifact | Container image CVEs (HIGH/CRITICAL) |

---

## Container Images

Images are published to Docker Hub on every push to `main`.

| Image | Tag | Description |
|---|---|---|
| `pkhamdee/slotmachine` | `client` | Latest client (Nginx + React build) |
| `pkhamdee/slotmachine` | `client-{git-sha}` | Immutable per-commit tag |
| `pkhamdee/slotmachine` | `server` | Latest server (Node.js + Express) |
| `pkhamdee/slotmachine` | `server-{git-sha}` | Immutable per-commit tag |

---

## GitOps Deployment

After a successful image push, CI automatically updates the Kustomize overlays in [`pkhamdee/slotmachine-deployment`](https://github.com/pkhamdee/slotmachine-deployment) (`development` branch).

```
pkhamdee/slotmachine-deployment/
  overlays/
    development/    # kustomization.yaml patched with new image tags
    production/     # kustomization.yaml patched with new image tags
```

Apply the development overlay manually with:

```bash
kubectl apply -k overlays/development
```

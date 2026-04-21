# Project Brain — Nutanix Slot Machine

## Stack
React 18 + Vite (SPA), plain JavaScript (ES modules), custom CSS (BEM, no framework),
Express + Socket.io (API + real-time), Mongoose + MongoDB 7,
Docker + Docker Compose + Nginx,
CI: GitHub Actions — CodeQL · OWASP ZAP · Trivy · Locust

## Commands

| Command | Purpose |
|---|---|
| `docker compose up -d` | Full stack (client :8080) |
| `docker compose up -d --build` | Rebuild then start |
| `docker compose stop` | Stop all containers |
| `docker compose logs -f server` | Tail server logs |
| `cd client && npm run dev` | Vite dev server (:5173, client only) |
| `cd server && node server.js` | API server only (requires local Mongo) |
| `npm ci` | Install all workspace deps (run from repo root) |
| `cd client && npm test` | Vitest unit tests (client) |
| `cd server && npm test` | node --test unit tests (server) |

## Project Structure

```
slotmachine/
  .zap/
    rules.tsv         # OWASP ZAP alert overrides — FAIL/WARN/IGNORE per rule ID
  .github/
    workflows/
      ci.yml          # 6-job pipeline (CodeQL, build+test, Locust, ZAP, Trivy, GitOps)
  tests/
    locustfile.py     # Locust performance scenarios (bootstraps admin session)
  client/
    src/
      api/            # gameApi.js — all HTTP fetch wrappers (single source of truth)
      components/     # one file per React component
      constants/      # symbols.js — symbol weights + payout table
      hooks/          # useGame.js (spin logic), useSession.js (Socket.io)
      styles/         # game.css — single global stylesheet, BEM naming
    nginx.conf        # serves SPA + proxies /api/ and /socket.io/ → server:3001
    Dockerfile        # multi-stage: node:20-alpine build → nginx:alpine serve
  server/
    src/
      config/         # gameConfig.js — reads SESSION_DURATION, LOBBY_DURATION from env
      controllers/    # gameController.js (player/spin), sessionController.js (admin)
      middleware/     # adminAuth.js — random token issued at server start
      models/         # Player, GameRound, GameSession, PlayerSession, HallOfFame
      routes/         # gameRoutes.js, sessionRoutes.js
      services/       # SessionManager.js (singleton), slotEngine.js (pure functions)
    server.js         # entry: Express + Socket.io + Mongoose boot + security headers
    Dockerfile        # node:20-alpine
  docker-compose.yml
  C4_DIAGRAM.md       # Architecture diagrams (all four C4 levels)
```

## Conventions

- **JavaScript only** — no TypeScript; keep files simple and readable
- **ES modules** (`"type": "module"`) in both client and server
- **BEM CSS** — `.block__element--modifier`; all styles in `client/src/styles/game.css`
- **No CSS framework** — write utility classes manually
- **Functional components + hooks only** — no class components
- **Single responsibility** — one concern per hook/component/service
- **No prop drilling** — lift state to App only when shared across siblings
- **No speculative abstractions** — implement exactly what is asked, nothing more

## Key Patterns

### Security Headers (DO NOT REMOVE)
Every API response in `server.js` sets these headers via middleware placed before routes:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; navigate-to 'none'
Permissions-Policy: geolocation=(), camera=(), microphone=()
```
`X-Powered-By` is disabled. CORS is restricted to `CORS_ORIGIN` env var (not `*`).
These address ZAP rules 10020, 10021, 10037, 10038, 10055, 10063, 10098, 40040.

### Real-time (Socket.io)
- `useSession.js` opens one Socket.io connection per client; listens for `session:state`, `session:scoreboard`, `session:ended`
- Server emits **only from `SessionManager`** — never from controllers
- On new connection, `SessionManager.init()` replays last known state + scoreboard + winner

### Session State Machine
```
waiting ──(admin)──► lobby ──(timer)──► active ──(timer)──► ended
                                                               │
                                          waiting (reset) ◄───┤
                                          lobby  (next)   ◄───┘
```
- `SessionManager` singleton owns all timer logic; never instantiate it elsewhere
- Scoreboard pushed every 1 s via `setInterval` during `active`; no per-spin push
- All balances reset to **1000** at start of every lobby phase

### Spin Flow
1. `useGame` deducts bet optimistically from local state
2. `POST /api/players/:id/spin` → server runs `spinReels()` + `evaluatePayout()`
3. `Player.findOneAndUpdate` with `$inc: { balance: payout - bet }` (atomic)
4. Response: `{ grid, payout, balanceAfter, matchCount, matchSymbol }`
5. Client staggers reel stops every **380 ms** left→right; final reel applies server result

### Slot Grid
- `grid[col][row]` — 5 columns × 3 rows
- Payline = **middle row (index 1) only**
- Payout evaluated left-to-right: 5-of-a-kind → 4-of-a-kind → 3-of-a-kind → cherry partial (2+)

### Admin Auth
- Single `crypto.randomBytes(32)` token generated at server start; no session store
- `POST /api/admin/login` validates `ADMIN_PASSWORD` env var → returns token
- Protected routes use `requireAdminAuth` middleware (`Authorization: Bearer <token>`)
- Token in React state only — lost on page refresh (re-login required)

### Player Identity
- UUID `playerId` generated server-side on register; stored in `localStorage`
- `App.jsx` auto-logs in on mount via `GET /api/players/:id`
- Duplicate names rejected 409

### ZAP Rules (`.zap/rules.tsv`)
Format: `<alert-id>\tFAIL|WARN|IGNORE\t<description>`
- **FAIL**: NoSQL injection, XSS, source code disclosure — blocks deployment
- **WARN**: security header gaps, CORS, CSRF — reported but non-blocking
- **IGNORE**: false positives on Express 404 routes and React build artifacts

## Environment Variables (server)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API server port |
| `MONGO_URI` | — | MongoDB connection string (required) |
| `SESSION_DURATION` | `180` | Active round length in seconds |
| `LOBBY_DURATION` | `10` | Lobby countdown in seconds |
| `ADMIN_PASSWORD` | — | Admin login password (required) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (prod uses Nginx same-origin proxy) |

## CI Pipeline (`.github/workflows/ci.yml`)

| Job | Needs | What it does |
|---|---|---|
| `code-scan` | — | CodeQL SAST → GitHub Security |
| `build-and-test` | — | npm ci, Vitest, node --test, Vite build, upload client-dist |
| `performance-test` | build-and-test | Locust 2-user 10s → locust-performance-report artifact |
| `dast-zap` | build-and-test | OWASP ZAP (baseline on PR, full+Ajax on main) → zap-scan-report artifact |
| `container-build-scan-push` | build-and-test + perf + zap | Trivy scan → GitHub Security + trivy-scan-reports artifact; push to DockerHub on main |
| `update-gitops` | container-build-scan-push | kustomize edit in pkhamdee/slotmachine-deployment |

## Subagents (use Agent tool with subagent_type)

| subagent_type | When to use |
|---|---|
| `feature-dev:code-reviewer` | Before any significant change ships |
| `feature-dev:code-explorer` | Tracing an unfamiliar execution path or debugging |
| `feature-dev:code-architect` | Designing a new feature before writing code |
| `Explore` | Quick codebase search across multiple files |

## Skills (invoke with `/skill-name`)

| Skill | Purpose |
|---|---|
| `/security-review` | Full security review of pending branch changes |
| `/review` | Structured pull request review |
| `/init` | Regenerate CLAUDE.md from current codebase state |

  ---

  Build a real-time multiplayer slot machine tournament web application with the following exact specifications.

  ## Tech Stack
  - **Frontend**: React 18 + Vite (SPA), plain JavaScript (ES modules), custom CSS (BEM, no framework)
  - **Backend**: Express + Socket.io, plain JavaScript (ES modules)
  - **Database**: MongoDB 7 + Mongoose
  - **Serving**: Nginx (static files + reverse proxy to Express)
  - **Deployment**: Docker + Docker Compose

  ---

  ## Game Rules

  ### Slot Grid
  - **5 columns × 3 rows**
  - **Payline = middle row only** (row index 1)
  - Evaluate left-to-right: 5-of-a-kind → 4-of-a-kind → 3-of-a-kind → cherry partial (2 cherries)

  ### Symbols (name, weight, 3-match payout, 4-match payout, 5-match payout)
  | Symbol | Weight | 3x | 4x | 5x |
  |---|---|---|---|---|
  | Cherry | 20 | 10 | 25 | 50 |
  | Watermelon | 18 | 10 | 25 | 50 |
  | Lemon | 16 | 15 | 30 | 75 |
  | Orange | 14 | 15 | 30 | 75 |
  | Bell | 10 | 20 | 50 | 100 |
  | BAR | 6 | 50 | 100 | 250 |
  | Diamond | 4 | 100 | 250 | 500 |
  | Seven | 2 | 200 | 500 | 1000 |

  Lower weight = rarer. Use weighted random selection per cell.

  ### Bet Rules
  - Starting balance: **1000** per player per round
  - Allowed bets: 10, 25, 50, 100
  - Reject spin if balance < bet

  ---

  ## Session State Machine

  ```
  waiting ──(admin triggers)──► lobby ──(LOBBY_DURATION timer)──► active ──(SESSION_DURATION timer)──► ended
                                                                                                           │
                                                                                waiting (admin reset) ◄────┤
                                                                                lobby   (admin next round) ◄┘
  ```

  - **waiting**: idle, players can register
  - **lobby**: countdown before round; all player balances reset to 1000
  - **active**: spins accepted; scoreboard pushed every 1 second via Socket.io
  - **ended**: no more spins; winner announced; Hall of Fame updated

  ---

  ## Backend

  ### Server Entry (`server.js`)
  - Express app on `PORT` (default 3001)
  - Mount all routes under `/api`
  - Socket.io attached to the same HTTP server
  - Connect to MongoDB then call `SessionManager.init(io)` and `sessionManager.start()` before listening
  - Security headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none';
  form-action 'none'; frame-ancestors 'none'; base-uri 'none'; navigate-to 'none'`, `Permissions-Policy: geolocation=(), camera=(), microphone=()`
  - Disable `X-Powered-By`
  - CORS restricted to `CORS_ORIGIN` env var (default `http://localhost:5173`)

  ### Environment Variables
  | Variable | Default | Purpose |
  |---|---|---|
  | `PORT` | `3001` | API port |
  | `MONGO_URI` | — | MongoDB connection string |
  | `SESSION_DURATION` | `180` | Active round seconds |
  | `LOBBY_DURATION` | `10` | Lobby countdown seconds |
  | `ADMIN_PASSWORD` | — | Admin login password |
  | `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

  ### REST API Endpoints

  **Game routes** (`gameRoutes.js`):
  - `POST /api/players` — register player `{ name }` → `{ playerId, name, balance: 1000 }`, reject duplicate names with 409
  - `GET /api/players/:playerId` — get player info
  - `POST /api/players/:playerId/spin` — `{ bet }` → `{ grid, payout, balanceAfter, matchCount, matchSymbol }`; atomic DB update with `$inc: {
  balance: payout - bet }`; reject if session not active or balance < bet
  - `GET /api/players/:playerId/history` — last 20 spins

  **Session routes** (`sessionRoutes.js`):
  - `GET /api/sessions/current` — current session state `{ phase, timeRemaining, scoreboard? }`
  - `GET /api/hall-of-fame` — top 10 all-time winners
  - `POST /api/admin/login` — `{ password }` → `{ token }` or 401
  - `POST /api/admin/next-round` — [admin] start lobby / advance
  - `POST /api/admin/reset` — [admin] reset to waiting
  - `POST /api/admin/purge-users` — [admin] delete all players
  - `GET /api/admin/players` — [admin] list all players

  ### Admin Auth (`adminAuth.js`)
  - Generate a single random token (`crypto.randomBytes(32).toString('hex')`) at server start
  - `POST /api/admin/login` validates `ADMIN_PASSWORD` env var → returns the token
  - `requireAdminAuth` middleware: check `Authorization: Bearer <token>` header
  - No session store; token is lost on server restart

  ### Mongoose Models
  - **Player**: `{ playerId (uuid, unique), name (unique), balance, createdAt }`
  - **GameSession**: `{ phase, startedAt, endedAt }`
  - **GameRound**: `{ sessionId, startedAt, endedAt, winnerId }`
  - **PlayerSession**: `{ playerId, sessionId, finalBalance }`
  - **HallOfFame**: `{ playerId, name, balance, achievedAt }`

  ### SessionManager (singleton)
  - Owns all timer logic (lobby timer, active timer, scoreboard interval)
  - On `init(io)`: replay last known state + scoreboard + winner to new connections via `session:state`, `session:scoreboard`, `session:ended`
  - Push scoreboard every 1s during active phase via `setInterval`
  - On lobby start: reset all player balances to 1000
  - On round end: determine winner, update HallOfFame, emit `session:ended`
  - Emit `session:state` on every phase transition

  ### Slot Engine (`slotEngine.js`) — pure functions, no side effects
  - `spinReels()` → `grid[col][row]` (5 cols × 3 rows) using weighted random
  - `evaluatePayout(grid, bet)` → `{ payout, matchCount, matchSymbol }`

  ### Socket.io Events (server → client)
  | Event | Payload | When |
  |---|---|---|
  | `session:state` | `{ phase, timeRemaining }` | Phase change + new connection |
  | `session:scoreboard` | `[{ name, balance }]` sorted desc | Every 1s during active |
  | `session:ended` | `{ winner: { name, balance }, scores: [...] }` | Round ends |

  ---

  ## Frontend

  ### Player Identity
  - UUID `playerId` generated server-side on register, stored in `localStorage`
  - On app mount: if `playerId` in localStorage, call `GET /api/players/:id` to auto-login
  - Duplicate name → 409 → show error

  ### Hooks
  - **`useGame.js`**: spin logic, bet state, optimistic balance deduction, staggered reel animation (one reel every 380ms left→right), apply server
  result on final reel
  - **`useSession.js`**: single Socket.io connection per client, listen for `session:state`, `session:scoreboard`, `session:ended`

  ### Components
  - `App.jsx` — router root; manages player + session state; auto-login on mount
  - `NameEntry.jsx` — player registration form
  - `SlotMachine.jsx` — main game UI (reels + controls)
  - `Reel.jsx` — individual reel with stagger animation
  - `BetControls.jsx` — bet amount selector (10/25/50/100)
  - `BalanceDisplay.jsx` — current balance
  - `Scoreboard.jsx` — live leaderboard pushed via Socket.io
  - `Timer.jsx` — session countdown
  - `HallOfFame.jsx` — all-time top winners
  - `HistoryPanel.jsx` — last 20 spins for current player
  - `MessageBanner.jsx` — win/loss message overlay
  - `WinnerAnnouncement.jsx` — round winner popup
  - `TournamentOver.jsx` — end-of-round screen
  - `AdminLogin.jsx` — admin password form
  - `AdminPage.jsx` — session management (start lobby, next round, reset, purge users)

  ### Nginx Config (`client/nginx.conf`)
  ```nginx
  server {
      listen 80;
      root /usr/share/nginx/html;
      index index.html;
      location /api/ { proxy_pass http://server:3001; proxy_http_version 1.1; }
      location /socket.io/ { proxy_pass http://server:3001; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header
  Connection "upgrade"; proxy_read_timeout 86400; }
      location / { try_files $uri $uri/ /index.html; }
  }
  ```

  ---

  ## Docker

  ### `docker-compose.yml`
  Three services: `mongodb` (mongo:7, healthcheck), `server` (builds from `./server`), `client` (builds from `./client`, exposes `8080:80`). Server
  depends on mongodb healthy. Client depends on server.

  ### Dockerfiles
  - **Client**: multi-stage — `node:20-alpine` build → `nginx:alpine` serve
  - **Server**: `node:20-alpine`

  ---
  ## CI/CD (GitHub Actions — `.github/workflows/ci.yml`)

  Six jobs, runs on push and PR to `main`. All actions forced to Node.js 24 via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`.

  1. **code-scan** — CodeQL SAST (`javascript-typescript`, `security-extended` queries) → GitHub Security tab
  2. **build-and-test** — `npm ci` (workspace root), client Vitest tests, server `node --test`, Vite build, upload `client-dist` artifact
  3. **performance-test** (needs build-and-test) — MongoDB service + API server + Locust 2-user 10s headless → `locust-performance-report` artifact
  4. **dast-zap** (needs build-and-test, parallel with perf) — OWASP ZAP Docker (`ghcr.io/zaproxy/zaproxy:stable`, `--network host`); baseline scan
  on PRs, full scan + Ajax Spider (`-a`) on main push; rules from `.zap/rules.tsv`; reports uploaded as `zap-scan-report` artifact
  5. **container-build-scan-push** (needs build-and-test + performance-test + dast-zap) — build client/server images with Docker Buildx (GHA cache),
  Trivy scan HIGH/CRITICAL (`sarif` + `table` formats), upload SARIF to GitHub Security, push to DockerHub on main only
  6. **update-gitops** (needs container-build-scan-push, main push only) — checkout `pkhamdee/slotmachine-deployment` dev branch, `kustomize edit set
   image` on both overlays, commit and push

  ### ZAP Rules (`.zap/rules.tsv`)
  FAIL: NoSQL injection (40032), XSS reflected (40012), XSS persistent (40014), SQL/NoSQL injection (40018), server-side code injection (90019),
  source code disclosure (10045).
  WARN: all security header findings (10020, 10021, 10035, 10037, 10038, 10063, 10098, 40040), CSRF (10202), path traversal (6), RFI (7).
  IGNORE: suspicious comments (10027, false positive from React build), timestamp disclosure (10096, Socket.io noise), 10055 (CSP no-fallback on
  Express 404 routes, false positive for JSON API), cacheable content (10049).

  ---

  ## Secrets Required
  `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `ADMIN_PASSWORD`, `DEPLOY_REPO_TOKEN`


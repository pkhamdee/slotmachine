# Project Brain — Nutanix Slot Machine

## Stack
React 18 + Vite (SPA), plain JavaScript (ES modules), custom CSS (no framework), Express + Socket.io (API + real-time), Mongoose + MongoDB 7, Docker + Docker Compose (deployment), Nginx (static serving + reverse proxy)

## Commands
| Command | Purpose |
|---|---|
| `docker compose up -d` | Build and start full stack (client on :8080) |
| `docker compose up -d --build` | Rebuild images then start |
| `docker compose stop` | Stop all containers |
| `docker compose logs -f server` | Tail server logs |
| `cd client && npm run dev` | Vite dev server (client only, :5173) |
| `cd server && node server.js` | Run API server directly (requires local Mongo) |

## Project Structure
```
slotmachine/
  client/
    src/
      api/          # fetch wrappers (gameApi.js) — all HTTP calls live here
      components/   # React components (one file per component)
      constants/    # symbols.js — slot symbol definitions with weights/payouts
      hooks/        # useGame.js (spin logic), useSession.js (Socket.io)
      styles/       # game.css — single global stylesheet, BEM naming
    nginx.conf      # Nginx: serves SPA + proxies /api/ and /socket.io/ → server:3001
    Dockerfile      # multi-stage: node:20-alpine build → nginx:alpine serve
  server/
    src/
      config/       # gameConfig.js — sessionDuration, lobbyDuration
      controllers/  # gameController.js (player/spin), sessionController.js (admin)
      middleware/   # adminAuth.js — random token issued at login
      models/       # Mongoose models: Player, GameRound, GameSession, PlayerSession, HallOfFame
      routes/       # gameRoutes.js, sessionRoutes.js
      services/     # SessionManager.js (singleton), slotEngine.js (pure functions)
    server.js       # entry: Express + Socket.io + Mongoose boot
    Dockerfile      # node:20-alpine
  docker-compose.yml
  C4_DIAGRAM.md     # Architecture diagrams (all four C4 levels)
```

## Conventions
- **JavaScript only** — no TypeScript; keep files simple and readable
- **ES modules** (`"type": "module"`) in both client and server
- **BEM CSS** — `.block__element--modifier`; all styles in `client/src/styles/game.css`
- **No CSS framework** — write utility classes manually; keep styles co-located by concern
- **Functional components and hooks only** — no class components
- **Single responsibility** — one concern per hook/component/service
- **No prop drilling** — pass only what the component needs; lift state to App only when shared
- **No speculative abstractions** — implement what is asked, nothing more

## Key Patterns

### Real-time (Socket.io)
- `useSession.js` opens one Socket.io connection per client, listens for `session:state`, `session:scoreboard`, `session:ended`
- Server emits these from `SessionManager` — never from controllers
- On new connection, `SessionManager.init()` replays last known state, scoreboard, and winner so late joiners are in sync

### Session State Machine
```
waiting → lobby (admin triggers) → active (lobby timer) → ended (round timer)
                                                         ↓
                                              waiting (admin reset)
                                              lobby   (admin next round)
```
- `SessionManager` is a singleton — it owns all timer logic
- Scoreboard pushed every 1 second via `setInterval` during `active` state; no per-spin push
- All player balances reset to 1000 at the start of every lobby phase

### Spin Flow
1. `useGame` deducts bet optimistically from local state
2. API call `POST /api/players/:id/spin` runs `spinReels()` + `evaluatePayout()` server-side
3. `Player.findOneAndUpdate` with `$inc: { balance: payout - bet }` (atomic, prevents race)
4. Response returns `grid`, `payout`, `balanceAfter`, `matchCount`, `matchSymbol`
5. Client staggers reel stops: one reel every 380 ms (left to right); final reel applies server result

### Slot Grid
- `grid[col][row]` — 5 columns × 3 rows
- Payline = **middle row** (row index 1) only
- Payout evaluated left-to-right: 5-of-a-kind → 4-of-a-kind → 3-of-a-kind → cherry partial (2+)

### Admin Auth
- No session store — a single random token is generated at server start (`adminAuth.js`)
- `POST /api/admin/login` validates `ADMIN_PASSWORD` env var and returns the token
- Protected routes use `requireAdminAuth` middleware checking `Authorization: Bearer <token>`
- Token is stored in React component state only (not localStorage); lost on page refresh = re-login

### Player Identity
- UUID `playerId` generated server-side on registration, stored in `localStorage`
- `App.jsx` auto-logs in returning players by calling `GET /api/players/:id` on mount
- Duplicate names rejected with 409 at registration

## Environment Variables (server)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API server port |
| `MONGO_URI` | — | MongoDB connection string |
| `SESSION_DURATION` | `180` | Active round length in seconds |
| `LOBBY_DURATION` | `10` | Lobby countdown in seconds |
| `ADMIN_PASSWORD` | — | Admin login password |

## Agents (invoke with `/agent <name>`)
| Agent | When to use |
|---|---|
| `code-reviewer` | Before any significant change ships |
| `debugger` | When you have a runtime error or unexpected behavior |
| `refactorer` | After a feature works and is confirmed correct |
| `security-auditor` | Before exposing the app to a wider audience |

## Custom Commands (invoke with `/<name>`)
| Command | Purpose |
|---|---|
| `/commit` | Stage, draft message, and create a git commit |
| `/pr-review <number>` | Structured PR review |
| `/fix-issue <number>` | Fetch GitHub issue and implement fix |

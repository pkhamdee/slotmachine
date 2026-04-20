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
├── docker-compose.yml          # Orchestrates mongo, server, client
├── client/
│   ├── nginx.conf              # SPA serving + /api, /socket.io proxy
│   ├── Dockerfile              # node:20-alpine build → nginx:alpine
│   └── src/
│       ├── api/
│       │   └── gameApi.js      # All HTTP fetch wrappers (single source of truth)
│       ├── components/
│       │   ├── SlotMachine.jsx # Main game UI; reels + controls
│       │   ├── Reel.jsx        # Individual reel animation
│       │   ├── BetControls.jsx # Bet amount selector
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
│       └── styles/
│           └── game.css        # Single global stylesheet (BEM)
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
        │   └── adminAuth.js    # Random token auth (issued at server start)
        ├── models/
        │   ├── Player.js       # playerId, name, balance
        │   ├── GameSession.js  # Session lifecycle record
        │   ├── GameRound.js    # Per-spin record
        │   ├── PlayerSession.js
        │   └── HallOfFame.js   # Persisted top scores
        ├── routes/
        │   ├── gameRoutes.js
        │   └── sessionRoutes.js
        └── services/
            ├── SessionManager.js  # Singleton — owns all timer + state logic
            └── slotEngine.js      # Pure functions: spinReels, evaluatePayout
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
| `ADMIN_PASSWORD` | — | Admin login password |

> Default in `docker-compose.yml`: `ADMIN_PASSWORD=admin1234`

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/players` | — | Register a new player |
| GET | `/api/players/:id` | — | Get player info |
| POST | `/api/players/:id/spin` | — | Spin the reels |
| POST | `/api/admin/login` | — | Get admin token |
| POST | `/api/admin/session/start` | Admin | Start lobby |
| POST | `/api/admin/session/reset` | Admin | Reset to waiting |
| GET | `/api/hall-of-fame` | — | All-time top scores |

---

## Socket.io Events (server → client)

| Event | Payload | When emitted |
|---|---|---|
| `session:state` | `{ phase, timeRemaining }` | On state change + new connection |
| `session:scoreboard` | `[{ name, balance }]` | Every 1s during active phase |
| `session:ended` | `{ winner, scores }` | When round ends |

# C4 Architecture Diagram — Nutanix Slot Machine

---

## Level 1 — System Context

```mermaid
C4Context
  title System Context: Nutanix Slot Machine

  Person(player, "Player", "Joins via browser or QR code scan, spins the slot machine during an active round")
  Person(admin, "Admin", "Controls tournament flow: starts rounds, resets, purges players")

  System(slotmachine, "Nutanix Slot Machine", "Multiplayer browser-based slot machine tournament system with real-time leaderboard")

  Rel(player, slotmachine, "Registers, spins reels, views scoreboard", "HTTPS / WebSocket")
  Rel(admin, slotmachine, "Logs in, manages rounds and players", "HTTPS")
```

---

## Level 2 — Container Diagram

```mermaid
C4Container
  title Container Diagram: Nutanix Slot Machine

  Person(player, "Player")
  Person(admin, "Admin")

  Container_Boundary(docker, "Docker Compose Stack") {

    Container(nginx, "Nginx (Client)", "nginx:alpine", "Serves React SPA on port 8080. Reverse-proxies /api/ and /socket.io/ to the API server")
    Container(server, "API Server", "Node.js / Express", "REST API + Socket.io server. Manages game sessions, player accounts, spin logic, and real-time events")
    ContainerDb(mongo, "MongoDB", "mongo:7", "Persists players, game sessions, spin rounds, player sessions, and hall of fame")
  }

  Rel(player, nginx, "Opens game in browser, scans QR code", "HTTP :8080")
  Rel(admin, nginx, "Accesses /admin panel", "HTTP :8080")
  Rel(nginx, server, "Proxies REST calls + WebSocket", "HTTP :3001")
  Rel(server, mongo, "Reads/writes game data", "Mongoose / MongoDB wire protocol")
```

---

## Level 3 — Component Diagram: API Server

```mermaid
C4Component
  title Component Diagram: API Server (Node.js / Express)

  Container_Boundary(server, "API Server") {

    Component(entrypoint, "server.js", "Express + http.Server", "App entrypoint. Wires Express, Socket.io, Mongoose. Calls SessionManager.init() and SessionManager.start() on boot")

    Component(gameRoutes, "gameRoutes", "Express Router", "Routes: POST /players, GET /players/:id, POST /players/:id/spin, GET /players/:id/history")
    Component(sessionRoutes, "sessionRoutes", "Express Router", "Routes: GET /sessions/current, GET /hall-of-fame, POST /admin/login, POST /admin/next-round, POST /admin/reset, POST /admin/purge-users, GET /admin/players")

    Component(gameCtrl, "gameController", "Express Controller", "registerPlayer (dedup by name), getPlayer, spin (validate bet → spinReels → evaluatePayout → update balance → persist GameRound), getHistory")
    Component(sessionCtrl, "sessionController", "Express Controller", "adminLogin, getHallOfFame, getSessionState, startNextRound, resetTournament, purgeUsers, listPlayers")

    Component(adminAuth, "adminAuth middleware", "Express Middleware", "Issues a random token on login. requireAdminAuth validates Authorization: Bearer header on protected routes")

    Component(sessionMgr, "SessionManager", "Singleton Service", "State machine: waiting → lobby → active → ended. Manages round timers, resets player balances to 1000 on round start, pushes scoreboard via Socket.io every 1 second during active round, determines winner by highest balance at round end")
    Component(slotEngine, "slotEngine", "Pure Service", "spinReels(): builds 5×3 grid using weighted random picks. evaluatePayout(): checks middle-row payline for 5/4/3-of-a-kind and cherry partial — returns outcome, payout, matchCount, matchSymbol")
    Component(gameConfig, "gameConfig", "Config", "sessionDuration: 180s, lobbyDuration: 10s (overridable via env vars)")

    Component(playerModel, "Player model", "Mongoose Model", "Fields: playerId (UUID), name (unique), balance")
    Component(gameRoundModel, "GameRound model", "Mongoose Model", "Fields: playerId, bet, grid (5×3), outcome, payout, matchCount, matchSymbol, balanceBefore, balanceAfter")
    Component(gameSessionModel, "GameSession model", "Mongoose Model", "Fields: state (waiting/lobby/active/ended), roundNumber, durationSeconds, startedAt, endedAt, winnerId, winnerName, winnerPayout")
    Component(playerSessionModel, "PlayerSession model", "Mongoose Model", "Fields: sessionId, playerId, playerName, totalPayout, spinCount")
    Component(hofModel, "HallOfFame model", "Mongoose Model", "Fields: sessionId, winnerName, winnerPlayerId, winnerPayout — one record per completed round")
  }

  ContainerDb(mongo, "MongoDB")
  Container(nginx, "Nginx / Client")

  Rel(nginx, gameRoutes, "REST requests")
  Rel(nginx, sessionRoutes, "REST requests")
  Rel(entrypoint, gameRoutes, "mounts at /api")
  Rel(entrypoint, sessionRoutes, "mounts at /api")
  Rel(entrypoint, sessionMgr, "init(io), start()")

  Rel(gameRoutes, gameCtrl, "delegates")
  Rel(sessionRoutes, sessionCtrl, "delegates")
  Rel(sessionRoutes, adminAuth, "requireAdminAuth guard")

  Rel(gameCtrl, slotEngine, "spinReels(), evaluatePayout()")
  Rel(gameCtrl, sessionMgr, "getCurrentSession(), recordPayout()")
  Rel(gameCtrl, playerModel, "find, findOneAndUpdate")
  Rel(gameCtrl, gameRoundModel, "create")
  Rel(gameCtrl, playerSessionModel, "findOneAndUpdate (upsert)")

  Rel(sessionCtrl, sessionMgr, "startNextRound(), resetTournament()")
  Rel(sessionCtrl, hofModel, "aggregate (hall of fame)")
  Rel(sessionCtrl, playerModel, "deleteMany (purge), find (list)")

  Rel(sessionMgr, gameSessionModel, "create, save, updateMany")
  Rel(sessionMgr, playerSessionModel, "find (scoreboard, winner)")
  Rel(sessionMgr, playerModel, "updateMany (balance reset), find (current balances)")
  Rel(sessionMgr, hofModel, "create (end of round)")
  Rel(sessionMgr, gameConfig, "reads sessionDuration, lobbyDuration")

  Rel(playerModel, mongo, "stores")
  Rel(gameRoundModel, mongo, "stores")
  Rel(gameSessionModel, mongo, "stores")
  Rel(playerSessionModel, mongo, "stores")
  Rel(hofModel, mongo, "stores")
```

---

## Level 3 — Component Diagram: React Client

```mermaid
C4Component
  title Component Diagram: React Client (Vite SPA)

  Container_Boundary(client, "React Client") {

    Component(app, "App.jsx", "React Root Component", "Orchestrates view routing (game / admin). Handles auto-login from localStorage, balance sync on round reset, winner overlay display")

    Component(useSession, "useSession hook", "React Hook", "Opens Socket.io connection. Listens for session:state, session:scoreboard, session:ended events. Signals balance reset when lobby starts")
    Component(useGame, "useGame hook", "React Hook", "Manages spin flow: immediate balance deduction → API call → staggered reel stops (380 ms apart). Auto-spin mode. Bet controls (min/max/adjust)")

    Component(nameEntry, "NameEntry", "React Component", "Player registration form. Generates QR code (qrcode lib) pointing to window.location.origin so mobile players can scan to join")
    Component(slotMachine, "SlotMachine", "React Component", "Casino UI layout: banner, 5×3 reel window, controls bar (BET / AUTO / MAX / SPIN / WIN / BALANCE)")
    Component(reel, "Reel", "React Component", "Always renders exactly 3 cells. Animates by cycling symbols via setInterval(80 ms) while spinning. Stops with a bounce animation. Highlights winning columns in gold")
    Component(scoreboard, "Scoreboard", "React Component", "Top-10 players ranked by current balance, updated every 1 second via WebSocket push")
    Component(timer, "Timer", "React Component", "Displays countdown for lobby and active states")
    Component(winnerAnnouncement, "WinnerAnnouncement", "React Component", "Overlay shown at round end with winner name and final balance")
    Component(hallOfFame, "HallOfFame", "React Component", "All-time winners aggregated from /api/hall-of-fame")
    Component(adminPage, "AdminPage", "React Component", "Admin panel: session control (next round / reset), player list, scoreboard, purge users. Polls /admin/players every 8 s. Handles 401 by forcing re-login")
    Component(adminLogin, "AdminLogin", "React Component", "Password form that posts to /api/admin/login and stores the bearer token")

    Component(gameApi, "gameApi.js", "API Client", "fetch wrappers: registerPlayer, getPlayer, spinReels, getHistory. Admin calls: adminLogin, startNextRound, resetTournament, purgeUsers, listPlayers")
    Component(symbols, "symbols.js", "Constants", "8 slot symbols with emoji, weight, payout3/4/5 multipliers used for client-side random display during spin animation")
  }

  Container(server, "API Server")

  Rel(app, useSession, "receives sessionState, scoreboard, winner, balanceReset")
  Rel(app, nameEntry, "shown when no player logged in")
  Rel(app, slotMachine, "shown in game view")
  Rel(app, scoreboard, "shown in sidebar")
  Rel(app, timer, "shown in game view")
  Rel(app, winnerAnnouncement, "shown as overlay on round end")
  Rel(app, hallOfFame, "shown in sidebar")
  Rel(app, adminPage, "shown in admin view")

  Rel(slotMachine, useGame, "uses hook for spin logic")
  Rel(slotMachine, reel, "renders 5 Reel components")

  Rel(adminPage, adminLogin, "shown when not authenticated")

  Rel(useSession, server, "WebSocket (Socket.io) — session:state, session:scoreboard, session:ended")
  Rel(gameApi, server, "REST calls over HTTP")
  Rel(useGame, gameApi, "spinReels()")
  Rel(app, gameApi, "getPlayer() on auto-login")
  Rel(adminPage, gameApi, "admin API calls")
  Rel(hallOfFame, gameApi, "getHallOfFame()")
  Rel(nameEntry, gameApi, "registerPlayer()")
  Rel(useGame, symbols, "randomGrid() during animation")
```

---

## Data Flow — Spin Sequence

```mermaid
sequenceDiagram
  participant P as Player (Browser)
  participant UI as useGame hook
  participant API as Express /spin
  participant SE as slotEngine
  participant DB as MongoDB

  P->>UI: clicks SPIN
  UI->>UI: deduct bet from local balance (optimistic)
  UI->>API: POST /api/players/:id/spin { bet }
  API->>DB: find Player (check balance ≥ bet)
  API->>SE: spinReels() → 5×3 grid
  API->>SE: evaluatePayout(grid, bet) → outcome, payout
  API->>DB: Player.findOneAndUpdate $inc balance (payout - bet)
  API->>DB: GameRound.create (full spin record)
  API->>DB: PlayerSession.findOneAndUpdate (upsert spinCount)
  API-->>UI: { grid, outcome, payout, balanceAfter, matchCount }
  UI->>UI: stagger reel stops (5 × 380 ms)
  UI->>UI: apply final grid + balanceAfter on last reel stop
```

---

## Data Flow — Session State Machine

```mermaid
stateDiagram-v2
  [*] --> waiting : server boot
  waiting --> lobby : Admin clicks "Start Round"\n(resets all balances to 1000)
  lobby --> active : lobby timer expires (10 s)
  active --> ended : round timer expires (180 s)\nwinner = highest balance\nHallOfFame record created
  ended --> waiting : Admin resets tournament\n(clears all sessions)
  ended --> lobby : Admin starts next round
```

---

## Deployment View

```mermaid
C4Deployment
  title Deployment: Docker Compose (single host)

  Deployment_Node(host, "Linux Host", "Docker Engine") {

    Deployment_Node(clientContainer, "slotmachine-client", "Docker container: nginx:alpine") {
      Container(nginxInst, "Nginx", "Serves React SPA, reverse-proxies API + WebSocket")
    }

    Deployment_Node(serverContainer, "slotmachine-server", "Docker container: node:20-alpine") {
      Container(serverInst, "Express + Socket.io", "REST API and real-time event bus")
    }

    Deployment_Node(mongoContainer, "slotmachine-mongo", "Docker container: mongo:7") {
      ContainerDb(mongoInst, "MongoDB", "Persistent volume: mongo_data")
    }
  }

  Person(user, "User / Admin")

  Rel(user, nginxInst, "HTTP :8080")
  Rel(nginxInst, serverInst, "HTTP :3001 (internal Docker network)")
  Rel(serverInst, mongoInst, "MongoDB :27017 (internal Docker network)")
```

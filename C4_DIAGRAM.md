# C4 Architecture Diagram — Nutanix Slot Machine

---

## Level 1 — System Context

```mermaid
C4Context
  title System Context: Nutanix Slot Machine

  Person(player, "Player", "Joins via browser or QR code scan, spins the slot machine during an active round")
  Person(admin, "Admin", "Controls tournament flow: starts rounds, resets, purges players")
  Person(developer, "Developer", "Commits code, monitors CI/CD results, manages deployments")

  System(slotmachine, "Nutanix Slot Machine", "Multiplayer browser-based slot machine tournament system with real-time leaderboard")

  System_Ext(github, "GitHub / GitHub Actions", "Source control and CI/CD pipeline. Runs CodeQL SAST, OWASP ZAP DAST, Locust performance tests, and Trivy container scans on every push and pull request")
  System_Ext(dockerhub, "Docker Hub", "Container registry. Stores pkhamdee/slotmachine:client and pkhamdee/slotmachine:server images tagged by Git SHA")
  System_Ext(k8s, "Kubernetes Cluster", "Production deployment target managed via GitOps. Kustomize overlays in pkhamdee/slotmachine-deployment repo")

  Rel(player, slotmachine, "Registers, spins reels, views scoreboard", "HTTP / WebSocket")
  Rel(admin, slotmachine, "Logs in, manages rounds and players", "HTTP")
  Rel(developer, github, "Pushes code, reviews CI results and security alerts", "HTTPS")
  Rel(github, slotmachine, "DAST scans running app (OWASP ZAP)", "HTTP :3001")
  Rel(github, dockerhub, "Pushes signed images on main branch merge", "HTTPS")
  Rel(github, k8s, "Updates image tags in kustomize overlays via deployment repo", "Git / HTTPS")
```

---

## Level 2 — Container Diagram

```mermaid
C4Container
  title Container Diagram: Nutanix Slot Machine

  Person(player, "Player")
  Person(admin, "Admin")

  Container_Boundary(docker, "Docker Compose Stack") {

    Container(nginx, "Nginx (Client)", "nginx:alpine", "Serves React SPA on port 8080. Reverse-proxies /api/ and /socket.io/ to the API server on the internal Docker network")
    Container(server, "API Server", "Node.js 20 / Express + Socket.io", "REST API + real-time event bus. Enforces security headers (CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy) and restricted CORS on every response")
    ContainerDb(mongo, "MongoDB", "mongo:7", "Persists players, game sessions, spin rounds, player sessions, and hall of fame. Mounted as named volume mongo_data")
  }

  System_Ext(dockerhub, "Docker Hub", "pkhamdee/slotmachine images")

  Rel(player, nginx, "Opens game in browser", "HTTP :8080")
  Rel(admin, nginx, "Accesses /admin panel", "HTTP :8080")
  Rel(nginx, server, "Proxies REST calls + WebSocket upgrade", "HTTP :3001 (internal)")
  Rel(server, mongo, "Reads/writes game data", "Mongoose / MongoDB wire protocol (internal)")
  Rel(dockerhub, nginx, "Image source: pkhamdee/slotmachine:client", "pulled on deploy")
  Rel(dockerhub, server, "Image source: pkhamdee/slotmachine:server", "pulled on deploy")
```

---

## Level 3 — Component Diagram: API Server

```mermaid
C4Component
  title Component Diagram: API Server (Node.js / Express)

  Container_Boundary(server, "API Server") {

    Component(entrypoint, "server.js", "Express + http.Server", "App entrypoint. Disables X-Powered-By. Wires CORS (CORS_ORIGIN env), security headers middleware, Express, Socket.io, and Mongoose. Calls SessionManager.init(io) and SessionManager.start() before listening")

    Component(secHeaders, "Security Headers Middleware", "Express Middleware", "Applied before all routes. Sets: Content-Security-Policy (default-src/form-action/frame-ancestors/base-uri/navigate-to all 'none'), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Permissions-Policy. Addresses ZAP rules 10020 10021 10037 10038 10055 10063")
    Component(corsMiddleware, "CORS Middleware", "cors npm package", "Restricts origin to CORS_ORIGIN env var (default: http://localhost:5173). Not wildcard. Addresses ZAP rules 10098 40040")

    Component(gameRoutes, "gameRoutes", "Express Router", "POST /players, GET /players/:id, POST /players/:id/spin, GET /players/:id/history")
    Component(sessionRoutes, "sessionRoutes", "Express Router", "GET /sessions/current, GET /hall-of-fame, POST /admin/login, POST /admin/next-round, POST /admin/reset, POST /admin/purge-users, GET /admin/players")

    Component(gameCtrl, "gameController", "Express Controller", "registerPlayer (409 on duplicate name), getPlayer, spin (validate session + balance → spinReels → evaluatePayout → atomic $inc → persist GameRound), getHistory")
    Component(sessionCtrl, "sessionController", "Express Controller", "adminLogin, getHallOfFame, getSessionState, startNextRound, resetTournament, purgeUsers, listPlayers")

    Component(adminAuth, "adminAuth middleware", "Express Middleware", "Generates crypto.randomBytes(32) token at server start. requireAdminAuth checks Authorization: Bearer header. No session store — token lost on server restart")

    Component(sessionMgr, "SessionManager", "Singleton Service", "State machine: waiting → lobby → active → ended. Owns all timers. Resets all player balances to 1000 on lobby start. Pushes scoreboard via Socket.io every 1s during active. Determines winner by highest balance at round end. Replays state to late-joining clients on connect")
    Component(slotEngine, "slotEngine", "Pure Service", "spinReels(): builds grid[col][row] 5×3 using weighted random. evaluatePayout(): checks middle row payline left-to-right for 5/4/3-of-a-kind and cherry partial (2+)")
    Component(gameConfig, "gameConfig", "Config", "Reads SESSION_DURATION (default 180s) and LOBBY_DURATION (default 10s) from env")

    Component(playerModel, "Player model", "Mongoose Model", "playerId (UUID, unique), name (unique), balance")
    Component(gameRoundModel, "GameRound model", "Mongoose Model", "playerId, bet, grid (5×3), outcome, payout, matchCount, matchSymbol, balanceBefore, balanceAfter")
    Component(gameSessionModel, "GameSession model", "Mongoose Model", "state, roundNumber, durationSeconds, startedAt, endedAt, winnerId, winnerName, winnerPayout")
    Component(playerSessionModel, "PlayerSession model", "Mongoose Model", "sessionId, playerId, playerName, totalPayout, spinCount")
    Component(hofModel, "HallOfFame model", "Mongoose Model", "sessionId, winnerName, winnerPlayerId, winnerPayout — one record per completed round")
  }

  ContainerDb(mongo, "MongoDB")
  Container(nginx, "Nginx / Client")

  Rel(nginx, gameRoutes, "REST requests")
  Rel(nginx, sessionRoutes, "REST requests")
  Rel(entrypoint, secHeaders, "applies first")
  Rel(entrypoint, corsMiddleware, "applies second")
  Rel(entrypoint, gameRoutes, "mounts at /api")
  Rel(entrypoint, sessionRoutes, "mounts at /api")
  Rel(entrypoint, sessionMgr, "init(io), start()")

  Rel(gameRoutes, gameCtrl, "delegates")
  Rel(sessionRoutes, sessionCtrl, "delegates")
  Rel(sessionRoutes, adminAuth, "requireAdminAuth on protected routes")

  Rel(gameCtrl, slotEngine, "spinReels(), evaluatePayout()")
  Rel(gameCtrl, sessionMgr, "checks active phase, records payout")
  Rel(gameCtrl, playerModel, "find, findOneAndUpdate ($inc balance)")
  Rel(gameCtrl, gameRoundModel, "create spin record")
  Rel(gameCtrl, playerSessionModel, "upsert spinCount + totalPayout")

  Rel(sessionCtrl, sessionMgr, "startNextRound(), resetTournament()")
  Rel(sessionCtrl, hofModel, "aggregate for hall of fame")
  Rel(sessionCtrl, playerModel, "deleteMany (purge), find (list)")

  Rel(sessionMgr, gameSessionModel, "create, save, updateMany")
  Rel(sessionMgr, playerSessionModel, "find scoreboard + winner")
  Rel(sessionMgr, playerModel, "updateMany balance reset, find current balances")
  Rel(sessionMgr, hofModel, "create record on round end")
  Rel(sessionMgr, gameConfig, "reads durations")

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

    Component(app, "App.jsx", "React Root Component", "Orchestrates view routing (game / admin). Auto-login from localStorage playerId on mount. Syncs balance on lobby reset. Shows winner overlay on round end")

    Component(useSession, "useSession hook", "React Hook", "Single Socket.io connection per client. Listens for session:state, session:scoreboard, session:ended. Signals balance reset when lobby starts")
    Component(useGame, "useGame hook", "React Hook", "Spin flow: optimistic balance deduction → POST /spin → staggered reel stops 380ms apart. Auto-spin mode. Bet amount controls (10/25/50/100)")

    Component(nameEntry, "NameEntry", "React Component", "Player registration form. Generates QR code pointing to window.location.origin so mobile players can scan to join")
    Component(slotMachine, "SlotMachine", "React Component", "Casino UI: banner, 5×3 reel window, controls bar (BET / AUTO / MAX / SPIN / WIN / BALANCE)")
    Component(reel, "Reel", "React Component", "Renders exactly 3 cells. Animates by cycling symbols every 80ms while spinning. Stops with bounce animation. Highlights winning columns gold")
    Component(betControls, "BetControls", "React Component", "Bet amount selector (10 / 25 / 50 / 100). Disabled during spin")
    Component(balanceDisplay, "BalanceDisplay", "React Component", "Shows current balance; flashes on win/loss")
    Component(scoreboard, "Scoreboard", "React Component", "Top-10 players ranked by balance, updated every 1s via Socket.io push")
    Component(timer, "Timer", "React Component", "Countdown for lobby (pre-round) and active (in-round) states")
    Component(winnerAnnouncement, "WinnerAnnouncement", "React Component", "Overlay on round end — winner name and final balance")
    Component(tournamentOver, "TournamentOver", "React Component", "End-of-round screen shown to all non-winning players")
    Component(hallOfFame, "HallOfFame", "React Component", "All-time winners from GET /api/hall-of-fame")
    Component(historyPanel, "HistoryPanel", "React Component", "Last 20 spins for the current player")
    Component(messageBanner, "MessageBanner", "React Component", "Win/loss message overlay shown briefly after each spin result")
    Component(adminLogin, "AdminLogin", "React Component", "Password form — POSTs to /api/admin/login, stores bearer token in React state (not localStorage)")
    Component(adminPage, "AdminPage", "React Component", "Session management: start/reset/next-round, player list, scoreboard, purge. Polls /admin/players every 8s. Forces re-login on 401")

    Component(gameApi, "gameApi.js", "API Client", "All fetch wrappers: registerPlayer, getPlayer, spinReels, getHistory, adminLogin, startNextRound, resetTournament, purgeUsers, listPlayers, getHallOfFame")
    Component(symbols, "symbols.js", "Constants", "8 symbols with emoji, weight (used for server-side weighted random), and payout multipliers for 3/4/5-of-a-kind")
  }

  Container(server, "API Server")

  Rel(app, useSession, "session state, scoreboard, winner, balanceReset")
  Rel(app, nameEntry, "shown when no player logged in")
  Rel(app, slotMachine, "shown in game view")
  Rel(app, scoreboard, "shown in sidebar")
  Rel(app, timer, "shown in game view")
  Rel(app, winnerAnnouncement, "overlay on round end")
  Rel(app, hallOfFame, "shown in sidebar")
  Rel(app, adminPage, "shown in admin view")
  Rel(app, gameApi, "getPlayer() on auto-login")

  Rel(slotMachine, useGame, "spin logic, balance, bet state")
  Rel(slotMachine, reel, "renders 5 Reel components")
  Rel(slotMachine, betControls, "bet amount UI")
  Rel(slotMachine, balanceDisplay, "current balance")
  Rel(slotMachine, messageBanner, "win/loss feedback")
  Rel(slotMachine, historyPanel, "last 20 spins")

  Rel(adminPage, adminLogin, "shown when not authenticated")
  Rel(adminPage, gameApi, "admin API calls")

  Rel(useSession, server, "WebSocket (Socket.io) — session:state, session:scoreboard, session:ended")
  Rel(useGame, gameApi, "spinReels()")
  Rel(useGame, symbols, "client-side random grid during reel animation")
  Rel(gameApi, server, "REST over HTTP")
  Rel(hallOfFame, gameApi, "getHallOfFame()")
  Rel(nameEntry, gameApi, "registerPlayer()")
```

---

## Data Flow — Spin Sequence

```mermaid
sequenceDiagram
  participant P as Player (Browser)
  participant UI as useGame hook
  participant MW as Security Middleware
  participant API as Express /spin
  participant SE as slotEngine
  participant DB as MongoDB

  P->>UI: clicks SPIN
  UI->>UI: deduct bet from local balance (optimistic)
  UI->>MW: POST /api/players/:id/spin { bet }
  MW->>MW: set CSP, X-Frame-Options, X-Content-Type-Options,\nPermissions-Policy headers
  MW->>API: forward request
  API->>DB: find Player (check balance ≥ bet, session active)
  API->>SE: spinReels() → grid[col][row] 5×3
  API->>SE: evaluatePayout(grid, bet) → outcome, payout
  API->>DB: Player.findOneAndUpdate $inc balance (payout − bet) [atomic]
  API->>DB: GameRound.create (full spin record)
  API->>DB: PlayerSession.findOneAndUpdate upsert spinCount
  API-->>UI: { grid, payout, balanceAfter, matchCount, matchSymbol }
  UI->>UI: stagger reel stops (5 × 380 ms, left → right)
  UI->>UI: apply server grid + balanceAfter on last reel stop
```

---

## Data Flow — Session State Machine

```mermaid
stateDiagram-v2
  [*] --> waiting : server boot

  waiting --> lobby : Admin clicks Start Round\n(all balances reset to 1000)
  lobby --> active : LOBBY_DURATION expires (default 10 s)
  active --> ended : SESSION_DURATION expires (default 180 s)\nwinner = highest balance\nHallOfFame record created

  ended --> waiting : Admin resets tournament\n(clears all sessions)
  ended --> lobby : Admin starts next round\n(all balances reset to 1000)
```

---

## CI/CD Pipeline

```mermaid
flowchart TD
  push(["git push / pull request\nto main"])

  push --> codeql["code-scan\nCodeQL SAST\n(security-extended)\n→ GitHub Security tab"]
  push --> build["build-and-test\nnpm ci · Vitest · node --test\nVite build\n→ client-dist artifact"]

  build --> perf["performance-test\nLocust 2-user 10s headless\nMongoDB service\n→ locust-performance-report"]
  build --> zap["dast-zap\nOWASP ZAP Docker\nbaseline on PR\nfull + Ajax Spider on main\n→ zap-scan-report artifact"]

  perf --> container["container-build-scan-push\nDocker Buildx (GHA cache)\nTrivy HIGH/CRITICAL\n→ GitHub Security tab\n→ trivy-scan-reports artifact\nPush to DockerHub (main only)"]
  zap --> container

  container --> gitops["update-gitops\n(main push only)\nkustomize edit set image\nin slotmachine-deployment\ndevelopment branch"]

  gitops --> k8s(["Kubernetes cluster\npulls new image\nvia GitOps controller"])

  style codeql fill:#d4edda
  style zap fill:#d4edda
  style container fill:#d4edda
  style gitops fill:#cce5ff
```

### Security Gates per Commit

| Stage | Tool | Finding severity that blocks | Output |
|---|---|---|---|
| SAST | CodeQL | Error / Warning (security-extended) | GitHub Security → Code scanning |
| DAST | OWASP ZAP | FAIL rules in `.zap/rules.tsv` | `zap-scan-report` artifact |
| Container SCA | Trivy | HIGH / CRITICAL with fix available | GitHub Security → Code scanning |
| Performance | Locust | Server error rate > threshold | `locust-performance-report` artifact |

---

## Deployment View

```mermaid
C4Deployment
  title Deployment: Docker Compose (single host) + GitOps (Kubernetes)

  Deployment_Node(ci, "GitHub Actions", "CI/CD runner") {
    Container(pipeline, "CI Pipeline", "6-job workflow", "CodeQL · Locust · ZAP · Trivy · Docker push · kustomize update")
  }

  System_Ext(dockerhub, "Docker Hub", "pkhamdee/slotmachine — client and server images tagged by Git SHA")
  System_Ext(deployrepo, "slotmachine-deployment repo", "Kustomize overlays for development and production")

  Deployment_Node(host, "Linux Host", "Docker Engine") {
    Deployment_Node(clientContainer, "slotmachine-client", "nginx:alpine") {
      Container(nginxInst, "Nginx", "Serves React SPA, reverse-proxies /api/ and /socket.io/ to server:3001")
    }
    Deployment_Node(serverContainer, "slotmachine-server", "node:20-alpine") {
      Container(serverInst, "Express + Socket.io", "REST API, real-time event bus, security headers middleware")
    }
    Deployment_Node(mongoContainer, "slotmachine-mongo", "mongo:7") {
      ContainerDb(mongoInst, "MongoDB", "Named volume: mongo_data")
    }
  }

  Deployment_Node(k8s, "Kubernetes Cluster", "GitOps-managed") {
    Container(k8sclient, "slotmachine-client pod", "nginx:alpine", "From DockerHub image")
    Container(k8sserver, "slotmachine-server pod", "node:20-alpine", "From DockerHub image")
  }

  Person(user, "User / Admin")

  Rel(pipeline, dockerhub, "pushes images on main merge")
  Rel(pipeline, deployrepo, "kustomize edit set image")
  Rel(deployrepo, k8s, "GitOps controller syncs overlays")
  Rel(dockerhub, k8sclient, "image pull")
  Rel(dockerhub, k8sserver, "image pull")
  Rel(dockerhub, nginxInst, "image pull on compose up")
  Rel(dockerhub, serverInst, "image pull on compose up")

  Rel(user, nginxInst, "HTTP :8080")
  Rel(nginxInst, serverInst, "HTTP :3001 (internal)")
  Rel(serverInst, mongoInst, "MongoDB :27017 (internal)")
```

# ⚡ PulsePoll — Real-Time Live Polling Engine

A production-grade, human-crafted real-time live polling platform built with **React**, **Go (Gin)**, **MongoDB**, and **Redis**.

A creator can launch a poll, project the live presentation view or share a scannable QR code, and an audience can cast votes with instant, sub-millisecond animated percentage updates with **zero page refreshes**.

---

## 🌟 Architecture & Real Stack Work

All four stack layers perform meaningful work:

| Layer | Technology | Key Responsibility & Real Work |
|---|---|---|
| **Frontend** | **React (Vite)** | Responsive single-page app, animated percentage bars, WebSocket live synchronization, scannable QR code modal, floating live emoji reaction stream, dark/light theme, and duplicate vote handling. |
| **Realtime Engine** | **Redis** | Sub-millisecond atomic vote counter increments (`HINCRBY`), multi-layer voter deduplication sets (`SADD` / `SISMEMBER`), and Redis Pub/Sub channels (`poll:{id}:updates`) broadcasting live vote events. |
| **Backend** | **Go (Gin)** | High-throughput concurrent HTTP API, thread-safe WebSocket client hubs (Gorilla WebSocket), JWT auth middleware, bcrypt password hashing, input validation, and asynchronous MongoDB sync workers. |
| **Database** | **MongoDB** | Persistent storage of user accounts, poll configurations, choices, and immutable audit logs (`vote_logs`) with full CSV export capabilities. |

```
   ┌────────────────────────────────────────────────────────┐
   │             Audience & Host React Clients              │
   └───────────────┬────────────────────────▲───────────────┘
     1. Cast Vote  │                        │ 4. Live Updates
    (POST /vote)   │                        │    over WebSockets
                   ▼                        │
   ┌────────────────────────────────────────┴───────────────┐
   │            Go (Gin) Concurrent Backend API             │
   └───────────────┬────────────────────────▲───────────────┘
     2. Atomic     │                        │ 3. Redis Pub/Sub
     HINCRBY & Set │                        │    Event Broadcast
                   ▼                        │
   ┌────────────────────────────────────────┴───────────────┐
   │             Redis High-Speed In-Memory Layer           │
   │  - Hashes: Atomic Vote Counts (HINCRBY)                │
   │  - Sets: Voter Fingerprint Deduplication (SADD)        │
   │  - Channels: Live Poll Event Stream                    │
   └───────────────────────┬────────────────────────────────┘
                           │
                           │ 5. Async Write-Through
                           ▼
   ┌────────────────────────────────────────────────────────┐
   │             MongoDB Persistent Document Store          │
   │  - Users Collection (bcrypt credentials)               │
   │  - Polls Collection (questions, options, settings)     │
   │  - Vote Logs Collection (immutable audit trail)        │
   └────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

Strict separation of concerns between client and server:

```
c:/xampp/htdocs/polling/
├── backend/
│   ├── cmd/server/main.go            # Entry point, Gin router, WebSocket hub & graceful shutdown
│   ├── internal/
│   │   ├── config/config.go          # Environment configuration loader
│   │   ├── models/                   # User, Poll, Option, VoteLog, and LiveUpdate models
│   │   ├── repository/               # MongoDB driver & Redis driver (+ resilient fallback adapter)
│   │   ├── realtime/                 # Gorilla WebSocket hub, client read/write pumps, PubSub bridge
│   │   ├── services/                 # AuthService (JWT/bcrypt), PollService, VoteService
│   │   ├── handlers/                 # Gin HTTP controllers (auth, polls, votes, ws)
│   │   └── middleware/               # JWT Auth middleware, CORS handler
│   ├── go.mod & go.sum
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/client.js             # Axios API client with JWT interceptor
│   │   ├── context/                  # AuthContext & ThemeContext
│   │   ├── hooks/useWebSocket.js     # Real-time WebSocket hook with auto-reconnect
│   │   ├── utils/fingerprint.js      # Client device fingerprinting for deduplication
│   │   ├── components/               # Navbar, LiveResultsChart, VotingInterface, ReactionStream, QRCodeModal, PollCard
│   │   ├── pages/                    # HomePage, LoginPage, RegisterPage, DashboardPage, CreatePollPage, PollViewPage, PollAdminLivePage
│   │   ├── index.css                 # Custom glassmorphic design system
│   │   └── App.jsx                   # React Router layout and protected routes
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml                # 1-command startup for Go, Redis, Mongo & React
└── README.md                         # Documentation and architectural decisions
```

---

## 🚀 How to Run Locally

### Option A: 1-Command Startup with Docker Compose
```bash
docker-compose up --build
```
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **Redis**: `localhost:6379`
- **MongoDB**: `localhost:27017`

---

### Option B: Native Local Development

#### 1. Start the Go Backend
```bash
cd backend
go run cmd/server/main.go
```
*Note: The backend automatically connects to local or cloud MongoDB & Redis instances. If offline, the built-in resilient in-memory storage engine seamlessly activates with zero disruption.*

#### 2. Start the React Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔒 Key Design & Engineering Decisions

1. **Sub-millisecond Atomic Ingestion with Redis**:
   Votes are atomically incremented in Redis hashes via `HINCRBY` without database write locks. This allows high-throughput concurrent audience voting without throttling.
2. **Multi-layer Anti-Duplicate Protection**:
   Voting is protected through client browser tokens and Redis Sets (`SADD` / `SISMEMBER`) tracking device fingerprints and IP addresses.
3. **Write-Through Persistence Strategy**:
   Live counts stream instantly to viewers over Redis Pub/Sub and WebSockets. Audit log records and option tallies are asynchronously written to MongoDB in the background.
4. **Resilient Fallback Adapter**:
   The Go backend includes both full MongoDB/Redis drivers and thread-safe in-memory fallbacks, guaranteeing seamless operation in any environment.
5. **Interactive Audience Experiences**:
   Includes scannable QR codes for mobile audiences, live floating emoji reaction streams, and downloadable CSV audit reports for organizers.

---

## 📡 API Reference

### Authentication
- `POST /api/auth/register` — Register new creator account (`name`, `email`, `password`)
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET /api/auth/me` — (Protected) Get current user profile

### Poll Management
- `POST /api/polls` — (Protected) Create a new poll with custom choices & settings
- `GET /api/polls/my` — (Protected) List all polls owned by authenticated user
- `GET /api/polls/:idOrCode` — (Public) Fetch poll details by Mongo ID or 6-char share code
- `PUT /api/polls/:id` — (Protected) Toggle pause/resume or update poll settings
- `DELETE /api/polls/:id` — (Protected) Permanently delete a poll
- `POST /api/polls/:id/reset` — (Protected) Reset live vote tallies to zero
- `GET /api/polls/:id/export.csv` — (Protected) Download CSV report

### Voting & Interactions
- `POST /api/polls/:id/vote` — (Public) Cast a vote with server-side validation
- `GET /api/polls/:id/voted?fp=<token>` — (Public) Check if browser client has voted
- `POST /api/polls/:id/reactions` — (Public) Broadcast floating live emoji
- `GET /ws/polls/:id` — (Public) WebSocket live stream connection endpoint

# QueueZen 
### Intelligent Real-Time Queue & Appointment Optimization System

> A full-stack queue management platform for universities, hospitals, banks, and government offices. Built with React, Node.js, MongoDB Atlas, and Socket.IO.

---

##  Project Structure

```
QUEUEZEN/
├── backend/
│   ├── config/db.js              # MongoDB Atlas connection
│   ├── middleware/authMiddleware.js  # JWT protection
│   ├── models/
│   │   ├── Organization.js       # Auth + settings (replaces Admin + Settings)
│   │   └── Token.js              # Queue tokens
│   ├── routes/
│   │   ├── auth.js               # Register, login, settings
│   │   ├── queue.js              # All queue operations
│   │   └── health.js             # Health check
│   ├── services/queueService.js  # Business logic
│   ├── scripts/createAdmin.js    # Seed admin org
│   ├── app.js                    # Express setup
│   ├── server.js                 # Entry + Socket.IO
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── App.js                # Routes
    │   ├── App.css               # Global styles + design tokens
    │   ├── index.js
    │   ├── pages/
    │   │   ├── Home.js           # Landing page
    │   │   ├── Register.js       # Register organization
    │   │   ├── AdminLogin.js     # Admin sign in
    │   │   ├── AdminDashboard.js # Full control panel
    │   │   └── PublicQueue.js    # Public queue (users join here)
    │   ├── components/
    │   │   ├── UI.js             # Button, Card, Input, StatusBadge, etc.
    │   │   ├── Navbar.js
    │   │   ├── Footer.js
    │   │   ├── QueueCard.js
    │   │   └── StatsCard.js
    │   └── utils/
    │       ├── api.js            # Axios instance + all API calls
    │       └── socket.js         # Socket.IO client utility
    ├── .env.example
    └── package.json
```

---

##  Quick Start

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (free tier works)
- npm or yarn

---

### 1. Clone the project

```bash
git clone https://github.com/your-repo/queuezen.git
cd queuezen
```

---

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/queuezen?retryWrites=true&w=majority
JWT_SECRET=your_very_long_random_secret_here
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

Start backend:

```bash
npm run dev
```

Server runs at `http://localhost:5000`
Health check: `http://localhost:5000/health`

---

### 3. Frontend Setup

```bash
cd ../frontend
npm install
cp .env.example .env
```

Edit `.env`:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

Start frontend:

```bash
npm start
```

App runs at `http://localhost:3000`

---

##  App Flow

| URL | Description |
|-----|-------------|
| `/` | Landing page |
| `/register` | Register a new organization |
| `/admin/login` | Admin sign in |
| `/admin/dashboard` | Admin control panel (protected) |
| `/queue/:orgId` | **Public queue page** — share this URL with visitors |

---

##  API Reference

### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/register` | No | Register new organization |
| POST | `/auth/login` | No | Login, returns JWT |
| GET | `/auth/me` | JWT | Get current org info |
| PUT | `/auth/settings` | JWT | Update org name/dept/counter |

### Queue (Public)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/queue/:orgId` | No | Get full queue + stats + org info |
| POST | `/queue/:orgId/join` | No | Join queue, returns token |
| GET | `/queue/:orgId/token/:tokenId` | No | Get specific token + position |

### Queue (Admin — requires JWT)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/queue/action/next` | JWT | Call next token |
| POST | `/queue/action/skip` | JWT | Skip current token |
| POST | `/queue/action/complete` | JWT | Complete current token |
| DELETE | `/queue/action/clear` | JWT | Clear entire queue |
| GET | `/queue/action/stats` | JWT | Get live stats |

---

##  Real-Time (Socket.IO)

**Backend emits:**
```js
io.to(`org:${orgId}`).emit("queueUpdated", { queue, stats });
```

**Frontend listens:**
```js
socket.on("queueUpdated", ({ queue, stats }) => { ... });
```

Both the **admin dashboard** and **public queue** page subscribe to the same `org:<id>` room, ensuring instant sync.

---

##  Deployment

### Backend → Render
1. Create a Web Service on [render.com](https://render.com)
2. Root: `backend/`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables from `.env`

### Frontend → Vercel
1. Import project on [vercel.com](https://vercel.com)
2. Root: `frontend/`
3. Build: `npm run build`
4. Add env: `REACT_APP_API_URL=https://your-render-url.onrender.com`

---

##  Security Features
- **JWT** with 7-day expiry (auto-logout on 401)
- **bcryptjs** password hashing (12 salt rounds)
- **Rate limiting**: login (10 req/15min), join queue (5 req/min)
- **Input validation** on all endpoints via `express-validator`
- **CORS** restricted to frontend origin
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

---

##  Improvements Over Original Architecture

| Area | Original | QueueZen Enhanced |
|------|----------|-------------------|
| Data model | Separate Admin + Settings models | Single Organization model (cleaner) |
| Multi-tenancy | Single admin | Full multi-org with isolated queues |
| Registration | Manual script only | Self-service `/register` page |
| Real-time rooms | Global broadcast | Per-org Socket.IO rooms (isolated) |
| Stats | Basic counts | Counts + average wait time + serving token |
| Security | Basic JWT | Rate limiting + validation + security headers |
| Frontend | Basic pages | Full design system + animations + toasts |
| Token tracking | Not mentioned | Users see their live position + ETA |
| Error handling | Minimal | Global error handler + graceful shutdown |

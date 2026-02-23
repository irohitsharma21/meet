# 🤖 MeetAI – AI-Enhanced Meeting Platform

> **Production-ready Proof of Record system** — HD video meetings with real-time AI transcription, commitment detection, automated MoM generation, and Google Calendar integration.

---

## 📐 Architecture Overview

```
meet/
├── backend/               # FastAPI (Python 3.11)
│   ├── main.py            # App entry point + lifespan
│   ├── core/
│   │   ├── config.py      # Pydantic Settings (env vars)
│   │   └── security.py    # JWT, bcrypt, AES-256 encryption
│   ├── db/
│   │   └── mongodb.py     # Motor async client + index init
│   ├── models/
│   │   └── meeting_model.py  # All Pydantic models
│   ├── services/
│   │   ├── livekit_service.py       # Room & token management
│   │   ├── transcription_service.py # Groq Whisper STT
│   │   ├── ai_analysis_service.py   # LLM prompts + analysis
│   │   └── calendar_service.py      # Google Calendar OAuth2
│   └── routers/
│       ├── auth_routes.py     # JWT auth endpoints
│       ├── meeting_routes.py  # CRUD + WS transcription
│       ├── transcript_routes.py
│       └── calendar_routes.py
│
├── frontend/              # React 18 + TypeScript + Vite
│   └── src/
│       ├── App.tsx           # Router + layout
│       ├── pages/
│       │   ├── auth/         # Login, Register
│       │   ├── dashboard/    # Meeting list + search
│       │   ├── meeting/      # Live meeting room
│       │   ├── report/       # AI reports
│       │   └── calendar/     # Google Calendar connect
│       ├── components/
│       │   ├── common/       # Navbar, Toasts
│       │   └── meeting/      # VideoGrid, Transcript, Popups
│       ├── store/            # Zustand global state
│       ├── hooks/            # WS + audio capture hooks
│       ├── lib/              # Axios API client
│       └── types/            # Shared TypeScript types
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- MongoDB 7.0 (local or Atlas)
- [LiveKit Cloud](https://cloud.livekit.io/) account
- [Groq](https://console.groq.com/) API key
- (Optional) Google Cloud Project with Calendar API enabled

---

### 1. Clone & configure

```bash
cd meet

# Backend config
cp backend/.env.example backend/.env
# → Edit backend/.env with your real credentials

# Frontend config
cp frontend/.env.example frontend/.env
# → Edit frontend/.env
```

---

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Or Linux/Mac:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**  
API docs: **http://localhost:8000/docs**

---

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

### 4. MongoDB (local)

```bash
# Docker (easiest)
docker run -d --name meetai-mongo -p 27017:27017 mongo:7.0

# Or install MongoDB Community Edition:
# https://www.mongodb.com/docs/manual/installation/
```

---

## 🔑 Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | ✅ | JWT signing key (≥32 chars) |
| `MONGODB_URL` | ✅ | MongoDB connection string |
| `MONGODB_DB_NAME` | ✅ | Database name |
| `LIVEKIT_API_KEY` | ✅ | LiveKit API key |
| `LIVEKIT_API_SECRET` | ✅ | LiveKit API secret |
| `LIVEKIT_URL` | ✅ | LiveKit server URL (`wss://...`) |
| `GROQ_API_KEY` | ✅ | Groq API key |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth2 client secret |
| `ENCRYPTION_KEY` | Optional | AES-256 key (base64, 32 bytes) |

**Generate secrets:**
```bash
# JWT secret key
python -c "import secrets; print(secrets.token_hex(32))"

# AES-256 encryption key  
python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"
```

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_WS_URL` | WebSocket URL (`ws://...`) |
| `VITE_LIVEKIT_URL` | LiveKit server URL |

---

## 📡 API Documentation

The backend exposes a full OpenAPI spec at `/docs` (Swagger UI) and `/redoc`.

### Key Endpoints

#### Auth
```
POST /auth/register      – Create account
POST /auth/login         – Get JWT tokens
POST /auth/refresh       – Refresh access token
GET  /auth/me            – Get current user
```

#### Meetings
```
POST   /meetings/                    – Create meeting (host only)
GET    /meetings/                    – List/search meetings
GET    /meetings/{id}                – Get meeting details
POST   /meetings/{id}/join           – Get LiveKit token
POST   /meetings/{id}/start          – Start meeting
POST   /meetings/{id}/end            – End meeting
POST   /meetings/{id}/generate-report – Generate AI report
POST   /meetings/{id}/actions/{aid}/confirm  – Confirm action
POST   /meetings/{id}/actions/{aid}/reject   – Reject action
WS     /meetings/{id}/ws             – Real-time transcription
```

#### Transcripts
```
GET  /transcripts/{id}           – Get full transcript
GET  /transcripts/{id}/export    – Export as TXT or JSON
```

#### Calendar
```
GET  /calendar/connect           – Get Google OAuth2 URL
GET  /calendar/oauth2callback    – OAuth2 callback handler
GET  /calendar/status            – Check connection status
POST /calendar/events            – Create calendar event
POST /calendar/confirm-action    – Confirm action → calendar
```

---

## 🔌 WebSocket Protocol

Connect to: `ws://localhost:8000/meetings/{meeting_id}/ws`

**Handshake sequence:**
```json
// 1. Client sends identify (JWT)
{"cmd": "identify", "token": "<access_token>"}

// 2. Client sends audio config
{"cmd": "audio_config", "format": "webm", "sample_rate": 16000}

// 3. Client streams binary audio chunks (WebM/Opus)
// → Every 1.5 seconds from MediaRecorder

// Server → Client messages:
{"type": "connected", "username": "alice"}
{"type": "transcript", "entry": {"speaker": "alice", "text": "...", "time": "00:01:23"}}
{"type": "action_detected", "result": {"trigger": true, "type": "schedule", "confidence": 0.92, "suggested_action": "Schedule meeting Sunday 5PM?"}}
{"type": "error", "message": "..."}
```

---

## 🤖 AI Prompts

### Real-time Action Detection (Groq llama3-8b, <500ms)
Detects: scheduling commitments, task assignments, deadlines, responsibilities.

### Post-Meeting Summary (Groq llama3-70b)
Max 200 words executive summary highlighting key decisions.

### Minutes of Meeting (Groq llama3-70b)
Structured Markdown: Agenda → Discussion → Decisions → Action Table → Next Steps.

### Sentiment Analysis (Groq llama3-70b)
Overall tone, confidence score, key emotional shifts per timestamp.

---

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

---

## 🏭 Production Deployment Notes

### Security checklist
- [ ] Set `ENVIRONMENT=production` in `.env`
- [ ] Use a strong, unique `SECRET_KEY` (≥64 hex chars)
- [ ] Enable `ENCRYPTION_KEY` for AES-256 field encryption
- [ ] Configure MongoDB authentication
- [ ] Use MongoDB Atlas with TLS (encryption at rest included)
- [ ] Put backend behind HTTPS reverse proxy (nginx / Traefik)
- [ ] Set `ALLOWED_ORIGINS` to your production domain only
- [ ] Enable `HTTPSRedirectMiddleware` (automatic when `ENVIRONMENT=production`)

### Performance recommendations
- **Backend:** `uvicorn` with `--workers $(nproc)` + uvloop + httptools
- **MongoDB:** Enable sharding for transcript collections at scale
- **LiveKit:** Use dedicated LiveKit Cloud or self-hosted with SFU
- **CDN:** Serve frontend assets behind Cloudflare / CloudFront

### Scaling LiveKit
LiveKit handles WebRTC SFU routing automatically. For 100+ concurrent rooms:
1. Use [LiveKit Cloud](https://cloud.livekit.io/)
2. Or self-host with Kubernetes using the [LiveKit Helm chart](https://github.com/livekit/livekit-helm)

---

## 🔐 Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Calendar API** and **Google+ API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID** (Web Application)
5. Add authorized redirect URI: `http://localhost:8000/calendar/oauth2callback`
6. Copy Client ID and Secret to `backend/.env`

---

## 🧪 Testing the System

### Create a meeting end-to-end:

```bash
# 1. Register a host
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"secure123","role":"host"}'

# 2. Login
curl -X POST http://localhost:8000/auth/login \
  -d "username=alice&password=secure123"
# → Copy access_token

# 3. Create meeting
curl -X POST http://localhost:8000/meetings/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Q4 Planning","participants":["bob"]}'

# 4. Open frontend → Dashboard → Join meeting
# 5. Speak in the meeting → watch transcript appear live
# 6. End meeting → Go to Report → Generate AI Report
```

---

## 📦 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Zustand |
| UI Components | LiveKit React SDK, Framer Motion, Lucide |
| Backend | FastAPI (Python 3.11), Uvicorn |
| Database | MongoDB 7, Motor (async driver) |
| Real-time Media | LiveKit SDK (WebRTC SFU) |
| Transcription | Groq Whisper Large v3 |
| LLM Analysis | Groq Llama 3 70B / 8B |
| Calendar | Google Calendar API v3 (OAuth2) |
| Auth | JWT (python-jose) + bcrypt |
| Encryption | AES-256-GCM (field-level) |
| Containerization | Docker + Docker Compose |

---

## 📄 License

MIT License. Built as a production-ready SaaS foundation.

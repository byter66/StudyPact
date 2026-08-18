# StudyPact Backend

Node.js + Express + TypeScript backend for StudyPact.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The API starts on `http://localhost:5000` by default.

Health check:

`GET /api/health`

## Current architecture

```text
Request
  ↓
Route
  ↓
Controller
  ↓
Service
  ↓
Supabase
```

The current commit contains the backend foundation only. Feature modules should be added incrementally for authentication, study rooms, pacts/goals, doubts, and peer evaluation.

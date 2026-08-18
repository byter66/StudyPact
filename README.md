# StudyPact

### Accountability-Based Study Platform

StudyPact is a web-based collaborative study platform designed for students preparing for competitive examinations such as **UPSC, GATE, CAT, SSC, and similar exams**.

Instead of relying only on individual productivity tracking, StudyPact creates small study groups called **Pacts**, where members set daily study goals, track their progress, maintain streaks, study alongside peers, and participate in structured peer evaluation.

The goal is simple: **turn study intentions into consistent action through accountability.**

---

## Features

### 🔐 User Authentication

* User registration and login
* Indian `+91` phone number verification
* OTP-based verification
* Restriction of unverified users from protected platform features

### 📚 Exam-Specific Study Rooms

Users can browse and join rooms based on their examination.

Supported exam categories include:

* UPSC
* GATE
* CAT
* SSC
* Other competitive examinations

Users can also create new study rooms.

### 👥 Study Room

Each study room provides:

* Real-time member presence
* **Studying / On Break / Away** status
* Individual Pomodoro timer
* Group chat
* Image sharing
* Room member list

The room allows students to study alongside others while being aware of their peers' activity.

### 🎯 Accountability Pacts

A Pact allows members to commit to personal daily study goals.

Members can:

* Set daily goals
* Mark goals as completed
* View other members' progress
* Maintain study streaks
* Track missed goals

A member's streak is updated according to their daily goal completion.

### 💬 Doubt-Clearing Forum

Users can:

* Post academic doubts
* Attach images of handwritten solutions
* Reply to existing doubts
* Participate in threaded discussions

Images are stored using Supabase Storage.

### 📝 Mock Tests & Peer Evaluation

StudyPact provides structured peer evaluation for subjective exam preparation.

The workflow is:

1. User opens a mock paper.
2. User attempts the paper within the allotted time.
3. Submission closes when the time limit expires.
4. Submissions are assigned to peer reviewers.
5. Reviewers evaluate answers using a predefined rubric.
6. Reviewers provide scores and feedback.
7. Users and reviewers can discuss the evaluation through a thread.

Example rubric:

* Content
* Clarity
* Conclusion

### 📊 Dashboard

The dashboard provides an overview of:

* Available study rooms
* Active rooms
* Study streaks
* Daily goals
* Pact activity

---

## System Architecture

```text
                    ┌─────────────────────┐
                    │      React UI       │
                    │    TypeScript       │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        ┌────────────────┐          ┌──────────────────┐
        │ Node.js /      │          │ Supabase Client  │
        │ Express API    │          │                  │
        └───────┬────────┘          └────────┬─────────┘
                │                            │
                │                            ▼
                │                  ┌──────────────────┐
                │                  │ Supabase Services│
                │                  │                  │
                │                  │ • Auth           │
                │                  │ • PostgreSQL     │
                │                  │ • Realtime       │
                │                  │ • Storage        │
                │                  └──────────────────┘
                │
                ▼
       ┌─────────────────────┐
       │ Custom Backend Logic│
       │                     │
       │ • Streaks           │
       │ • Pact logic        │
       │ • Reviewer assign.  │
       │ • Evaluation timing │
       │ • Authorization     │
       └─────────────────────┘
```

Supabase handles authentication, database management, realtime communication and file storage, while the Express backend handles application-specific logic that should not be left entirely to the frontend.

---

## Tech Stack

| Layer            | Technology                     |
| ---------------- | ------------------------------ |
| Frontend         | React + TypeScript             |
| Backend          | Node.js + Express + TypeScript |
| Database         | PostgreSQL via Supabase        |
| Authentication   | Supabase Auth                  |
| OTP Verification | Twilio Verify / Appwrite       |
| Realtime         | Supabase Realtime              |
| File Storage     | Supabase Storage               |
| API Format       | REST                           |
| Architecture     | Layered / Object-Oriented      |

---

## Main Modules

```text
StudyPact
│
├── Authentication
│   ├── Registration
│   ├── Login
│   └── OTP Verification
│
├── Study Rooms
│   ├── Browse Rooms
│   ├── Create Room
│   ├── Join / Leave Room
│   ├── Presence
│   ├── Pomodoro
│   └── Chat
│
├── Accountability Pact
│   ├── Daily Goals
│   ├── Goal Completion
│   └── Streak Tracking
│
├── Doubt Forum
│   ├── Post Doubt
│   ├── Image Upload
│   └── Threaded Replies
│
└── Peer Evaluation
    ├── Mock Tests
    ├── Timed Submission
    ├── Reviewer Assignment
    ├── Rubric Evaluation
    └── Feedback Discussion
```

---

## Project Structure

A recommended project structure is:

```text
studypact/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── models/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   │
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── docs/
│   └── screenshots/
│
├── .gitignore
└── README.md
```

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd studypact
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install backend dependencies

```bash
cd ../backend
npm install
```

### 4. Configure environment variables

Create a `.env` file inside `backend/`.

```env
PORT=5000

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
```

Never commit `.env` to the repository.

### 5. Start the backend

```bash
npm run dev
```

### 6. Start the frontend

```bash
cd ../frontend
npm run dev
```

---

## API Overview

### Authentication

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify-otp
```

### Study Rooms

```text
GET    /api/rooms
POST   /api/rooms
GET    /api/rooms/:roomId
POST   /api/rooms/:roomId/join
DELETE /api/rooms/:roomId/leave
```

### Presence

```text
PATCH  /api/rooms/:roomId/presence
GET    /api/rooms/:roomId/members
```

### Accountability

```text
GET    /api/pacts/:pactId
POST   /api/pacts/:pactId/goals
PATCH  /api/goals/:goalId/complete
GET    /api/pacts/:pactId/streaks
```

### Doubts

```text
POST   /api/doubts
GET    /api/doubts
GET    /api/doubts/:doubtId
POST   /api/doubts/:doubtId/replies
```

### Mock Tests & Evaluation

```text
GET    /api/mock-tests
POST   /api/mock-tests/:testId/submit
GET    /api/submissions/:submissionId
POST   /api/submissions/:submissionId/review
POST   /api/submissions/:submissionId/comments
```

---

## Security

StudyPact uses:

* Supabase Auth for authentication
* OTP-based phone verification
* Authorization checks for protected resources
* Role-based access control
* Secure image storage
* Room/Pact membership checks
* Environment variables for sensitive credentials

Only authorized members should be able to access room- or Pact-specific information.

---

## Performance Targets

The initial project targets:

* Core operation response time below **10 seconds**
* Up to **50 concurrent users** for the Phase-1/demo version
* Presence updates within approximately **1 second**
* OTP verification response within **10 seconds**

These targets are specified in the project SRS.

---

## Project Objective

StudyPact aims to make competitive-exam preparation more consistent by combining:

**Individual Goals + Peer Presence + Accountability + Structured Evaluation**

Rather than functioning as only a productivity tracker or chat application, StudyPact provides a structured environment where students can study together and remain accountable to their commitments.

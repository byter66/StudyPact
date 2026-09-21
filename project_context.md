# StudyPact Project Context

StudyPact is an accountability-based collaborative study platform.

## Current Progress

Completed:
- Landing page
- Sign-in and sign-up screens
- Indian phone-number authentication flow
- Development OTP generation with six-digit random codes
- OTP expiry and single-use verification
- Protected routing and auth-aware app flow
- Frontend auth service and local session persistence
- Dashboard UI with room overview layout
- Study room UI shell
- Mock room UI shell
- Backend Express + TypeScript app setup
- Auth API routes for sending OTP, verifying OTP, registration, login, current user lookup, and sign-out
- Backend room listing, room lookup, and room creation APIs
- Backend Pomodoro session create, list, update, and complete APIs
- Supabase profiles migration with phone_number and phone_verified fields

Partially implemented / in progress:
- Supabase integration and database persistence
- Study room functionality (UI and basic room APIs exist; joining, presence, and realtime logic are pending)
- Pomodoro functionality (backend API exists; frontend timer integration is pending)
- Profile persistence for development-auth users

Not yet implemented:
- Complete Supabase database schema and generated models
- Real room joining and membership logic
- Presence tracking
- Frontend Pomodoro timer and session controls
- Chat
- Accountability goals
- Streak calculation
- Doubt forum
- Mock tests
- Peer evaluation
- Full realtime collaboration features

## Architecture

Frontend:
- React
- Vite
- React Router
- AuthProvider context with local session restoration
- API client and auth service layers
- Protected routes for dashboard, study room, and mock room
- Existing frontend styling and component conventions must be preserved.

Backend:
- Node.js
- Express
- TypeScript
- Route/controller/service organization
- Auth service with development OTP and Supabase production fallback
- Room and Pomodoro service layers
- Authentication middleware for protected APIs

Database and backend services:
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage
- `profiles` migration for full_name, email, phone_number, and phone_verified
- Room and Pomodoro services query Supabase tables
- Full application-specific schema, row-level security policies, and realtime behavior still need to be completed.

## Current API Surface

Authentication:
- `POST /api/auth/send-otp`
- `POST /api/auth/request-otp` (compatibility alias)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-otp`
- `GET /api/auth/me`
- `POST /api/auth/signout`

Rooms:
- `GET /api/rooms`
- `GET /api/rooms/:id`
- `POST /api/rooms`

Pomodoro:
- `POST /api/rooms/:roomId/pomodoro-sessions`
- `GET /api/rooms/:roomId/pomodoro-sessions`
- `PATCH /api/pomodoro-sessions/:sessionId`
- `POST /api/pomodoro-sessions/:sessionId/complete`

## Authentication Notes

- Indian numbers are normalized to `+91XXXXXXXXXX` and must begin with 6-9.
- In non-production environments, OTPs are generated randomly, displayed by the frontend for manual development entry, expire after five minutes, and are removed after successful verification.
- Production authentication uses the Supabase OTP path configured by the backend.
- Frontend session data is stored in local storage and revalidated through `/api/auth/me`.
- The current Supabase profile migration uses UUIDs referencing `auth.users`; development-only user IDs must be reconciled with that schema before relying on profile persistence in a deployed environment.

## Important Development Rule

Build one feature end-to-end before moving to the next feature.

Each feature should follow:

Frontend UI
→ Frontend service/API call
→ Backend route
→ Controller
→ Service/business logic
→ Supabase database

Do not modify unrelated existing landing page or dashboard files unless necessary.
# StudyPact Project Context

StudyPact is an accountability-based collaborative study platform.

## Current Progress

Completed:
- Landing page
- Sign-in and sign-up screens
- Indian phone-number authentication flow for sign-in
- Direct account creation flow for sign-up
- Development OTP generation with six-digit random codes
- OTP expiry and single-use verification
- Protected routing and auth-aware app flow
- Frontend auth service, registration API call, and local session persistence
- Automatic redirect from sign-up to sign-in after successful registration
- Dashboard UI with room overview layout
- Study room UI with create, join-by-code, room-code display, and leave flows
- Backend room creation, lookup by ID/code, joining, membership listing, and leaving APIs
- Persistent room membership with duplicate protection
- Supabase Realtime Presence participant tracking in study rooms
- Initial room participant list loaded from persistent membership and overlaid with realtime presence
- Mock room UI shell
- Backend Express + TypeScript app setup
- Auth API routes for sending OTP, verifying OTP, registration, login, current user lookup, and sign-out
- Backend Pomodoro session create, list, update, and complete APIs
- Supabase profiles migration with phone_number and phone_verified fields

Partially implemented / in progress:
- Study room lifecycle (core create/join/presence/leave behavior exists; live database schema migration is outstanding)
- Supabase integration and database persistence
- Pomodoro functionality (backend API exists; frontend timer integration is pending)
- Profile persistence for newly registered users

Not yet implemented:
- Complete Supabase database schema and generated models
- Frontend Pomodoro timer and session controls
- Chat
- Accountability goals
- Streak calculation
- Doubt forum
- Mock tests
- Peer evaluation
- Full realtime collaboration features

## Room Lifecycle

- The dashboard creates rooms through authenticated `POST /api/rooms`, then navigates to `/study-room/:roomId`. The backend response includes `id` and `roomCode`; the room page displays the code.
- Users can join by code with `GET /api/rooms/code/:code`, then join by ID with authenticated `POST /api/rooms/:id/join`. The backend handles an existing membership without creating a duplicate.
- Entering the room loads the room, ensures membership, loads persistent members with `GET /api/rooms/:id/members`, and overlays currently connected Supabase Presence users in the participant list.
- Presence uses the channel name `room-presence:<roomId>`, tracks the current user, processes sync/join/leave events, and removes the channel on component unmount.
- Explicit Leave calls authenticated `DELETE /api/rooms/:id/membership`, then navigates to the dashboard. Other participants refresh persistent membership when Presence changes.
- Persistent membership (`room_members`) and temporary connected Presence are separate. Refresh, tab close, or network loss can end Presence without deleting the persistent membership row.
- The frontend reports Presence connection errors for `CHANNEL_ERROR`, `TIMED_OUT`, and `CLOSED`. A closed channel requires the user to re-enter the room to reconnect.

### Room Database Migration Status

- The repository contains `supabase/migrations/20260922130000_add_room_codes_and_realtime.sql`.
- The configured live Supabase project was verified to be missing `public.rooms.room_code`, `public.generate_room_code()`, the room-code unique index, and Realtime publication entries for `public.rooms` and `public.room_members`.
- Apply the existing migration's room-code and Realtime statements to the configured project before relying on room creation/code lookup. Do not change the already-correct `room_members` schema.
- The repository migration also contains `room_members` joined-at/index/policy statements. The verified membership schema is already correct; review those statements before applying the full file because the policy statement has no existence guard and can fail if that policy already exists.
- Repository migration files describe the expected schema; they do not prove the live project is up to date.

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
- Registration service that creates the user and persists the profile before returning success
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
- Room and membership schema, RLS policies, room-code migration, and Realtime publication are defined in repository migrations; the configured live project is missing the room-code and publication changes documented above.
- Other application-specific schema and policies may still need completion.

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
- `GET /api/rooms/code/:code`
- `GET /api/rooms/:id`
- `POST /api/rooms` (authenticated)
- `POST /api/rooms/:id/join` (authenticated)
- `GET /api/rooms/:id/members` (authenticated room member)
- `DELETE /api/rooms/:id/membership` (authenticated)

Pomodoro:
- `POST /api/rooms/:roomId/pomodoro-sessions`
- `GET /api/rooms/:roomId/pomodoro-sessions`
- `PATCH /api/pomodoro-sessions/:sessionId`
- `POST /api/pomodoro-sessions/:sessionId/complete`

## Authentication Notes

- Indian numbers are normalized to `+91XXXXXXXXXX` and must begin with 6-9.
- Sign-up collects the user's full name and phone number, then calls `POST /api/auth/register`; it does not request or verify an OTP.
- Registration creates a confirmed Supabase Auth user through the backend and upserts the corresponding `profiles` record. Existing phone numbers are rejected with a sign-in prompt.
- After successful registration, the frontend redirects the user to `/signin`, where the normal OTP sign-in flow begins.
- In non-production environments, sign-in OTPs are generated randomly, displayed by the frontend for manual development entry, expire after five minutes, and are removed after successful verification.
- Production sign-in authentication uses the Supabase OTP path configured by the backend.
- Frontend session data is stored in local storage and revalidated through `/api/auth/me`.
- The Supabase profile migration uses UUIDs referencing `auth.users`; registration creates users through Supabase Auth so profile IDs remain compatible with this schema.

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
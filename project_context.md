# StudyPact Project Context

StudyPact is an accountability-based collaborative study platform.

## Current Progress

Completed:
- Landing page
- Sign-in and sign-up screens
- Protected routing and auth-aware app flow
- Dashboard UI with room overview layout
- Study room UI shell
- Mock room UI shell
- Initial backend Express + TypeScript app setup
- Auth API routes for OTP request, OTP verification, current user lookup, and sign-out
- Frontend auth service layer and local session persistence

Partially implemented / in progress:
- Supabase integration scaffolding
- Study room functionality (UI exists; real-time room logic still pending)
- Database abstraction and persistence layer (not yet fully connected to Supabase)

Not yet implemented:
- Full Supabase database schema and models
- Real room joining logic
- Presence tracking
- Pomodoro functionality
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
- Auth flow and protected route structure are already in place
- Existing frontend styling and component conventions must be preserved.

Backend:
- Node.js
- Express
- TypeScript
- Auth service and OTP flow are already scaffolded

Database and backend services:
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage
- Full application-specific business logic and persistence still need to be implemented on top of these services.

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
# StudyPact Project Context

StudyPact is an accountability-based collaborative study platform.

## Current Progress

Completed:
- Landing page
- Dashboard UI
- Initial backend Express + TypeScript skeleton

Not yet implemented:
- Authentication
- Supabase integration
- Database
- Study room functionality
- Room joining
- Presence tracking
- Pomodoro functionality
- Chat
- Accountability goals
- Streak calculation
- Doubt forum
- Mock tests
- Peer evaluation

## Architecture

Frontend:
- React
- Vite
- Existing frontend styling and component conventions must be preserved.

Backend:
- Node.js
- Express
- TypeScript

Database and backend services:
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage

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
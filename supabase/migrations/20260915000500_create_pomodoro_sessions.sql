create table public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_type text not null default 'focus'
    check (session_type = 'focus'),
  planned_duration_seconds integer not null
    check (planned_duration_seconds between 60 and 86400),
  focused_duration_seconds integer not null default 0
    check (focused_duration_seconds >= 0),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint completed_or_cancelled_sessions_have_completion_time
    check (
      status not in ('completed', 'cancelled')
      or completed_at is not null
    )
);

create index pomodoro_sessions_room_started_at_idx
  on public.pomodoro_sessions (room_id, started_at desc);

create index pomodoro_sessions_user_started_at_idx
  on public.pomodoro_sessions (user_id, started_at desc);

alter table public.pomodoro_sessions enable row level security;

create policy "Authenticated users can create their own Pomodoro sessions"
  on public.pomodoro_sessions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can read their own Pomodoro sessions"
  on public.pomodoro_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can update their own Pomodoro sessions"
  on public.pomodoro_sessions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

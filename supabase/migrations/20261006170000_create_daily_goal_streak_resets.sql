create table public.daily_goal_streak_resets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reset_date date not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.daily_goal_streak_resets enable row level security;

create policy "Users can read their own streak reset"
  on public.daily_goal_streak_resets
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own streak reset"
  on public.daily_goal_streak_resets
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own streak reset"
  on public.daily_goal_streak_resets
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own streak reset"
  on public.daily_goal_streak_resets
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

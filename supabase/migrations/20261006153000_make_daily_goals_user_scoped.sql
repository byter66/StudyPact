drop policy if exists "Members can create their own daily goals" on public.daily_goals;
drop policy if exists "Members can read their own daily goals" on public.daily_goals;
drop policy if exists "Members can update their own daily goals" on public.daily_goals;

drop index if exists public.daily_goals_room_user_date_idx;
drop index if exists public.daily_goals_user_room_date_idx;

alter table public.daily_goals
  drop constraint if exists daily_goals_room_id_user_id_goal_date_key;

alter table public.daily_goals
  drop column if exists room_id;

create index if not exists daily_goals_user_date_idx
  on public.daily_goals (user_id, goal_date);

create index if not exists daily_goals_date_idx
  on public.daily_goals (goal_date);

create policy "Users can create their own daily goals"
  on public.daily_goals
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can read their own daily goals"
  on public.daily_goals
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can update their own daily goals"
  on public.daily_goals
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

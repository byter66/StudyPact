create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id)
);

create index room_members_user_id_room_id_idx
  on public.room_members (user_id, room_id);

create or replace function public.is_room_member(
  target_room_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id
      and user_id = target_user_id
  );
$$;

revoke execute on function public.is_room_member(uuid, uuid) from public;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;

alter table public.room_members enable row level security;

create policy "Authenticated users can join rooms for themselves"
  on public.room_members
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can read membership for rooms they belong to"
  on public.room_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_room_member(room_id, (select auth.uid()))
  );

create table public.daily_goals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  goal_date date not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (room_id, user_id, goal_date)
);

create index daily_goals_room_user_date_idx
  on public.daily_goals (room_id, user_id, goal_date);

create index daily_goals_user_room_date_idx
  on public.daily_goals (user_id, room_id, goal_date);

alter table public.daily_goals enable row level security;

create policy "Members can create their own daily goals"
  on public.daily_goals
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_room_member(room_id, (select auth.uid()))
  );

create policy "Members can read their own daily goals"
  on public.daily_goals
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_room_member(room_id, (select auth.uid()))
  );

create policy "Members can update their own daily goals"
  on public.daily_goals
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.is_room_member(room_id, (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and public.is_room_member(room_id, (select auth.uid()))
  );

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  exam_category text not null check (char_length(trim(exam_category)) between 1 and 50),
  description text not null default '' check (char_length(description) <= 1000),
  creator_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index rooms_exam_category_created_at_idx
  on public.rooms (exam_category, created_at desc);

alter table public.rooms enable row level security;

create policy "Rooms are publicly readable"
  on public.rooms
  for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can create rooms for themselves"
  on public.rooms
  for insert
  to authenticated
  with check ((select auth.uid()) = creator_user_id);

create policy "Room creators can update their rooms"
  on public.rooms
  for update
  to authenticated
  using ((select auth.uid()) = creator_user_id)
  with check ((select auth.uid()) = creator_user_id);

create policy "Room creators can delete their rooms"
  on public.rooms
  for delete
  to authenticated
  using ((select auth.uid()) = creator_user_id);

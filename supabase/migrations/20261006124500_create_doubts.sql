create table public.doubts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index doubts_room_id_created_at_idx
  on public.doubts (room_id, created_at desc);

create index doubts_user_id_idx
  on public.doubts (user_id);

create trigger doubts_updated_at
before update on public.doubts
for each row
execute procedure public.handle_updated_at();

alter table public.doubts enable row level security;

create policy "Room members can read doubts"
  on public.doubts
  for select
  to authenticated
  using (public.is_room_member(room_id, (select auth.uid())));

create policy "Room members can create their own doubts"
  on public.doubts
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_room_member(room_id, (select auth.uid()))
  );

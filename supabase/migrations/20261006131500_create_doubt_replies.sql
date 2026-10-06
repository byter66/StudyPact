create table public.doubt_replies (
  id uuid primary key default gen_random_uuid(),
  doubt_id uuid not null references public.doubts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index doubt_replies_doubt_id_created_at_idx
  on public.doubt_replies (doubt_id, created_at asc);

create index doubt_replies_user_id_idx
  on public.doubt_replies (user_id);

create trigger doubt_replies_updated_at
before update on public.doubt_replies
for each row
execute procedure public.handle_updated_at();

alter table public.doubt_replies enable row level security;

create policy "Room members can read doubt replies"
  on public.doubt_replies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.doubts
      where doubts.id = doubt_replies.doubt_id
        and public.is_room_member(doubts.room_id, (select auth.uid()))
    )
  );

create policy "Room members can create replies"
  on public.doubt_replies
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.doubts
      where doubts.id = doubt_replies.doubt_id
        and public.is_room_member(doubts.room_id, (select auth.uid()))
    )
  );

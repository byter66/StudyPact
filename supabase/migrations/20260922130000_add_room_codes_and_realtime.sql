alter table public.rooms
  add column if not exists room_code text;

create or replace function public.generate_room_code()
returns text
language plpgsql
volatile
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.rooms where room_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

update public.rooms
set room_code = public.generate_room_code()
where room_code is null;

alter table public.rooms
  alter column room_code set default public.generate_room_code(),
  alter column room_code set not null;

create unique index if not exists rooms_room_code_lower_idx
  on public.rooms (lower(room_code));

alter table public.room_members
  add column if not exists joined_at timestamptz not null
    default timezone('utc', now());

create index if not exists room_members_room_id_joined_at_idx
  on public.room_members (room_id, joined_at desc);

create policy "Members can leave rooms"
  on public.room_members
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_members'
  ) then
    alter publication supabase_realtime add table public.room_members;
  end if;
end;
$$;

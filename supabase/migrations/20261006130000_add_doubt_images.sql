insert into storage.buckets (id, name, public)
values ('doubt-images', 'doubt-images', false)
on conflict (id) do update set public = false;

create table public.doubt_images (
  id uuid primary key default gen_random_uuid(),
  doubt_id uuid not null references public.doubts(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index doubt_images_doubt_id_created_at_idx
  on public.doubt_images (doubt_id, created_at asc);

alter table public.doubt_images enable row level security;

create policy "Room members can read doubt image metadata"
  on public.doubt_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.doubts
      where doubts.id = doubt_images.doubt_id
        and public.is_room_member(doubts.room_id, (select auth.uid()))
    )
  );

create policy "Doubt owners can create image metadata"
  on public.doubt_images
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.doubts
      where doubts.id = doubt_images.doubt_id
        and doubts.user_id = (select auth.uid())
        and public.is_room_member(doubts.room_id, (select auth.uid()))
    )
  );

create policy "Doubt owners can delete image metadata"
  on public.doubt_images
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.doubts
      where doubts.id = doubt_images.doubt_id
        and doubts.user_id = (select auth.uid())
    )
  );

create policy "Room members can read doubt image files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'doubt-images'
    and public.is_room_member(
      split_part(name, '/', 1)::uuid,
      (select auth.uid())
    )
  );

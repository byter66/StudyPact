create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doubt_id uuid not null references public.doubts(id) on delete cascade,
  reply_id uuid not null unique references public.doubt_replies(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.evaluator_scores alter column score drop not null;

alter table public.doubt_replies add column if not exists client_request_id uuid;
create unique index if not exists doubt_replies_idempotency_idx
  on public.doubt_replies (doubt_id, user_id, client_request_id)
  where client_request_id is not null;

alter table public.notifications enable row level security;

create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.notify_doubt_author_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_doubt public.doubts%rowtype;
begin
  select * into target_doubt
  from public.doubts
  where id = new.doubt_id;

  if found and target_doubt.user_id <> new.user_id then
    insert into public.notifications (user_id, doubt_id, reply_id, room_id, message)
    values (
      target_doubt.user_id,
      target_doubt.id,
      new.id,
      target_doubt.room_id,
      'Someone replied to your doubt: ' || left(target_doubt.content, 120)
    )
    on conflict (reply_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger doubt_reply_notification
after insert on public.doubt_replies
for each row execute function public.notify_doubt_author_on_reply();

-- Keep the reply idempotency fields available even when the earlier
-- notification migration was applied before doubt_replies existed.
alter table public.doubt_replies
  add column if not exists client_request_id uuid;

create unique index if not exists doubt_replies_idempotency_idx
  on public.doubt_replies (doubt_id, user_id, client_request_id)
  where client_request_id is not null;

notify pgrst, 'reload schema';

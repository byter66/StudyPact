create table if not exists public.evaluation_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluator_assignments(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists evaluation_discussion_messages_assignment_idx
  on public.evaluation_discussion_messages (assignment_id);

create index if not exists evaluation_discussion_messages_created_at_idx
  on public.evaluation_discussion_messages (created_at);

alter table public.evaluation_discussion_messages enable row level security;

create policy "Evaluation participants can read discussion messages"
  on public.evaluation_discussion_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.evaluator_assignments ea
      join public.mock_submissions ms on ms.id = ea.submission_id
      where ea.id = assignment_id
        and (ea.evaluator_id = auth.uid() or ms.participant_id = auth.uid())
    )
  );

create policy "Evaluation participants can create discussion messages"
  on public.evaluation_discussion_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.evaluator_assignments ea
      join public.mock_submissions ms on ms.id = ea.submission_id
      where ea.id = assignment_id
        and (ea.evaluator_id = auth.uid() or ms.participant_id = auth.uid())
    )
  );

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'evaluation_discussion_messages'
  ) then
    null;
  else
    alter publication supabase_realtime add table public.evaluation_discussion_messages;
  end if;
end
$$;

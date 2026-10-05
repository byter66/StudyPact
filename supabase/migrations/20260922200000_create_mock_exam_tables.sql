create extension if not exists pgcrypto;

create table if not exists public.mock_papers (
  id uuid primary key default gen_random_uuid(),
  exam_name text not null,
  exam_year integer,
  paper_name text not null,
  subject text not null default 'General',
  duration_seconds integer not null default 1800,
  total_marks integer not null default 0,
  evaluation_type text not null default 'objective' check (evaluation_type in ('objective', 'hybrid', 'subjective')),
  source text,
  source_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.mock_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.mock_papers(id) on delete cascade,
  question_number integer not null,
  question_type text not null check (question_type in ('MCQ_SINGLE', 'MCQ_MULTI', 'NUMERICAL', 'SUBJECTIVE')),
  question_text text not null,
  options jsonb,
  correct_answer text,
  max_marks integer not null default 0,
  negative_marks integer not null default 0,
  marking_scheme jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (paper_id, question_number)
);

create table if not exists public.mock_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  paper_id uuid not null references public.mock_papers(id) on delete restrict,
  started_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz not null default (timezone('utc', now()) + interval '30 minutes'),
  duration_seconds integer not null default 1800,
  status text not null default 'draft' check (status in ('draft', 'live', 'expired', 'completed')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.participant_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mock_sessions(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'submitted', 'under_evaluation', 'evaluated', 'finalized')),
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (session_id, participant_id)
);

create table if not exists public.mock_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.participant_attempts(id) on delete cascade,
  question_id uuid not null references public.mock_questions(id) on delete cascade,
  answer jsonb not null default 'null'::jsonb,
  answered_at timestamptz not null default timezone('utc', now()),
  unique (attempt_id, question_id)
);

create table if not exists public.mock_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.participant_attempts(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  file_path text,
  file_type text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'UNDER_EVALUATION', 'EVALUATED', 'FINALIZED')),
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.evaluator_assignments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.mock_submissions(id) on delete cascade,
  evaluator_id uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default timezone('utc', now()),
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'completed')),
  unique (submission_id, evaluator_id)
);

create table if not exists public.evaluator_scores (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.evaluator_assignments(id) on delete cascade,
  score numeric(5,2) not null default 0,
  rubric_scores jsonb not null default '[]'::jsonb,
  comments text,
  submitted_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.mock_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.participant_attempts(id) on delete cascade,
  final_score numeric(5,2) not null default 0,
  evaluation_status text not null default 'pending' check (evaluation_status in ('pending', 'objective_complete', 'finalized')),
  finalized_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (attempt_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  mock_session_id uuid references public.mock_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text,
  attachment_path text,
  attachment_type text default 'text',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists mock_questions_paper_question_idx
  on public.mock_questions (paper_id, question_number);

create index if not exists mock_sessions_room_status_idx
  on public.mock_sessions (room_id, status, ends_at desc);

create index if not exists participant_attempts_session_participant_idx
  on public.participant_attempts (session_id, participant_id, status);

create index if not exists mock_answers_attempt_idx
  on public.mock_answers (attempt_id, question_id);

create index if not exists mock_submissions_attempt_idx
  on public.mock_submissions (attempt_id, participant_id, status);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

alter table public.mock_papers enable row level security;
alter table public.mock_questions enable row level security;
alter table public.mock_sessions enable row level security;
alter table public.participant_attempts enable row level security;
alter table public.mock_answers enable row level security;
alter table public.mock_submissions enable row level security;
alter table public.evaluator_assignments enable row level security;
alter table public.evaluator_scores enable row level security;
alter table public.mock_results enable row level security;
alter table public.chat_messages enable row level security;

create policy "Authenticated users can view mock papers"
  on public.mock_papers
  for select
  to authenticated
  using (true);

create policy "Authenticated users can view mock questions for their room"
  on public.mock_questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.mock_sessions ms
      join public.room_members rm on rm.room_id = ms.room_id
      where ms.paper_id = public.mock_questions.paper_id
        and rm.user_id = auth.uid()
    )
  );

create policy "Room members can create mock sessions"
  on public.mock_sessions
  for insert
  to authenticated
  with check (public.is_room_member(room_id, auth.uid()));

create policy "Room members can read mock sessions"
  on public.mock_sessions
  for select
  to authenticated
  using (public.is_room_member(room_id, auth.uid()));

create policy "Participants can manage their own attempts"
  on public.participant_attempts
  for select
  to authenticated
  using (participant_id = auth.uid());

create policy "Participants can create their own attempts"
  on public.participant_attempts
  for insert
  to authenticated
  with check (participant_id = auth.uid());

create policy "Participants can update their own attempts"
  on public.participant_attempts
  for update
  to authenticated
  using (participant_id = auth.uid())
  with check (participant_id = auth.uid());

create policy "Participants can manage their own answers"
  on public.mock_answers
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.participant_attempts pa
      where pa.id = attempt_id
        and pa.participant_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.participant_attempts pa
      where pa.id = attempt_id
        and pa.participant_id = auth.uid()
    )
  );

create policy "Participants can create their own submissions"
  on public.mock_submissions
  for insert
  to authenticated
  with check (participant_id = auth.uid());

create policy "Participants can view their own submissions"
  on public.mock_submissions
  for select
  to authenticated
  using (participant_id = auth.uid());

create policy "Assigned evaluators can view their assignments"
  on public.evaluator_assignments
  for select
  to authenticated
  using (evaluator_id = auth.uid());

create policy "Assigned evaluators can create their own scores"
  on public.evaluator_scores
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.evaluator_assignments ea
      where ea.id = assignment_id
        and ea.evaluator_id = auth.uid()
    )
  );

create policy "Users can read their own results"
  on public.mock_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.participant_attempts pa
      where pa.id = attempt_id
        and pa.participant_id = auth.uid()
    )
  );

create policy "Room members can read their room chat history"
  on public.chat_messages
  for select
  to authenticated
  using (
    room_id is not null
    and public.is_room_member(room_id, auth.uid())
  );

create policy "Room members can insert chat messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and room_id is not null
    and public.is_room_member(room_id, auth.uid())
  );

create policy "Users can update only their own chat messages"
  on public.chat_messages
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy "Users can delete only their own chat messages"
  on public.chat_messages
  for delete
  to authenticated
  using (sender_id = auth.uid());

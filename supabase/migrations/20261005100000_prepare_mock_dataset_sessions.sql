alter table public.mock_sessions
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  alter column started_at drop not null,
  alter column ends_at drop not null,
  alter column duration_seconds drop not null,
  alter column duration_seconds drop default;

alter table public.mock_questions
  drop constraint if exists mock_questions_question_type_check;

alter table public.mock_questions
  add constraint mock_questions_question_type_check
  check (question_type in ('MCQ_SINGLE', 'MCQ_MULTI', 'NUMERICAL', 'SUBJECTIVE', 'MATCHING_LIST'));

create unique index if not exists mock_papers_source_reference_unique_idx
  on public.mock_papers (source_reference)
  where source_reference is not null;

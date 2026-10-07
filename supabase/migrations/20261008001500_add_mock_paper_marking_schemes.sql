alter table public.mock_papers
  add column if not exists marking_scheme jsonb;

do $$
declare
  jee_scheme jsonb := '{
    "version": 1,
    "exam": "JEE_ADVANCED",
    "rules": {
      "MCQ_SINGLE_CORRECT": {"strategy": "single_choice", "correct": 3, "incorrect": -1, "unanswered": 0, "maximum": 3},
      "MCQ_MULTIPLE_CORRECT": {"strategy": "partial_no_incorrect", "maximum": 4, "incorrect": -2, "unanswered": 0, "partial": {"1": 1, "2": 2, "3": 3}},
      "INTEGER": {"strategy": "exact_numeric", "correct": 4, "incorrect": 0, "unanswered": 0, "maximum": 4},
      "INTEGER_2": {"strategy": "exact_numeric", "correct": 4, "incorrect": 0, "unanswered": 0, "maximum": 4},
      "MCQ_MATCHING": {"strategy": "matching", "correct": 3, "incorrect": -1, "unanswered": 0, "maximum": 3}
    }
  }'::jsonb;
  neet_scheme jsonb := '{
    "version": 1,
    "exam": "NEET",
    "rules": {
      "MCQ_SINGLE_CORRECT": {"strategy": "single_choice", "correct": 4, "incorrect": -1, "unanswered": 0, "maximum": 4}
    }
  }'::jsonb;
begin
  update public.mock_papers
  set marking_scheme = jsonb_set(
    jsonb_set(jee_scheme, '{schemeId}', to_jsonb('jee_advanced_' || exam_year::text)),
    '{year}',
    to_jsonb(exam_year)
  )
  where exam_name = 'JEE_ADVANCED'
    and exam_year in (2024, 2025, 2026)
    and source_reference like 'huggingface:Hellboi78688/jee-neet-benchmark:%';

  update public.mock_papers
  set marking_scheme = jsonb_set(
    jsonb_set(neet_scheme, '{schemeId}', to_jsonb('neet_' || exam_year::text)),
    '{year}',
    to_jsonb(exam_year)
  )
  where exam_name = 'NEET'
    and exam_year in (2024, 2025, 2026)
    and source_reference like 'huggingface:Hellboi78688/jee-neet-benchmark:%';
end $$;

-- Custom papers have no rubric score; their evaluation is the written feedback.
alter table public.evaluator_scores
  alter column score drop not null;

notify pgrst, 'reload schema';

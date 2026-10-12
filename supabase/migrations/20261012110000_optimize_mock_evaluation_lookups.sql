create index if not exists evaluator_assignments_evaluator_submission_idx
  on public.evaluator_assignments (evaluator_id, submission_id);

create index if not exists evaluator_scores_assignment_submitted_idx
  on public.evaluator_scores (assignment_id, submitted_at desc);

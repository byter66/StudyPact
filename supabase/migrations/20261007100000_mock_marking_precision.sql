alter table public.mock_questions
  alter column max_marks type numeric(10, 3) using max_marks::numeric,
  alter column negative_marks type numeric(10, 3) using negative_marks::numeric;

alter table public.mock_papers
  alter column total_marks type numeric(10, 3) using total_marks::numeric;

create table public.user_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index user_tasks_user_created_at_idx
  on public.user_tasks (user_id, created_at);

alter table public.user_tasks enable row level security;

create policy "Users can read their own tasks"
  on public.user_tasks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own tasks"
  on public.user_tasks
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tasks"
  on public.user_tasks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tasks"
  on public.user_tasks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'doubts'
  ) then
    alter publication supabase_realtime add table public.doubts;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'doubt_replies'
  ) then
    alter publication supabase_realtime add table public.doubt_replies;
  end if;
end;
$$;

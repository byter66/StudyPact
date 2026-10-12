alter table public.doubt_replies
  add column if not exists image_path text;

notify pgrst, 'reload schema';

alter table public.deadlines
  add column if not exists due_time timestamptz;

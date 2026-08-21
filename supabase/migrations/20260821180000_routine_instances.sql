alter table public.routines
  add column if not exists end_date date;

alter table public.routines
  add column if not exists scheduled_time timestamptz;

alter table public.tasks
  add column if not exists routine_id uuid;

alter table public.deadlines
  add column if not exists project_id uuid;

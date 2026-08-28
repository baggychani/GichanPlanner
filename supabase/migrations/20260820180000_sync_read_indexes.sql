-- New-device hydration reads every row in stable id order. These composite
-- indexes keep that per-account scan fast as a planner grows beyond 1,000 rows.
create index if not exists tasks_owner_id_id_idx on public.tasks (owner_id, id);
create index if not exists schedules_owner_id_id_idx on public.schedules (owner_id, id);
create index if not exists routines_owner_id_id_idx on public.routines (owner_id, id);
create index if not exists domains_owner_id_id_idx on public.domains (owner_id, id);
create index if not exists goals_owner_id_id_idx on public.goals (owner_id, id);
create index if not exists deadlines_owner_id_id_idx on public.deadlines (owner_id, id);
create index if not exists projects_owner_id_id_idx on public.projects (owner_id, id);

create index if not exists tasks_owner_updated_at_id_idx on public.tasks (owner_id, updated_at, id);
create index if not exists schedules_owner_updated_at_id_idx on public.schedules (owner_id, updated_at, id);
create index if not exists routines_owner_updated_at_id_idx on public.routines (owner_id, updated_at, id);
create index if not exists domains_owner_updated_at_id_idx on public.domains (owner_id, updated_at, id);
create index if not exists goals_owner_updated_at_id_idx on public.goals (owner_id, updated_at, id);
create index if not exists deadlines_owner_updated_at_id_idx on public.deadlines (owner_id, updated_at, id);
create index if not exists projects_owner_updated_at_id_idx on public.projects (owner_id, updated_at, id);

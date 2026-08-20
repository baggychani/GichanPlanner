create table public.projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  title text not null,
  icon text not null default '📁',
  domain_id uuid,
  due_date date,
  "order" integer not null default 0
);

alter table public.tasks
  add column if not exists project_id uuid;

alter table public.projects enable row level security;
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on table public.projects to authenticated;

-- 기존 테이블은 그대로 두고, 앱이 필요로 하는 것만 추가합니다.
-- 라이브에서 쓰는 파일입니다. RESET.sql 은 실행하지 마세요.
-- SQL Editor에 이 파일 전체를 붙여 넣고 Run 한 번이면 됩니다.
-- 이미 있는 컬럼/정책이면 그냥 넘어갑니다.

alter table public.deadlines
  add column if not exists due_time timestamptz;

alter table public.deadlines
  add column if not exists project_id uuid;

alter table public.profiles
  add column if not exists birthday_month smallint,
  add column if not exists birthday_day smallint;

alter table public.tasks
  add column if not exists project_id uuid;

alter table public.tasks
  add column if not exists routine_id uuid;

alter table public.routines
  add column if not exists end_date date;

alter table public.routines
  add column if not exists scheduled_time timestamptz;

alter table public.routines
  add column if not exists is_important boolean not null default false;

create table if not exists public.projects (
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

alter table public.projects enable row level security;
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check ((select auth.uid()) = id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.tasks,
  public.schedules,
  public.routines,
  public.domains,
  public.goals,
  public.deadlines,
  public.projects,
  public.legacy_dexie_identities
to authenticated;

insert into storage.buckets (id, name, public)
values ('planner-backups', 'planner-backups', false)
on conflict (id) do nothing;

drop policy if exists "planner backup access" on storage.objects;
create policy "planner backup access" on storage.objects for all
  using (bucket_id = 'planner-backups' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'planner-backups' and (storage.foldername(name))[1] = (select auth.uid()::text));

create or replace function public.keep_newer_planner_row()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'profiles' then
    if new.updated_at <= old.updated_at then
      return null;
    end if;
    return new;
  end if;

  if new.updated_at < old.updated_at then
    return null;
  end if;
  if new.updated_at = old.updated_at and coalesce(new.revision, 1) <= coalesce(old.revision, 1) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_newer_on_profiles on public.profiles;
create trigger keep_newer_on_profiles
  before update on public.profiles
  for each row execute procedure public.keep_newer_planner_row();

drop trigger if exists keep_newer_on_tasks on public.tasks;
create trigger keep_newer_on_tasks
  before update on public.tasks
  for each row execute procedure public.keep_newer_planner_row();

drop trigger if exists keep_newer_on_schedules on public.schedules;
create trigger keep_newer_on_schedules
  before update on public.schedules
  for each row execute procedure public.keep_newer_planner_row();

drop trigger if exists keep_newer_on_routines on public.routines;
create trigger keep_newer_on_routines
  before update on public.routines
  for each row execute procedure public.keep_newer_planner_row();

drop trigger if exists keep_newer_on_domains on public.domains;
create trigger keep_newer_on_domains
  before update on public.domains
  for each row execute procedure public.keep_newer_planner_row();

drop trigger if exists keep_newer_on_goals on public.goals;
create trigger keep_newer_on_goals
  before update on public.goals
  for each row execute procedure public.keep_newer_planner_row();

drop trigger if exists keep_newer_on_deadlines on public.deadlines;
create trigger keep_newer_on_deadlines
  before update on public.deadlines
  for each row execute procedure public.keep_newer_planner_row();

drop trigger if exists keep_newer_on_projects on public.projects;
create trigger keep_newer_on_projects
  before update on public.projects
  for each row execute procedure public.keep_newer_planner_row();


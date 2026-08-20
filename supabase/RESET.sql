-- 클라우드 플래너 테이블만 지우고 처음부터 다시 만듭니다.
-- 로그인 계정(이메일·비밀번호)은 지우지 않습니다.
-- SQL Editor에 이 파일 전체를 붙여 넣고 한 번만 Run 하세요.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_profile_for_user();

drop table if exists public.legacy_dexie_identities cascade;
drop table if exists public.tasks cascade;
drop table if exists public.schedules cascade;
drop table if exists public.routines cascade;
drop table if exists public.domains cascade;
drop table if exists public.goals cascade;
drop table if exists public.deadlines cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  avatar_path text,
  birthday_month smallint,
  birthday_day smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_user();

-- 이미 가입된 계정은 트리거가 다시 안 돌므로 프로필 행을 채워 둡니다.
insert into public.profiles (id, nickname)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), '사용자')
from auth.users
on conflict (id) do nothing;

create table public.tasks (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  title text not null, target_date date not null, deadline timestamptz, scheduled_time timestamptz,
  domain_id uuid, goal_id uuid, project_id uuid, is_important boolean not null default false, is_completed boolean not null default false,
  memo text not null default '', "order" integer not null default 0, image_path text
);

create table public.schedules (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  title text not null, target_date date not null, start_time timestamptz not null, end_time timestamptz not null, domain_id uuid
);
create table public.routines (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  title text not null, domain_id uuid, recurrence_rule text not null, start_date date not null
);
create table public.domains (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  name text not null, icon text not null, color text not null, "order" integer not null default 0, is_archived boolean not null default false
);
create table public.goals (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  domain_id uuid, time_frame text not null check (time_frame in ('TODAY', 'WEEK', 'MONTH', 'CUSTOM')),
  start_date date not null, end_date date not null, title text not null, is_completed boolean not null default false
);
create table public.deadlines (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  title text not null, memo text not null default '', due_date date not null, due_time timestamptz, reminder_days integer, project_id uuid
);
create table public.projects (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  title text not null, icon text not null default '📁', domain_id uuid, due_date date, "order" integer not null default 0
);

create table public.legacy_dexie_identities (
  provider text not null check (provider = 'dexie_cloud'),
  legacy_user_id text not null,
  legacy_email text,
  user_id uuid not null references auth.users(id) on delete cascade,
  migrated_at timestamptz not null default now(),
  primary key (provider, legacy_user_id),
  unique (user_id, provider)
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.schedules enable row level security;
alter table public.routines enable row level security;
alter table public.domains enable row level security;
alter table public.goals enable row level security;
alter table public.deadlines enable row level security;
alter table public.projects enable row level security;
alter table public.legacy_dexie_identities enable row level security;

create policy "read own profile" on public.profiles for select using ((select auth.uid()) = id);
create policy "update own profile" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "insert own profile" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "read own tasks" on public.tasks for select using ((select auth.uid()) = owner_id);
create policy "create own tasks" on public.tasks for insert with check ((select auth.uid()) = owner_id);
create policy "update own tasks" on public.tasks for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "delete own tasks" on public.tasks for delete using ((select auth.uid()) = owner_id);
create policy "own schedules" on public.schedules for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own routines" on public.routines for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own domains" on public.domains for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own goals" on public.goals for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own deadlines" on public.deadlines for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own projects" on public.projects for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "create own legacy mapping" on public.legacy_dexie_identities for insert with check ((select auth.uid()) = user_id);
create policy "read own legacy mapping" on public.legacy_dexie_identities for select using ((select auth.uid()) = user_id);
create policy "update own legacy mapping" on public.legacy_dexie_identities for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
values ('profile-images', 'profile-images', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('task-images', 'task-images', false)
on conflict (id) do nothing;
drop policy if exists "profile image access" on storage.objects;
drop policy if exists "task image access" on storage.objects;
create policy "profile image access" on storage.objects for all using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid()::text)) with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "task image access" on storage.objects for all using (bucket_id = 'task-images' and (storage.foldername(name))[1] = (select auth.uid()::text)) with check (bucket_id = 'task-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- 기존 테이블은 그대로 두고, 앱이 필요로 하는 것만 추가합니다.
-- SQL Editor에 이 파일 전체를 붙여 넣고 Run 한 번이면 됩니다.
-- 이미 있는 컬럼/정책이면 그냥 넘어갑니다.

alter table public.deadlines
  add column if not exists due_time timestamptz;

alter table public.profiles
  add column if not exists birthday_month smallint,
  add column if not exists birthday_day smallint;

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
  public.legacy_dexie_identities
to authenticated;

create table if not exists public.anniversaries (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  title text not null,
  emoji text not null default '🎉',
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  start_year smallint
);

alter table public.anniversaries enable row level security;
drop policy if exists "own anniversaries" on public.anniversaries;
create policy "own anniversaries" on public.anniversaries for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on table public.anniversaries to authenticated;

drop trigger if exists keep_newer_on_anniversaries on public.anniversaries;
create trigger keep_newer_on_anniversaries
  before update on public.anniversaries
  for each row execute procedure public.keep_newer_planner_row();

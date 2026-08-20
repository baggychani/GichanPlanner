-- 더 옛 updated_at / revision 이 최근 행을 덮지 않게 합니다.
-- upsert 가 성공처럼 보여도, 실제 UPDATE 는 건너뜁니다.

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

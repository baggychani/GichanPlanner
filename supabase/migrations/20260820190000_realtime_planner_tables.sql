-- Keep open devices in sync. Each subscription is still protected by the
-- existing row-level-security policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['tasks', 'schedules', 'routines', 'domains', 'goals', 'deadlines', 'projects', 'profiles']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

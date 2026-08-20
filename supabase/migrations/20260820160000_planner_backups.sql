insert into storage.buckets (id, name, public)
values ('planner-backups', 'planner-backups', false)
on conflict (id) do nothing;

drop policy if exists "planner backup access" on storage.objects;
create policy "planner backup access" on storage.objects for all
  using (bucket_id = 'planner-backups' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'planner-backups' and (storage.foldername(name))[1] = (select auth.uid()::text));

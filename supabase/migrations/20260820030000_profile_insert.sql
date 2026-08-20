drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check ((select auth.uid()) = id);

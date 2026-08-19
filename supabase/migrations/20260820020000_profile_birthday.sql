alter table public.profiles
  add column if not exists birthday_month smallint,
  add column if not exists birthday_day smallint;

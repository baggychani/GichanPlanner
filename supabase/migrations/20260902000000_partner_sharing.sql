-- 파트너(예: 커플) 사이의 읽기 전용 캘린더 공유.
-- 초대 코드로 상호 연결을 맺으면, 서로의 tasks/schedules/... 을 읽기만 할 수 있다.
-- 기존 소유자 전체 권한 정책(own ...)은 전혀 건드리지 않고, SELECT 전용 정책만 추가한다.

create table public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete cascade,
  accepted_at timestamptz
);

create table public.partner_links (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a <> user_b)
);

alter table public.partner_invites enable row level security;
alter table public.partner_links enable row level security;

-- 코드로 직접 조회하는 정책은 두지 않는다. 다른 사람의 대기 중 초대가 노출되지
-- 않도록, 코드 검증/수락은 아래 accept_partner_invite() RPC로만 한다.
create policy "create own invite" on public.partner_invites for insert with check (inviter_id = (select auth.uid()));
create policy "read own invites" on public.partner_invites for select using (inviter_id = (select auth.uid()));
create policy "delete own invite" on public.partner_invites for delete using (inviter_id = (select auth.uid()));

-- 연결은 수락 시 양방향(A→B, B→A) 두 행으로 만들어져서, 내가 맺은 연결 목록은
-- user_a = 나 인 행만 보면 된다. 해제는 어느 쪽에서든 두 방향 모두 지울 수 있다.
create policy "read own partner links" on public.partner_links for select using (user_a = (select auth.uid()));
create policy "delete own partner links" on public.partner_links for delete using (user_a = (select auth.uid()) or user_b = (select auth.uid()));

grant select, insert, delete on table public.partner_invites to authenticated;
grant select, delete on table public.partner_links to authenticated;

create or replace function public.accept_partner_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
begin
  select * into invite from public.partner_invites
    where code = invite_code and accepted_by is null and expires_at > now()
    for update;
  if not found then
    raise exception 'invalid_or_expired_code';
  end if;
  if invite.inviter_id = auth.uid() then
    raise exception 'cannot_link_self';
  end if;

  update public.partner_invites set accepted_by = auth.uid(), accepted_at = now() where id = invite.id;
  insert into public.partner_links (user_a, user_b)
    values (invite.inviter_id, auth.uid()), (auth.uid(), invite.inviter_id)
    on conflict do nothing;
end;
$$;

revoke all on function public.accept_partner_invite(text) from public;
grant execute on function public.accept_partner_invite(text) to authenticated;

-- 기존 소유자 정책은 그대로 두고, 파트너에게는 SELECT 전용 정책만 추가한다.
-- 파트너는 이 정책으로는 절대 insert/update/delete 할 수 없다.
create policy "read partner tasks" on public.tasks for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = tasks.owner_id)
);
create policy "read partner schedules" on public.schedules for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = schedules.owner_id)
);
create policy "read partner routines" on public.routines for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = routines.owner_id)
);
create policy "read partner domains" on public.domains for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = domains.owner_id)
);
create policy "read partner goals" on public.goals for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = goals.owner_id)
);
create policy "read partner deadlines" on public.deadlines for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = deadlines.owner_id)
);
create policy "read partner projects" on public.projects for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = projects.owner_id)
);
create policy "read partner profile" on public.profiles for select using (
  exists (select 1 from public.partner_links where user_a = (select auth.uid()) and user_b = profiles.id)
);

-- 파트너의 프로필/할 일 사진도 볼 수 있도록 Storage에도 같은 패턴의 SELECT 전용 정책 추가.
create policy "read partner profile image" on storage.objects for select using (
  bucket_id = 'profile-images'
  and exists (
    select 1 from public.partner_links
    where user_a = (select auth.uid())
      and user_b = ((storage.foldername(name))[1])::uuid
  )
);
create policy "read partner task image" on storage.objects for select using (
  bucket_id = 'task-images'
  and exists (
    select 1 from public.partner_links
    where user_a = (select auth.uid())
      and user_b = ((storage.foldername(name))[1])::uuid
  )
);

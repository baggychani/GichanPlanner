# GichanPlanner

달력과 할 일, 주간 목표, 데드라인을 한 화면에서 다루는 개인 플래너입니다.

배포 주소: https://baggychani.github.io/GichanPlanner/

저장소: https://github.com/baggychani/GichanPlanner

## 계정

이메일·비밀번호로 로그인합니다. 할 일, 데드라인, 주간 목표, 카테고리, 프로젝트, 닉네임, 사진, 생일은 **그 계정에 저장**되고, 같은 계정으로 연 다른 기기에서도 같습니다. 세션은 이 브라우저에 유지되므로 다음에 열면 다시 로그인하지 않아도 됩니다.

로그아웃하면 달력은 보이고, 할 일·데드라인 내용은 숨깁니다.

## Supabase에서 해야 하는 것

SQL Editor에 `supabase/migrations/` 파일을 **이름 순서대로** 실행합니다. 이미 넣은 파일은 건너뛰고, 없는 것만 넣으면 됩니다.

1. `20260820000000_initial_schema.sql`
2. `20260820010000_deadline_due_time.sql`
3. `20260820020000_profile_birthday.sql`
4. `20260820030000_profile_insert.sql` ← 닉네임 저장에 필요
5. `20260820140000_projects.sql` ← 프로젝트 묶음. 이미 쓰는 프로젝트면 `supabase/ADD_MISSING.sql` 한 번으로도 됩니다.
6. `20260820150000_deadline_project.sql` ← 데드라인에 프로젝트 연결.

Authentication → URL Configuration:

- **Site URL:** `https://baggychani.github.io/GichanPlanner/`
- **Redirect URLs**에 아래를 모두 넣습니다.
  - `https://baggychani.github.io/GichanPlanner/`
  - `https://baggychani.github.io/GichanPlanner/**`
  - `http://localhost:5173/`
  - `http://localhost:8734/`

Authentication → Providers → Email이 켜져 있으면 됩니다. 이메일 인증을 강제 중이면 가입 후 메일 링크를 눌러야 로그인됩니다. 개인용으로 바로 쓰려면 Confirm email을 꺼도 됩니다.

Storage에 `profile-images`, `task-images` 버킷이 있어야 합니다. 초기 스키마 SQL을 실행했다면 이미 있습니다.

## 실행

```bash
npm install
```

프로젝트 루트에 `.env.local`을 만듭니다. 예시는 [`.env.example`](.env.example)입니다.

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev
```

## 다른 기기에서 카테고리가 미분류로 보이면

앱이 할 일을 불러오는 동안 카테고리를 비어 있다고 오해하고 분류를 지운 적이 있습니다. 그 수정은 코드에 들어 있습니다.

**원래 쓰던 기기**(분류가 아직 남아 있는 브라우저)에서 이 배포를 한 번 열어 로그인하면, 그 기기의 분류가 클라우드에 다시 올라갑니다. 원래 기기까지 이미 미분류로 덮였다면 클라우드에서도 복구할 수 없고, 할 일을 다시 분류해야 합니다.

Supabase SQL Editor에서 현재 상태를 보려면:

```sql
select t.title, t.domain_id, d.name as category
from public.tasks t
left join public.domains d on d.id = t.domain_id
where t.deleted_at is null
order by t.target_date, t.title;
```

`domain_id`가 비어 있으면 클라우드에도 분류가 없는 상태입니다. 이 버그를 고치기 위해 새 SQL을 넣을 필요는 없습니다.

```bash
npm run build
```

`main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포합니다. `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`는 저장소 Secrets로 넣습니다.

## 스택

Vite, React, TypeScript, Tailwind, Supabase (Auth, Postgres, Storage)

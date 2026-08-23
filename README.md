# GichanPlanner

달력과 할 일, 주간 목표, 데드라인을 한 화면에서 다루는 개인 플래너입니다.

배포 주소: https://baggychani.github.io/GichanPlanner/

저장소: https://github.com/baggychani/GichanPlanner

## 계정

이메일·비밀번호로 로그인합니다. 할 일, 데드라인, 주간 목표, 카테고리, 프로젝트, 닉네임, 사진, 생일은 **그 계정에 저장**되고, 같은 계정으로 연 다른 기기에서도 같습니다. 세션은 이 브라우저에 유지되므로 다음에 열면 다시 로그인하지 않아도 됩니다.

로그아웃하면 달력은 보이고, 할 일·데드라인 내용은 숨깁니다.

설정 → 데이터에서 JSON으로 받을 수 있고, 파일을 다시 넣을 수 있습니다. 넣을 때는 같은 항목은 더 최근 것만 남기고, 파일에 없는 할 일은 지우지 않습니다. 로그인한 뒤에는 하루에 한 번 계정에도 사본을 남기며, 최근 7개만 보관합니다.

## 데이터·SQL 규칙

- **라이브에서는 칸을 추가만 합니다.** 이미 있는 열을 지우거나 이름을 바꾸지 않습니다. 기능을 그만 보여 줘도 저장 칸은 남깁니다.
- **배포는 SQL 먼저, 사이트 나중**입니다. 사이트가 새 칸을 보내기 전에 Supabase에 그 칸이 있어야 합니다.
- 라이브에는 `supabase/migrations/`를 **이름 순서대로**, 이미 넣은 파일은 건너뛰고 없는 것만 넣습니다. 빠진 것만 한 번에 맞추려면 `supabase/ADD_MISSING.sql`입니다.
- `supabase/RESET.sql`은 실행하지 마세요. 예전에는 데이터를 전부 지웠고, 지금은 안내만 합니다. 개발용으로 표를 처음부터 다시 만들 때만 `supabase/DEV_RESET_WIPES_ALL.sql`을 씁니다.

## Supabase에서 해야 하는 것

`main`에 푸시하면 GitHub Actions가 **먼저** `supabase/migrations/`에 있는 SQL을 Supabase에 넣고, 그다음 GitHub Pages를 배포합니다. SQL Editor에 직접 붙여 넣을 필요는 없습니다.

저장소 Secrets에 아래를 넣어 두면 됩니다.

| Secret | 어디서 |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | [Supabase 대시보드 → Account → Access Tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | 프로젝트 Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | 프로젝트 Settings → Database → Database password |
| `VITE_SUPABASE_URL` | 프로젝트 Settings → API → Project URL (Pages 빌드용, 이미 있을 수 있음) |
| `VITE_SUPABASE_ANON_KEY` | 프로젝트 Settings → API → anon key (Pages 빌드용, 이미 있을 수 있음) |

Actions 탭에서 **Supabase Migrations** 워크플로를 수동으로 돌려 SQL만 따로 넣을 수도 있습니다.

Secrets가 없거나 마이그레이션이 실패하면 Pages 배포도 멈춥니다. SQL을 손으로 넣어야 한다면 아래 순서대로 SQL Editor에서 실행합니다.

1. `20260820000000_initial_schema.sql`
2. `20260820010000_deadline_due_time.sql`
3. `20260820020000_profile_birthday.sql`
4. `20260820030000_profile_insert.sql` ← 닉네임 저장에 필요
5. `20260820140000_projects.sql` ← 프로젝트 묶음
6. `20260820150000_deadline_project.sql` ← 데드라인에 프로젝트 연결
7. `20260820160000_planner_backups.sql` ← 계정 사본 저장. 없으면 설정에 사본 목록이 안 보입니다.
8. `20260820170000_keep_newer_rows.sql` ← 더 옛 저장이 최근 완료·수정을 덮지 않게 합니다.
9. `20260821180000_routine_instances.sql` ← 루틴 종료일·시간, 할 일에 루틴 연결. **사이트가 루틴을 만들기 전에 넣어야 합니다.**
10. `20260821190000_routine_important.sql` ← 루틴 중요 표시. 사이트가 중요 루틴을 저장하기 전에 넣어야 합니다.
11. `20260821195000_anniversaries.sql` ← 기념일. 사이트가 기념일을 만들기 전에 넣어야 합니다.

Authentication → URL Configuration:

- **Site URL:** `https://baggychani.github.io/GichanPlanner/`
- **Redirect URLs**에 아래를 모두 넣습니다.
  - `https://baggychani.github.io/GichanPlanner/`
  - `https://baggychani.github.io/GichanPlanner/**`
  - `http://localhost:5173/`
  - `http://localhost:8734/`

Authentication → Providers → Email이 켜져 있으면 됩니다. 이메일 인증을 강제 중이면 가입 후 메일 링크를 눌러야 로그인됩니다. 개인용으로 바로 쓰려면 Confirm email을 꺼도 됩니다.

Storage에 `profile-images`, `task-images`, `planner-backups` 버킷이 있어야 합니다. 초기 스키마와 이후 마이그레이션을 순서대로 실행했거나 `ADD_MISSING.sql`을 넣었다면 있습니다.

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

`main`에 푸시하면 GitHub Actions가 Supabase 마이그레이션을 적용한 뒤 GitHub Pages로 배포합니다. Secrets는 위 표를 참고하세요.

## 스택

Vite, React, TypeScript, Tailwind, Supabase (Auth, Postgres, Storage)

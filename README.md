# GichanPlanner

달력과 할 일, 주간 목표, 데드라인을 한 화면에서 다루는 개인 플래너입니다.

배포 주소: https://baggychani.github.io/GichanPlanner/

저장소: https://github.com/baggychani/GichanPlanner

## 계정

이메일·비밀번호로 로그인합니다. 할 일, 데드라인, 주간 목표, 카테고리, 닉네임, 사진, 생일은 **그 계정에 저장**되고, 같은 계정으로 연 다른 기기에서도 같습니다. 세션은 이 브라우저에 유지되므로 다음에 열면 다시 로그인하지 않아도 됩니다.

로그아웃하면 달력은 보이고, 할 일·데드라인 내용은 숨깁니다.

## Supabase에서 해야 하는 것

SQL Editor에 `supabase/migrations/` 파일을 **이름 순서대로** 실행합니다. 이미 넣은 파일은 건너뛰고, 없는 것만 넣으면 됩니다.

1. `20260820000000_initial_schema.sql`
2. `20260820010000_deadline_due_time.sql`
3. `20260820020000_profile_birthday.sql`
4. `20260820030000_profile_insert.sql` ← 닉네임 저장에 필요

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

처음 쓰는 Supabase 프로젝트라면 위의 SQL과 URL 설정을 먼저 맞춥니다.

```bash
npm run build
```

`main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포합니다. `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`는 저장소 Secrets로 넣습니다.

## 스택

Vite, React, TypeScript, Tailwind, Supabase (Auth, Postgres, Storage)

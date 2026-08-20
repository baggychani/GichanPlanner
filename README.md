# GichanPlanner

달력과 할 일, 주간 목표, 데드라인을 한 화면에서 다루는 개인 플래너입니다.

배포 주소: https://baggychani.github.io/GichanPlanner/

저장소: https://github.com/baggychani/GichanPlanner

## 계정

이메일·비밀번호로 로그인합니다. 할 일, 데드라인, 주간 목표, 카테고리, 닉네임, 사진, 생일은 **그 계정에 저장**되고, 같은 계정으로 연 다른 기기에서도 같습니다. 세션은 이 브라우저에 유지되므로 다음에 열면 다시 로그인하지 않아도 됩니다.

로그아웃하면 달력은 보이고, 할 일·데드라인 내용은 숨깁니다.

GitHub Pages에서 비밀번호 찾기·가입 인증 메일을 쓰려면 Supabase Authentication의 Redirect URLs에 `https://baggychani.github.io/GichanPlanner/`를 넣습니다. Site URL도 같은 주소로 둡니다.

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

처음 쓰는 Supabase 프로젝트라면 `supabase/migrations/` SQL을 대시보드에서 실행합니다.

```bash
npm run build
```

`main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포합니다. `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`는 저장소 Secrets로 넣습니다.

## 스택

Vite, React, TypeScript, Tailwind, Supabase (Auth, Postgres, Storage)

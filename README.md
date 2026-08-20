# GichanPlanner

달력과 할 일, 주간 목표, 데드라인을 한 화면에서 다루는 개인 플래너입니다.

배포 주소: https://baggychani.github.io/GichanPlanner/

저장소: https://github.com/baggychani/GichanPlanner

## 로그인하면 기기가 같은 데이터를 봅니다

- **로그인:** Supabase 이메일·비밀번호입니다. Google 로그인이나 Dexie Cloud 로그인은 앱 화면에 없습니다.
- **원본 저장소:** 로그인한 뒤 할 일·데드라인·주간 목표·카테고리·닉네임·사진·생일은 Supabase에 올라갑니다. 다른 기기에서 같은 계정으로 열면 그 내용이 내려옵니다.
- **이 브라우저의 IndexedDB(Dexie)**는 화면을 빨리 그리기 위한 캐시입니다. 로그인하지 않으면 이 기기에만 남습니다.
- **Dexie Cloud URL**은 예전 코드에 남아 있을 수 있습니다. 지금 기기 연동은 Supabase입니다.

로그아웃하면 달력은 보이고, 할 일·데드라인 내용은 숨깁니다.

GitHub Pages에서 비밀번호 찾기 메일을 쓰려면 Supabase Authentication의 Redirect URLs에 `https://baggychani.github.io/GichanPlanner/`를 넣습니다.

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

`main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포합니다. 로그인용 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`는 저장소 Secrets로 넣습니다.

## 스택

Vite, React, TypeScript, Tailwind, Dexie(IndexedDB 캐시), Supabase Auth·Postgres·Storage

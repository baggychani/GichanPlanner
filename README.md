# GichanPlanner

달력과 할 일, 주간 목표, 데드라인을 한 화면에서 다루는 개인 플래너입니다.

배포 주소: https://baggychani.github.io/GichanPlanner/

저장소: https://github.com/baggychani/GichanPlanner

## 로그인과 데이터는 역할이 다릅니다

- **로그인:** Supabase 이메일·비밀번호입니다. Google 로그인이나 Dexie Cloud 로그인은 앱 화면에 없습니다.
- **플래너 데이터:** 브라우저 IndexedDB에 둡니다. 그 로컬 DB를 다루는 라이브러리가 Dexie입니다. 할 일·카테고리·프로필 닉네임·사진이 여기에 있습니다.
- **Dexie Cloud URL**은 예전 동기화용으로 `db.ts`에 남아 있을 수 있습니다. 현재 로그인 흐름과는 무관합니다.

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

Vite, React, TypeScript, Tailwind, Dexie(IndexedDB), Supabase Auth

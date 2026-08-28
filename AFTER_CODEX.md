# Codex 종료 후 운영 인수인계

이 문서는 학교 계정의 Codex 사용이 끝난 뒤에도 GichanPlanner를 안전하게 운영·개발하기 위한 실제 체크리스트다. 비밀번호, 토큰, 키의 **값은 절대 이 파일이나 Git에 적지 않는다.** 이름만 적는다.

다음 AI 개발 도구(Cursor 등)에 넘길 기술 문서는 [CURSOR_HANDOFF.md](CURSOR_HANDOFF.md)와 [AGENTS.md](AGENTS.md)다. Cursor는 프로젝트 루트의 `AGENTS.md`와 `.cursor/rules/*.mdc`를 읽도록 구성했다.

## 지금 상태 요약

- 작업 브랜치: `production-foundation`
- 검토·병합할 Draft PR: [#4 동기화 확장성 및 배포 자동화 기반](https://github.com/baggychani/GichanPlanner/pull/4)
- 대상 브랜치: `main`
- 배포 주소: <https://baggychani.github.io/GichanPlanner/>
- 배포 순서: **Supabase 마이그레이션 → 웹 빌드 → GitHub Pages 배포**
- 이번 PR에는 데이터 동기화 안전장치, 1,000건 이상 로딩/증분 동기화 인덱스, 여러 기기의 실시간 반영, 설치 가능한 PWA 오프라인 셸이 들어 있다.

PR은 일부러 Draft 상태다. 아래의 배포 전 설정을 확인한 뒤 직접 Ready for review/merge 하면 된다.

## 가장 먼저 할 일 (10분 체크리스트)

1. 개인 GitHub 계정이 저장소 `baggychani/GichanPlanner`의 Admin 권한을 가진지 확인한다. 학교 이메일을 쓰고 있다면 GitHub 계정의 개인 이메일을 추가·검증한다.
2. Supabase 프로젝트의 Owner가 개인 계정인지 확인한다. 학교 계정 소유라면 개인 계정을 Owner/관리자로 옮긴다. **프로젝트를 새로 만들기 전에** 현재 DB와 Storage 데이터를 보존할 방법부터 확인한다.
3. 비밀값을 비밀번호 관리자에 보관한다. 최소한 `.env.local`의 Supabase URL/anon key, DB 비밀번호, Supabase Access Token을 잃지 않게 한다. `.env.local`은 Git에 올리지 않는다.
4. GitHub Actions Secrets를 아래 목록대로 확인한다. 이번 작업에서 이미 설정된 것은 그대로 두고, 없는 두 개만 넣는다.
5. merge 전에 `npm run dev` + <http://localhost:5173/>으로 브랜치를 직접 확인한다. 절차는 아래 “배포하지 않고 localhost에서 검증하는 방법”에 있다.
6. `adopt_existing_schema`를 결정하기 위해 읽기 전용 SQL로 현재 DB 상태를 확인한다.
7. PR #4를 읽고 merge한다. merge 직후 첫 자동 배포의 DB 처리 방법은 아래 절을 따른다.

## GitHub Actions Secrets: 꼭 필요한 값

GitHub 저장소 → **Settings → Secrets and variables → Actions → Repository secrets**에서 관리한다.

| Secret 이름 | 용도 | 현재 판단 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 브라우저 앱이 접속할 Supabase URL | 설정됨 |
| `VITE_SUPABASE_ANON_KEY` | 브라우저 앱의 공개 anon key | 설정됨 |
| `VITE_DEXIE_CLOUD_URL` | 기존 Dexie Cloud 관련 설정 | 설정됨. 앱에서 더 이상 쓰지 않으면 나중에 정리 검토 |
| `SUPABASE_PROJECT_REF` | 자동 배포가 연결할 Supabase 프로젝트 ID | 설정됨 |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions에서 Supabase CLI를 인증 | **직접 추가 필요** |
| `SUPABASE_DB_PASSWORD` | `supabase db push`가 DB에 연결 | **직접 추가 필요** |

### 두 값을 어디서 얻는가

`SUPABASE_ACCESS_TOKEN`은 프로젝트가 아니라 **계정** 설정에 있다. <https://supabase.com/dashboard/account/tokens> → Generate new token. 생성 직후 한 번만 표시되므로 즉시 비밀번호 관리자에 넣는다.

`SUPABASE_DB_PASSWORD`는 프로젝트를 만들 때 정한 **Postgres 비밀번호**다. anon key도 service role key도 아니다. Dashboard → Database → Settings의 `Database password` 항목(<https://supabase.com/dashboard/project/_/database/settings>)에 있다. 예전 경로 Project Settings → Database도 리다이렉트된다. 잊었으면 조회할 수 없고 `Reset password`로 새로 만드는 것뿐이다.

DB 비밀번호를 재설정해도 **배포된 웹앱은 멈추지 않는다.** 웹앱은 `VITE_SUPABASE_ANON_KEY`로 HTTPS 통신하고 이 비밀번호를 쓰지 않는다. PostgREST/Realtime 등 Supabase 관리 서비스는 재설정 시 자동 갱신된다. 이 값을 쓰는 곳은 GitHub Actions 하나뿐이므로, 재설정했으면 위 secret만 새 값으로 갱신한다.

두 값은 채팅·커밋·이슈·로그에 절대 붙여넣지 않는다. AI 에이전트에게도 값을 주지 않는다. 에이전트는 이름만 알면 된다.

### 주의: Access Token 형식과 고정된 CLI 버전

대시보드가 발급하는 새 형식 `sbp_v0_...`를 Supabase CLI가 거부하는 문제가 열려 있다([supabase/cli#6348](https://github.com/supabase/cli/issues/6348), 수정 PR [#6360](https://github.com/supabase/cli/pull/6360)). 2026-08-29 기준 이슈와 PR 모두 open이고 정식 릴리스에 포함되지 않았다. `pages.yml`은 CLI `2.101.0`을 고정하고 있으므로 새 형식 토큰을 넣으면 migrate job이 `LegacyInvalidAccessTokenError`로 실패한다.

토큰을 만든 뒤 접두사만 확인한다. 값 전체를 볼 필요는 없다.

- `sbp_` 뒤에 바로 문자·숫자가 오는 예전 형식이면 그대로 쓴다.
- `sbp_v0_`로 시작하면 CLI 고정 버전을 올려야 한다. 이것은 운영 DB 동작에 영향을 주는 변경이므로 임의로 `latest`로 바꾸지 않고, 수정이 정식 릴리스에 들어간 뒤 리뷰된 PR에서 버전을 올린다. 그때까지 migrate 실패는 예상된 결과다.

이 두 Secrets가 없는 상태에서 PR을 merge하면 새 GitHub Action은 마이그레이션 단계에서 실패하고, 의도대로 Pages 배포도 멈춘다. 앱 데이터가 망가지지는 않지만 새 사이트는 배포되지 않는다.

## 배포하지 않고 localhost에서 검증하는 방법

**배포는 확인의 전제가 아니다.** PR을 merge하지 않아도 브랜치 코드를 실제 Supabase에 붙여서 그대로 써 볼 수 있다. Supabase Auth의 Redirect URLs에 `http://localhost:5173/`이 들어 있는 이유가 이것이다.

```powershell
git switch production-foundation
npm install
npm run dev
```

그 다음 브라우저에서 <http://localhost:5173/>을 연다.

**주의: 이것은 운영 데이터베이스에 그대로 쓴다.** staging Supabase 프로젝트는 아직 없다. 그래서 동기화를 시험할 때는 실제 개인 계정이 아니라 시험용 계정 두 개(A, B)를 쓴다. 시작 전에 설정 → 데이터 → JSON 내보내기로 백업을 한 번 받는다.

### 계정 전환 가드(`069d1fc`) 검증 절차

1. **정상 동기화가 살아 있는지 먼저 본다.** A로 로그인해 할 일을 하나 만들고 제목을 고친다. Supabase Table Editor의 `tasks`에서 그 행이 A의 `owner_id`로 보이면 통과다. 이 검사가 가장 중요하다. 가드가 잘못 만들어졌다면 유출이 아니라 **저장 누락**으로 나타나기 때문이다.
2. **계정 전환.** 로그아웃하고 B로 로그인한다. A의 할 일이 화면에 보이지 않아야 한다.
3. **멀티탭.** 탭1에 A로 로그인해 두고, 탭2에서 로그아웃 후 B로 로그인한다. 그 뒤 탭1로 돌아가 화면에 남아 있는 A의 할 일 제목을 고친다.
4. Supabase SQL Editor에서 아래를 실행한다. **행이 하나도 안 나와야 정상이다.**

```sql
select owner_id, title, updated_at
from public.tasks
where title = '<3번에서 고친 제목>';
```

가드 이전 코드에서는 4번이 B의 `owner_id`로 A의 할 일을 보여준다. 그것이 이 버그의 정체였다.

## merge 전에 DB 상태를 확인하는 읽기 전용 SQL

다음 절의 `adopt_existing_schema`를 켜기 전에, 현재 DB가 정말 예전 마이그레이션을 갖고 있는지 확인한다. 아래는 읽기만 하므로 안전하다.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'deadlines' and column_name = 'project_id';

select version from supabase_migrations.schema_migrations order by version;
```

판단 기준은 이렇다.

- 첫 쿼리에 `tasks`, `domains`, `goals`, `projects`, `deadlines`, `profiles`, `planner_backups`가 모두 보이고, 두 번째 쿼리가 `project_id` 한 줄을 돌려주면 예전 마이그레이션(`20260820000000`~`20260820170000`)이 실제로 적용된 상태다. 이때만 `adopt_existing_schema`를 켠다.
- 세 번째 쿼리가 비어 있는 것은 정상이다. SQL Editor로 수동 적용했으면 history에 기록이 없다. adopt가 채우려는 것이 바로 이 표다.
- 표나 열이 빠져 있으면 **adopt를 켜지 말고 멈춘다.** 켜면 "적용됨"이라는 기록만 남고 빠진 표는 생기지 않는다.

## 지금 merge하면 어떻게 되는가

`.github/workflows/pages.yml`의 build job은 `needs: migrate`다. `SUPABASE_ACCESS_TOKEN`과 `SUPABASE_DB_PASSWORD`가 없는 동안 merge하면 migrate가 실패하고 build/deploy는 시작조차 하지 않는다. 결과는 실패한 Actions 실행 하나와, **옛 버전 그대로인 사이트**다. 앱 데이터는 상하지 않는다.

또한 secret을 넣은 뒤에도 **첫 배포를 평범한 `main` push로 하면 안 된다.** push로 들어온 실행은 adopt 단계를 건너뛰고 `supabase db push`가 마이그레이션 10개를 처음부터 적용하려 들어, 이미 있는 표를 다시 만들다 실패한다. 첫 배포는 반드시 다음 절의 수동 실행으로 한다.

## PR #4를 처음 배포하는 정확한 절차

### 이미 SQL Editor로 예전 스키마를 적용한 현재 Supabase 프로젝트

아래 조건이 맞을 때만 이 절차를 쓴다.

- 현재 DB에 `20260820000000`부터 `20260820170000`까지의 SQL 변경이 실제로 이미 들어가 있다.
- 그 변경을 SQL Editor에서 수동 적용했기 때문에 Supabase migration history에는 아직 기록되지 않았을 수 있다.

절차:

1. 위 두 GitHub Secrets를 넣는다.
2. PR #4를 `main`에 merge한다.
3. GitHub → **Actions → Deploy GitHub Pages → Run workflow**를 연다.
4. 브랜치는 `main`, `adopt_existing_schema`는 **켜기(true)** 로 한 번만 실행한다.
5. 로그에서 `Adopt already-applied migrations once`, `Apply pending Supabase migrations`, `Build`, `Deploy`가 모두 성공했는지 확인한다.

이 일회성 실행은 과거 SQL을 다시 실행하지 않는다. 과거 마이그레이션이 **이미 적용됐다는 사실만 기록**하고, 새 파일 `20260820180000`(동기화 인덱스)와 `20260820190000`(Realtime publication)는 필요한 경우 적용한다.

### 새 Supabase 프로젝트

`adopt_existing_schema`를 **끄고(false)** 실행한다. 첫 `db push`가 모든 마이그레이션을 이름 순서대로 적용한다.

### 이 선택을 하면 안 되는 경우

현재 DB가 예전 SQL 일부를 실제로 갖고 있지 않다면 `adopt_existing_schema=true`를 켜면 안 된다. history만 기록하고 필요한 테이블/열은 생기지 않기 때문이다. 이 경우에는 배포를 멈추고 실제 DB 상태를 확인한 뒤, 빠진 SQL을 정확한 순서로 먼저 적용한다.

## 이후 DB 변경 규칙

1. `supabase/migrations/`에 새 SQL 파일을 추가한다. 이름은 현재 시간 기준 정렬 가능한 형식(예: `YYYYMMDDHHMMSS_feature_name.sql`)을 쓴다.
2. 이미 `main`으로 배포한 migration 파일의 내용을 고치지 않는다. 실수 정정은 **새 migration 파일**로 한다.
3. 라이브 DB에는 열/테이블을 무턱대고 삭제·이름 변경하지 않는다. 먼저 앱에서 더 이상 참조하지 않게 만들고, 충분한 백업·마이그레이션 계획을 만든다.
4. PR에서 `npm run build`, `npm run lint`, `git diff --check`를 통과시킨 뒤 merge한다.
5. `main` push 뒤 Actions의 migrate 로그를 먼저 확인한다. 실패하면 Pages 배포가 안 되는 것이 정상 안전장치다.

**절대 하지 말 것:** 운영 DB에 `supabase db reset --linked`, `supabase/DEV_RESET_WIPES_ALL.sql`, 예전 `RESET.sql`을 실행하지 않는다. 이들은 개발용이거나 데이터 손실 위험이 있다.

## 데이터 보호와 복구

### 사용자 데이터 백업

- 큰 기능 변경 전: 앱 **설정 → 데이터 → JSON 내보내기**로 로컬 백업을 받는다.
- 로그인 후 앱은 계정별 cloud backup을 하루 한 번 만들고 최근 7개를 보관한다. 이것은 편의 백업이지 유일한 재해복구 수단은 아니다.
- Supabase Dashboard에서 DB 백업 정책/플랜을 확인하고, 정말 중요한 데이터라면 정기적인 별도 export를 둔다.
- 복원 파일에는 개인정보와 첨부 이미지가 들어갈 수 있으므로 이메일·공개 드라이브에 무심코 올리지 않는다.

### 동기화 이상이 의심될 때

1. 먼저 브라우저를 닫지 말고 설정에서 JSON 백업을 받는다.
2. 같은 계정의 다른 기기에도 올바른 데이터가 남아 있는지 확인한다.
3. Supabase 테이블을 직접 수정하기 전, 문제 시각·기기·항목을 메모하고 cloud backup을 확인한다.
4. 처음에는 한 기기만 열어 수정한 뒤 동기화가 끝나는지 본다. 여러 기기에서 동시에 대량 편집/복원을 반복하지 않는다.

## 계정·인프라 인계

| 대상 | 확인할 것 |
| --- | --- |
| GitHub | 개인 이메일, 2단계 인증, 저장소 Admin, Actions 실행 권한, Pages 설정 |
| Supabase | 개인 Owner, 결제수단/플랜, Auth 메일 발송 설정, Storage 버킷, Access Token 보관 |
| 도메인 | 나중에 커스텀 도메인을 쓰면 DNS 소유 계정과 Pages 도메인 설정을 개인 계정으로 |
| 브라우저 | 주 사용 기기에서 로그인·동기화·JSON export가 되는지 |
| 로컬 개발 | Node.js LTS, Git, `.env.local`의 공개 웹 환경변수 |

Supabase Auth의 Site URL/Redirect URLs에는 현재 아래 주소가 들어 있어야 한다.

- `https://baggychani.github.io/GichanPlanner/`
- `https://baggychani.github.io/GichanPlanner/**`
- 개발용 `http://localhost:5173/`, `http://localhost:8734/`

학교 이메일이 로그인 수단이라면, 프로젝트를 잃기 전에 GitHub와 Supabase 모두에 개인 이메일/개인 계정을 연결해 둔다.

## 평소 배포 루틴

```powershell
npm install
npm run lint
npm run build
git status
git add <바꾼-파일들>
git commit -m "feat: 설명"
git push
```

1. 작은 기능 단위로 브랜치와 PR을 만든다.
2. PR에서 자동 검사와 diff를 본다.
3. `main`에 merge한다.
4. GitHub Actions에서 DB migration이 성공한 뒤 Pages가 성공했는지 확인한다.
5. 실제 배포 주소에서 로그인, 새 할 일 저장, 다른 기기 반영을 짧게 확인한다.

## 이미 반영된 장기 기반

- **데이터 규모:** 새 기기 초기 동기화는 페이지 단위로 모든 레코드를 읽고, 이후에는 변경 시각 cursor를 이용한 증분 pull을 한다. 기기 시계 차이로 변화가 영구 누락되지 않도록 하루에 한 번은 전체 reconciliation도 한다.
- **DB 인덱스:** planner 테이블에 소유자/ID 및 소유자/갱신시각/ID 인덱스를 추가했다. 사용자 데이터가 커져도 기본 동기화 쿼리가 덜 느려진다.
- **여러 기기:** Supabase Realtime publication과 앱 구독을 추가했다. 열린 다른 기기의 변경을 짧게 묶어 다시 동기화한다.
- **무결성:** 카테고리·목표·프로젝트 삭제 시 관련 참조를 정리하고, import/backup은 형식·크기·소유자 기준으로 검증한다.
- **복원 안전성:** import는 Dexie transaction 안에서 적용해 중간 실패 때 반쯤 복원되는 위험을 줄였다.
- **PWA:** 설치형 manifest와 정적 앱 셸 캐시를 넣었다. 데이터/API 응답은 캐시하지 않으므로 로그인과 동기화 규칙은 그대로다.
- **사진 동기화:** 새 사진은 매번 변경 불가능한 Storage 경로로 업로드하고 row의 경로를 바꾼다. 같은 파일 경로를 덮어써서 다른 기기가 예전 사진을 계속 쓰는 문제를 피한다. 교체된 파일은 안전을 위해 즉시 지우지 않으므로, 나중에 age-based orphan Storage GC를 추가한다.

## 다음 개발 우선순위

### 1. 신뢰성 (가장 먼저)

- Playwright 또는 Vitest로 로그인 후 동기화, 충돌 병합, import/restore, 삭제 cascade의 자동 테스트를 만든다.
- Sentry 같은 오류 추적을 붙일지 결정한다. 붙인다면 개인정보/할 일 제목이 전송되지 않도록 scrub 규칙부터 만든다.
- 운영용 Staging Supabase 프로젝트를 따로 둔다. 새 migration은 staging에서 먼저 적용하고 production에 간다.
- 데이터 보존 정책(백업 기간, soft-delete 영구 삭제 시점, 첨부 파일 정리)을 문서화한다.

### 2. 웹앱에서 모바일 앱으로 가기 위한 준비

- 현재 PWA를 실제 Android/iOS 기기에서 설치·오프라인·업데이트해 본다.
- 화면 크기별 캘린더/드래그 UX와 터치 접근성을 다듬는다.
- 도메인 로직(`src/lib/`)과 UI를 분리한 상태를 지킨다. 나중에 React Native/Capacitor로 갈 때 동기화·검증 로직을 재사용하기 쉽다.
- 네이티브 알림을 붙이기 전에 timezone, 반복 일정, 알림 권한 거부, 기기 간 중복 알림 정책을 먼저 설계한다.

### 3. 제품 기능

- 반복 일정의 예외/건너뛰기 모델, 시간대 처리, 종일 일정, 검색/필터, 휴지통 복원.
- 푸시 알림: 서버 스케줄러와 notification subscription, 해제/재등록, 중복 방지 키가 필요하다.
- 공유 플래너: 현재 개인 소유자 모델에서 역할(소유자/편집자/읽기전용), RLS, 초대 만료, audit log를 새로 설계해야 한다. 단순히 `owner_id`만 공유하지 않는다.

### 4. 데이터가 아주 커진 뒤

- 완료/삭제된 오래된 항목 archive와 pagination UX.
- 첨부 이미지 썸네일/압축·용량 제한·고아 Storage 파일 정리 작업. 현재는 새 버전 사진 경로를 즉시 지우지 않으므로, 참조되지 않은 파일을 충분한 유예 기간 뒤 정리하는 서버 작업이 필요하다.
- sync cursor와 최근 변경 테이블의 실제 부하를 측정한 뒤, 필요할 때만 서버 측 변경 로그/배치 동기화를 검토한다.

## 장애별 빠른 판단

| 증상 | 먼저 볼 곳 | 안전한 첫 대응 |
| --- | --- | --- |
| Actions migrate 실패 | GitHub Actions 로그, Secret 이름 | Secret 값을 다시 확인하고 재실행. SQL을 즉시 고치지 말 것 |
| `db push`가 과거 migration 충돌 | Supabase migration history, 실제 DB schema | 이미 적용된 것인지 먼저 판별. 확실할 때만 repair/adopt |
| 사이트는 배포됐는데 로그인 실패 | Supabase Auth URL Configuration, `VITE_*` Secrets | Site URL/Redirect URL 및 build secrets 확인 |
| 다른 기기에 즉시 안 보임 | Realtime migration #19000, 로그인 계정, 네트워크 | 새로고침 후 잠시 기다리고, 한 기기에서 재현 확인 |
| 데이터가 사라진 듯 보임 | 설정 JSON export, cloud backup, 다른 기기 | 무엇보다 먼저 export. 대량 수정·삭제를 멈춤 |
| 오프라인에서 앱이 안 열림 | 한번이라도 최신 사이트를 열었는지, 브라우저 storage | 인터넷 연결 후 한 번 열고 새로고침해 앱 셸을 갱신 |

## 알아두면 좋은 파일

- `.github/workflows/pages.yml` — Supabase migration과 Pages 배포 순서
- `supabase/migrations/` — 추가만 하는 DB 변경 이력
- `supabase/ADD_MISSING.sql` — 기존 DB를 수동으로 보정할 때 쓰는 묶음 SQL
- `src/lib/supabaseSync.ts` — 동기화·충돌·Realtime의 중심
- `src/lib/portablePlannerExport.ts`, `src/lib/supabasePlannerImport.ts` — 백업/복원 검증
- `public/manifest.webmanifest`, `public/sw.js` — 설치형 PWA·오프라인 앱 셸

이 파일을 최신 상태로 유지하는 것 자체가 운영 기능이다. 인프라, 배포 방법, 백업 정책을 바꿀 때마다 해당 절을 함께 고친다.

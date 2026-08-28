# Cursor / 다음 AI 에이전트 인수인계

이 파일은 GichanPlanner를 이어서 작업할 AI와 사람에게 남기는 기술 인수인계다. 새 작업을 시작하기 전에 반드시 `AGENTS.md`, `AFTER_CODEX.md`, 이 파일, 그리고 `git status --short`를 읽는다.

## 현재 배포·Git 상태

- 저장소: `baggychani/GichanPlanner`
- 배포 주소: <https://baggychani.github.io/GichanPlanner/>
- 작업 브랜치: `production-foundation`
- 검토할 Draft PR: [#4 동기화 확장성 및 배포 자동화 기반](https://github.com/baggychani/GichanPlanner/pull/4)
- PR base: `main`. 에이전트가 임의로 merge/Ready for review 하지 않는다.
- 최신 인수인계 커밋: `e0347a3` (PWA, immutable image sync, Cursor handoff).
- 그 이전 기반 커밋: `e2eace5` (동기화/백업 안전성), `85ccca9` (Realtime), `494ff7c` (증분 sync 인덱스). 후속 변경은 PR #4에 이어서 새 커밋으로 남긴다.

작업 전에는 항상 `git status --short`, `git log --oneline -6`, `git diff`를 확인한다. 다른 사람이 만든 변경을 되돌리거나 넓은 reset/checkout을 하지 않는다.

## 다음 사람이 알아야 하는 배포 전제

GitHub Actions workflow `.github/workflows/pages.yml`은 다음을 보장하도록 바뀌었다.

1. Supabase migration 적용
2. Vite build
3. GitHub Pages deploy

그러므로 DB migration이 실패하면 새 웹앱도 배포되지 않는다. 이것은 의도된 안전장치다.

### GitHub Repository Secrets

이름만 저장소에 존재하며, **값을 문서/로그/Git에 남기지 않는다.**

| Secret | 상태/역할 |
| --- | --- |
| `VITE_SUPABASE_URL` | 기존 설정. 웹 앱 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | 기존 설정. 공개 anon key |
| `VITE_DEXIE_CLOUD_URL` | 기존 설정. 실제 사용 여부는 별도 검토 |
| `SUPABASE_PROJECT_REF` | 설정됨. CLI 연결 대상 |
| `SUPABASE_ACCESS_TOKEN` | 사용자가 직접 넣어야 함 |
| `SUPABASE_DB_PASSWORD` | 사용자가 직접 넣어야 함 |

현재 missing two secrets가 채워지기 전에는 migration job 실패가 정상이다. secret의 실제 값은 에이전트가 요구하거나 출력해서는 안 된다.

### 기존 Supabase DB 최초 연결

현재 DB가 `20260820000000`부터 `20260820170000`까지의 스키마를 **실제로 이미** SQL Editor로 적용한 경우만, PR merge 후 Actions의 manual run에서 `adopt_existing_schema=true`를 한 번 실행한다. 그것은 history만 등록하고, 새 `18000`, `19000` migration은 `db push`로 적용한다.

DB가 과거 SQL을 실제로 갖고 있지 않다면 adoption을 절대 켜지 않는다. 자세한 사람용 절차는 `AFTER_CODEX.md`에 있다.

## 아키텍처 지도

| 영역 | 핵심 파일 | 역할 |
| --- | --- | --- |
| 로컬 저장소 | `src/lib/db.ts` | Dexie 테이블과 local schema migrations |
| 동기화 | `src/lib/supabaseSync.ts` | pull/push, conflict merge, cloud shadows, Realtime, attachment transfer |
| 병합 | `src/lib/plannerMerge.ts` | three-way merge와 field-level shadow |
| DB row 변환 | `src/lib/plannerSyncSchema.ts` | local/remote row mapping |
| 데이터 작업 | `src/lib/taskOps.ts` | cascade-like local operation, reorder/move/copy |
| 백업/복원 | `src/lib/portablePlannerExport.ts`, `src/lib/supabasePlannerImport.ts`, `src/lib/plannerBackupSnapshots.ts` | 검증된 portable JSON / cloud snapshots |
| DB 변경 | `supabase/migrations/` | append-only production schema history |
| 배포 | `.github/workflows/pages.yml` | DB → build → Pages |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `src/main.tsx` | installable shell and same-origin static caching |

## 이번 기반 작업에서 해결한 것

- 1,000개를 넘는 planner row도 새 기기에서 page 단위로 full hydration 한다.
- 이후 pull은 `updated_at` cursor로 delta를 읽고, 하루 한 번 full reconciliation을 해 기기 시계 차이로 row가 영구 미수신되는 위험을 줄인다.
- `owner_id/id`, `owner_id/updated_at/id` DB indexes (`20260820180000`)를 추가했다.
- Supabase Realtime publication + client subscription (`20260820190000`)으로 여러 열린 기기에 변화가 전파된다.
- import/backup/삭제 cascade의 검증을 강화했다.
- task/profile image는 변경할 때 immutable UUID Storage path를 새로 쓴다. 같은 key를 덮어써 다른 기기가 예전 blob을 재사용하던 버그를 막는다.
- PWA manifest + static app shell service worker를 넣었다. 앱 데이터나 Supabase 응답은 Cache API에 넣지 않는다.
- 모바일에서 440px 고정 폭이던 데드라인 모달을 `w-full max-w-[440px]`로 바꿨다.
- Supabase CLI는 Action `v3` + CLI `2.101.0`을 명시해 migration 동작이 조용히 바뀌지 않게 했다.

## 현 동기화의 중요한 한계와 다음 우선순위

### P0: 계정 전환 중 지연된 로컬 write 차단

`src/lib/supabaseSync.ts`의 Dexie creating/updating hook은 transaction이 끝난 뒤 `currentUserId()`를 다시 읽는다. A 계정에서 저장한 직후 로그아웃하고 B 계정으로 바꾸면, 늦게 실행된 callback이 아직 남아 있는 A row를 B의 token으로 push해 **A 데이터를 B 계정에 복제할 가능성**이 있다.

수정 방향:

1. 각 hook 진입 시 `const ownerAtCommit = localStorage.getItem(OWNER_KEY)`를 capture한다.
2. `whenCommitted` callback에서는 `currentUserId()` 결과와 현재 `OWNER_KEY`가 모두 `ownerAtCommit`과 같을 때만 `pushTask`, `pushSimpleRow`, `pushProfile`을 호출한다.
3. owner가 없거나 다르면 callback을 조용히 버린다. 로그인 전 guest data는 이미 `syncNow`의 bulk push가 처리하므로 이 guard와 충돌하지 않는다.
4. 브라우저 프로필 A/B로 “A에서 write → 즉시 sign out → B sign in” 시나리오를 자동/수동 검증한다.

### P0: 서버 진실의 순서(sequence) + durable outbox

현재 `updated_at`과 revision은 클라이언트가 생성한다. 하루 한 번 full reconciliation은 **영구 누락 완화책**일 뿐, 기기 시계가 틀린 상태에서 “사용자가 나중에 수정한 값”을 서버가 정확히 판정하는 근본 해결은 아니다.

장기 해법:

1. 서버가 발급하는 단조 증가 change sequence 또는 change log를 만든다.
2. 각 클라이언트는 mutation outbox에 수정 의도를 durable하게 저장한다.
3. push는 idempotency key를 사용한다.
4. pull cursor는 클라이언트 시각이 아니라 서버 sequence를 쓴다.
5. 웹 Dexie와 미래 모바일 SQLite 모두 같은 sync protocol을 쓴다.

이것은 큰 설계 변경이다. 기존 data를 가진 production에서 한 번에 바꾸지 말고, 새 로그를 병행 기록 → client dual-read → cutover → 구 cursor 제거 순서로 migration한다.

### P0: 이미지 orphan lifecycle

새 사진은 immutable path이므로 교체된 이전 Storage object를 즉시 지우지 않는다. 오래된 기기가 아직 그 path를 읽을 수 있기 때문이다.

다음 단계는 server-side, age-based GC다.

- DB가 현재 참조하는 `tasks.image_path`, `profiles.avatar_path` 목록을 기준으로 한다.
- 예: 30~90일 이상 참조되지 않은 `task-images`/`profile-images` object만 삭제한다.
- cron + Edge Function/service-role 전용 코드로 수행한다. 브라우저 anon client가 삭제하지 않는다.
- 먼저 dry-run/report만 만들고 백업·로그를 확인한 뒤 실제 delete를 켠다.

### P1: 원자 RPC와 DB 참조 무결성

현재 카테고리/프로젝트 삭제는 Dexie에서 여러 row를 바꾼 뒤 각각 sync한다. 서버에서 잠시 부분 상태가 보일 수 있다. `delete_domain`, `delete_project`, reorder/move 같은 복합 작업을 Postgres RPC로 만들고 하나의 transaction에서 처리해야 한다.

`domain_id`, `goal_id`, `project_id`는 같은 owner의 살아 있는 parent를 가리키는지 DB 차원에서 보장하지 않는다. future migration에서는 owner-aware FK 또는 trigger validation/RPC를 넣고, 소프트 삭제된 부모 처리 규칙도 통일한다.

### P1: validation, tests, observability

- DB CHECK: 제목/메모 최대 길이, reminder 범위, start/end 시간, 날짜 범위.
- Storage: MIME type/size 제한을 bucket policy/server boundary에도 강제.
- Test: Vitest로 `threeWayMerge`, export/import, cursor/image path; Playwright로 두 기기 동기화; Supabase local로 RLS/RPC/migration integration.
- Observability: sync 오류를 개인정보 없이 집계할 수 있는 오류 추적/structured event. 실제 할 일 제목·메모·첨부 URL을 외부 telemetry에 보내지 않는다.

### P2: product/mobile

- 반복 일정: RFC 5545/명확한 recurrence model, occurrence, exception/skip, timezone 설계부터.
- 실제 알림: timezone, device subscription/token, user preferences, idempotent delivery, cron/Edge Function, retry 및 duplicate prevention.
- 공유 플래너: owner/editor/viewer 역할, invitation expiration, RLS, audit log를 별도 설계. 현재 `owner_id` 모델을 단순 공유하지 않는다.
- 데이터가 커지면 local full-table scan을 dirty outbox + range query model로 바꾸고, calendar는 날짜 range index/query를 쓴다.

## 변경할 때 지켜야 할 규칙

1. `supabase/migrations/`의 이미 배포한 파일은 수정하지 않는다. 새 파일을 추가한다.
2. `ADD_MISSING.sql`은 migration 신규 추가 시 함께 맞춘다. 라이브 reset 파일은 실행하지 않는다.
3. RLS와 owner scope를 우회하는 browser-side service role key를 절대 넣지 않는다.
4. Storage object는 owner UUID가 첫 directory segment인 경로를 유지한다. 예: `<owner>/tasks/<task>/<uuid>.webp`.
5. PWA service worker는 static same-origin GET shell/assets만 cache한다. 인증/REST/Storage 경로를 cache하면 stale data/security 문제가 생긴다.
6. PR을 만들어도 owner가 명시하지 않으면 merge하지 않는다.
7. 큰 schema/sync 변경 전에는 JSON export와 Supabase backup 상태를 먼저 확인한다.

## 작업·검증 루틴

```powershell
npm install
npm run lint
npm run build
git diff --check
git status --short
```

수정한 뒤에는 최소한 빌드·lint·diff check를 실행하고, data/sync change는 Chrome 개발자 도구와 두 개 브라우저 프로필에서 로그인/수정/반영을 재현한다. 배포 workflow를 바꾸면 PR merge 전에는 draft 상태로 두고 secret 및 manual deployment path를 문서화한다.

## Cursor에게 바로 붙여 넣을 첫 프롬프트

```text
이 저장소의 AGENTS.md, CURSOR_HANDOFF.md, AFTER_CODEX.md를 먼저 읽고 git status와 최근 log를 확인해. 현재 Draft PR #4의 작업을 안전하게 이어가되, production secret·DB reset·PR merge는 내 허가 없이 하지 마. 먼저 남은 변경과 검증 결과를 짧게 보고한 뒤, 가장 높은 우선순위 하나만 제안해.
```

이 파일은 코드와 인프라가 바뀔 때 함께 갱신한다. 다음 에이전트가 무엇을 모르는지보다, 무엇을 사실로 확인해야 하는지 명확히 적는 것이 목적이다.

# GichanPlan

## Dexie Cloud 계정 및 동기화 연결

이 앱은 로컬 IndexedDB(Dexie)를 항상 먼저 사용합니다. Dexie Cloud 주소가 설정된 경우에만 Google 로그인과 기기 간 동기화가 활성화됩니다.

1. 프로젝트 루트에서 `npx dexie-cloud create`를 실행하고, 이메일로 받은 일회용 코드를 입력합니다.
2. 발급된 데이터베이스 URL을 `.env.local`에 넣습니다. 예시는 [`.env.example`](.env.example)에 있습니다.
3. 개발 서버를 다시 시작합니다. 앱의 프로필 아이콘에서 Google로 로그인할 수 있습니다. 처음 연결이 가입입니다.
4. 실제 배포 후에는 `npx dexie-cloud whitelist https://배포-도메인`으로 배포 주소를 허용합니다.

무료 플랜에서는 본인과 공유할 사용자를 프로덕션 사용자로 지정해야 평가 기간 종료 뒤에도 동기화가 멈추지 않습니다.

## 향후 Supabase 전환

도메인 데이터는 Dexie Cloud에 직접 묶이지 않도록 UUID, 버전, 수정·삭제 시각을 유지합니다. 프로필에는 Dexie Cloud의 사용자 ID와 이메일을 함께 보존합니다. 이것은 Supabase 로그인 뒤 새 `auth.uid()`에 기존 데이터를 안전하게 연결하기 위한 매핑 키입니다.

- 프로필 메뉴의 **내 데이터 백업 다운로드**는 할 일·일정·카테고리·프로필·압축 사진 Blob을 단일 JSON으로 내보냅니다.
- `src/lib/supabasePlannerImport.ts`는 그 JSON을 Supabase Postgres와 Storage로 올리고, `legacy_dexie_identities`에 기존 Dexie 사용자 ID ↔ 새 Supabase 사용자 ID를 기록합니다.
- `supabase/migrations/`에는 그 매핑 테이블, task/profile 사진 버킷, RLS 정책이 포함됩니다.

Supabase 전환 당일에는 Dexie Cloud 쓰기를 잠시 멈추고 최종 백업을 만든 뒤, Supabase에서 각 사용자가 이메일·비밀번호 또는 Google로 한 번 로그인한 뒤 import를 실행합니다. Dexie 로그인 세션은 옮기지 않고, 검증된 새 로그인에 기존 데이터를 연결합니다. 현재 앱 화면의 로그인은 Google만 사용합니다.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

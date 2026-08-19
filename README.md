# GichanPlan

## Dexie Cloud 계정 및 동기화 연결

이 앱은 로컬 IndexedDB(Dexie)를 항상 먼저 사용합니다. Dexie Cloud 주소가 설정된 경우에만 로그인과 기기 간 동기화가 활성화됩니다.

1. 프로젝트 루트에서 `npx dexie-cloud create`를 실행하고, 이메일로 받은 일회용 코드를 입력합니다.
2. 발급된 데이터베이스 URL을 `.env.local`에 넣습니다. 예시는 [`.env.example`](.env.example)에 있습니다.
3. 개발 서버를 다시 시작합니다. 앱의 프로필 아이콘에서 이메일 일회용 코드 또는 Google로 로그인할 수 있습니다.
4. 실제 배포 후에는 `npx dexie-cloud whitelist https://배포-도메인`으로 배포 주소를 허용합니다.

무료 플랜에서는 본인과 공유할 사용자를 프로덕션 사용자로 지정해야 평가 기간 종료 뒤에도 동기화가 멈추지 않습니다.

## 향후 Supabase 전환

도메인 데이터는 Dexie Cloud에 직접 묶이지 않도록 UUID, 버전, 수정·삭제 시각을 유지합니다. `supabase/migrations/`에는 이후 Postgres·Storage 기반으로 옮길 때 사용할 초안이 있습니다. 현재 앱은 Supabase 환경 변수를 요구하지 않습니다.

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

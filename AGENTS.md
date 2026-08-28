# GichanPlanner agent instructions

Start every substantial task by reading [CURSOR_HANDOFF.md](CURSOR_HANDOFF.md) and [AFTER_CODEX.md](AFTER_CODEX.md), then run `git status --short` before editing. They are the durable handoff from the previous agent.

## Project boundaries

- Stack: Vite + React + TypeScript + Dexie (offline local data) + Supabase (Auth, Postgres, Storage, Realtime) + GitHub Pages.
- Keep domain/data behavior in `src/lib/` and UI in `src/components/`. Do not put sync decisions in React components.
- `src/lib/supabaseSync.ts` is conflict-aware sync infrastructure. Treat changes there as high risk: inspect merge, shadows, image handling, and all-device behavior before editing.
- Run `npm run lint`, `npm run build`, and `git diff --check` for every behavior/data/CI change. Add focused tests when test infrastructure is introduced.

## Production safety

- Never print, commit, paste, or search broadly for secret values. `.env.local` stays local.
- Supabase migrations are append-only after deployment. Add a new timestamped file under `supabase/migrations/`; never rewrite a migration already on `main`.
- Do not run `supabase db reset --linked`, `supabase/DEV_RESET_WIPES_ALL.sql`, or the legacy reset script against production.
- Production deploy is GitHub Actions: migration first, then build, then Pages. The missing GitHub repository secrets are documented in `AFTER_CODEX.md`.
- Ask the repository owner before merging a PR, changing production secrets, running destructive SQL, deleting Storage data, or transferring account ownership.

## Data and mobile rules

- Planner data is per-user and protected with Supabase RLS. Preserve owner boundaries in all queries, RPCs, and Storage paths.
- Keep attachments immutable: a new task/profile image must get a new Storage path; do not overwrite an existing image object in place.
- The PWA cache owns only same-origin static shell/assets. Do not cache authenticated Supabase/Auth/Storage responses in `public/sw.js`.
- Prefer additive, backwards-compatible schema/API changes so existing web installs and later mobile clients can coexist.

## Useful commands

```powershell
npm install
npm run lint
npm run build
git diff --check
git status --short
```

Keep this file concise. Put operational history, current PR state, and roadmap details in `CURSOR_HANDOFF.md`.

# AGENTS.md: working notes for AI agents

Notes for AI coding agents working in this repository. Human contributors: see [CONTRIBUTING.md](CONTRIBUTING.md).

Source of truth for scope and acceptance: the owner's private execution plan, kept outside Git at `.local/ZIDCMS_EXECUTION_PLAN.md` (ask the owner for a copy if it is missing; never commit it). Decisions: `docs/decisions/`.

## Toolchain

- Node 26 (`.nvmrc`), pnpm 12 (`packageManager`). pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml` (not `onlyBuiltDependencies`).
- Next.js 16 (Turbopack). APIs differ from older versions: read `node_modules/next/dist/docs/` before changing framework code. `params`/`searchParams` are Promises. `output: 'export'` rejects empty `generateStaticParams()`, hence the `__zidcms-empty__` placeholder in `apps/web/lib/site.ts`.
- `agentRules: false` is set in both `next.config.ts` files so `next dev` does not generate per-app AGENTS.md files.
- Tailwind CSS 4 (CSS-first config in `app/globals.css`), Biome 2 for lint + format, Vitest 5.

## Commands

| Task                                   | Command                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Install                                | `pnpm install`                                                                                                                |
| Lint / format                          | `pnpm lint` / `pnpm format`                                                                                                   |
| Typecheck                              | `pnpm typecheck`                                                                                                              |
| Unit + contract tests                  | `pnpm test`                                                                                                                   |
| Build everything                       | `pnpm build` (core has no build; GAS bundle → `services/apps-script/dist`)                                                    |
| Static-output check                    | `pnpm check:web` (after build)                                                                                                |
| Secret scan                            | `pnpm scan:secrets` (bundles) / `pnpm scan:secrets --repo` (tracked files)                                                    |
| Local stack                            | `pnpm dev:gas` (emulator :8787) + `pnpm dev:admin` (:3000) + `pnpm dev:web` (:3001)                                           |
| End-to-end smoke (local stack running) | `pnpm smoke:local`                                                                                                            |
| Integration (emulator / dev GAS)       | `pnpm test:integration` / `ZIDCMS_ENV_FILE=<dev env file> pnpm test:integration` (needs a recreated dev env, ADR-0012)        |
| E2E (local stack / staging)            | `pnpm test:e2e` / `ZIDCMS_ENV_FILE=<dev env file> E2E_TARGET=staging pnpm test:e2e` (needs a recreated dev env; refuses prod) |
| Deployed checks (prod)                 | `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm check:deployed` (`ZIDCMS_ENV_FILE` required)                                    |
| Sacrificial-post smoke + rollback      | `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm smoke:deployed` (`ZIDCMS_ENV_FILE` required; ~4–8 deployments)                  |
| Failed-build switch (dev web)          | `pnpm build-switch on\|off` (needs a recreated dev web project, ADR-0012)                                                     |
| Reset published content to empty v0    | `pnpm reset:content`                                                                                                          |
| PoCs against real services             | `pnpm poc:gas`, `pnpm poc:sheets`, `pnpm poc:git`                                                                             |

## Rules that are easy to break

- The repo is public: never commit `.env*` (except `.env.example`), `.clasp.json`, GAS URLs/IDs, spreadsheet/Drive IDs, or the admin e-mail. Tests use `@example.com`.
- Published content lives in `apps/web/content/prod/` (`content/dev/` was removed with the dev environment, ADR-0012) and is written only by the publisher. Build paths (`apps/web/content/snapshot.json`, `apps/web/public/zidcms-version.json`, `apps/web/public/media/`) are generated and gitignored (ADR-0011).
- Shell heredocs longer than ~10 KB get truncated by the agent tool; write large files with the file-write tool.
- Do not add comments unless asked; `biome-ignore` directives are allowed where a rule is intentionally bypassed.
- UI copy is Bahasa Indonesia (owner decision); docs and code identifiers are English.

## Session handoff (read first in a new session)

- Status and next steps: `docs/history/next-steps.md` (then `day-2.md`, `release-v0.1.0.md`, `retrospective.md`). v0.1.0 is tagged as an early-stage pre-release.
- Only prod is hosted (ADR-0012, 2026-11-22): admin <https://zidcms-prod-admin.vercel.app>, site <https://zidcms-prod-web.vercel.app>, branch `release`. The dev Vercel projects and dev Apps Script deployment were deleted; dev local config is archived as `.local/secrets/*.retired`. Real-service integration tests, the staging E2E and `pnpm build-switch` need a recreated dev env (`docs/deployment.md` §1–2 with `ZIDCMS_ENV=dev`).
- Vercel Hobby allows 100 deployments per 24 h for the whole account, and builds cancelled by the Ignored Build Step count. `main` creates no deployments; a prod publish costs ~1–2, a promotion ~1–2, `smoke:deployed` ~4–8. Count before running anything that publishes (`vercel api /v6/deployments?limit=100`).
- Prod Apps Script uses `services/apps-script/.clasp.prod.json` (`clasp -P .clasp.prod.json …`; prod deploys need owner approval). Promote code with `main` → `release` merges only, then verify with `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm check:deployed`.
- E2E/smoke evidence is written to `tests/e2e/results/` (gitignored; Playwright wipes `test-results/` on every run).
- Owner communicates in Bahasa Indonesia; reply in Indonesian.
- Commit identity: always `git -c user.name="Devin" -c user.email="158243242+devin-ai-integration[bot]@users.noreply.github.com" commit …` (owner decision; never change git config). Push to `origin main` is allowed for this project.
- The prod publisher commits `content: publish vN (job …)` to `release` (never to `main`). Promote code to prod by merging `main` into `release`; never merge `release` back.
- CLIs on the owner's machine are logged in: `gh`, `clasp` (cwd `services/apps-script`), `vercel`.
- Private config lives only in gitignored files: `.local/secrets/prod.env` (secrets, GAS URL, PAT, OAuth client), `services/apps-script/.clasp.prod.json`; retired dev files end in `.retired`. Never print their values; redirect CLI output that contains IDs/URLs to `.local/secrets/*.log`.
- Real-GAS scripts: `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm poc:gas [action json]` (prod is the only environment: prefer read-only actions such as `system.health`), `pnpm poc:sheets`.
- Redeploy Apps Script keeping the URL: see `docs/deployment.md` §1 (prod uses `clasp -P .clasp.prod.json`; owner approval).
- Vercel env: edit `.local/secrets/prod.env`, then `pnpm exec tsx scripts/vercel-env-sync.ts prod`. In Git Bash set `MSYS_NO_PATHCONV=1` for `vercel api /v…` calls. Runtime/request logs: `vercel logs [requests] --scope <team> --project zidcms-prod-admin` (Hobby keeps ~30 min).
- Browser checks: Playwright + Chromium are installed (`@playwright/test` at the root); local dev login is `admin@example.com` with `pnpm init:local` env.
- Windows gotchas: Python `open()` writes CRLF unless `newline=''`; Biome formats Markdown in CI (run `pnpm exec biome check --write .` before committing); backslashes in shell heredocs can be mangled, so use the file-edit tool.

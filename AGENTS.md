# AGENTS.md — working notes for AI agents and contributors

Source of truth for scope and acceptance: the owner's private execution plan, kept outside Git at `.local/ZIDCMS_EXECUTION_PLAN.md` (ask the owner for a copy if it is missing; never commit it). References like "plan §21" in docs and code point to its sections. Decisions: `docs/decisions/`.

## Toolchain

- Node 26 (`.nvmrc`), pnpm 12 (`packageManager`). pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml` (not `onlyBuiltDependencies`).
- Next.js 16 (Turbopack). APIs differ from older versions — read `node_modules/next/dist/docs/` before changing framework code. `params`/`searchParams` are Promises. `output: 'export'` rejects empty `generateStaticParams()`, hence the `__zidcms-empty__` placeholder in `apps/web/lib/site.ts`.
- `agentRules: false` is set in both `next.config.ts` files so `next dev` does not generate per-app AGENTS.md files.
- Tailwind CSS 4 (CSS-first config in `app/globals.css`), Biome 2 for lint + format, Vitest 5.

## Commands

| Task                                   | Command                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Install                                | `pnpm install`                                                                           |
| Lint / format                          | `pnpm lint` / `pnpm format`                                                              |
| Typecheck                              | `pnpm typecheck`                                                                         |
| Unit + contract tests                  | `pnpm test`                                                                              |
| Build everything                       | `pnpm build` (core has no build; GAS bundle → `services/apps-script/dist`)               |
| Static-output check                    | `pnpm check:web` (after build)                                                           |
| Secret scan                            | `pnpm scan:secrets` (bundles) / `pnpm scan:secrets --repo` (tracked files)               |
| Local stack                            | `pnpm dev:gas` (emulator :8787) + `pnpm dev:admin` (:3000) + `pnpm dev:web` (:3001)      |
| End-to-end smoke (local stack running) | `pnpm smoke:local`                                                                       |
| Integration (emulator / dev GAS)       | `pnpm test:integration` / `ZIDCMS_ENV_FILE=.local/secrets/dev.env pnpm test:integration` |
| E2E (local stack / staging)            | `pnpm test:e2e` / `E2E_TARGET=staging pnpm test:e2e`                                     |
| Deployed checks (dev / prod)           | `pnpm check:deployed` / `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm check:deployed`    |
| Sacrificial-post smoke + rollback      | `ZIDCMS_ENV_FILE=.local/secrets/<env>.env pnpm smoke:deployed` (~12 deployments)         |
| Failed-build switch (dev web)          | `pnpm build-switch on\|off`                                                              |
| Reset published content to empty v0    | `pnpm reset:content`                                                                     |
| PoCs against real services             | `pnpm poc:gas`, `pnpm poc:sheets`, `pnpm poc:git`                                        |

## Rules that are easy to break

- The repo is public: never commit `.env*` (except `.env.example`), `.clasp.json`, GAS URLs/IDs, spreadsheet/Drive IDs, or the admin e-mail. Tests use `@example.com`.
- Published content lives in `apps/web/content/{dev,prod}/` and is written only by the publisher. Build paths (`apps/web/content/snapshot.json`, `apps/web/public/zidcms-version.json`, `apps/web/public/media/`) are generated and gitignored (ADR-0011).
- Shell heredocs longer than ~10 KB get truncated by the agent tool; write large files with the file-write tool.
- Do not add comments unless asked; `biome-ignore` directives are allowed where a rule is intentionally bypassed.
- UI copy is Bahasa Indonesia (owner decision); docs and code identifiers are English.

## Session handoff (read first in a new session)

- Status and next steps: `docs/status/next-steps.md` (then `day-2.md`, `release-v0.1.0.md`, `retrospective.md`). v0.1.0 is tagged as an early-stage pre-release.
- Vercel Hobby allows 100 deployments per 24 h for the whole account, and builds cancelled by the Ignored Build Step count. A publish costs ~3, a staging E2E ~15, `smoke:deployed` ~12. Count before running anything that publishes (`vercel api /v6/deployments?limit=100`); never more than one staging E2E per day.
- Prod Apps Script uses `services/apps-script/.clasp.prod.json` (`clasp -P .clasp.prod.json …`); dev uses `.clasp.json`. Promote code with `main` → `release` merges only.
- E2E/smoke evidence is written to `tests/e2e/results/` (gitignored; Playwright wipes `test-results/` on every run).
- Owner communicates in Bahasa Indonesia; reply in Indonesian.
- Commit identity: always `git -c user.name="Devin" -c user.email="158243242+devin-ai-integration[bot]@users.noreply.github.com" commit …` (owner decision; never change git config). Push to `origin main` is allowed for this project.
- The dev publisher commits `content: publish vN (job …)` to `main` (prod: to `release`): run `git pull --rebase` before pushing. Promote code to prod by merging `main` into `release`; never merge `release` back.
- CLIs on the owner's machine are logged in: `gh`, `clasp` (cwd `services/apps-script`), `vercel`.
- Private config lives only in gitignored files: `.local/secrets/dev.env` (secrets, GAS URL, PAT, OAuth client), `.local/secrets/dev-deployment-id.txt`, `services/apps-script/.clasp.json`. Never print their values; redirect CLI output that contains IDs/URLs to `.local/secrets/*.log`.
- Real-GAS scripts: `ZIDCMS_ENV_FILE=.local/secrets/dev.env pnpm poc:gas [action json]`, `pnpm poc:sheets`.
- Redeploy Apps Script keeping the URL: `pnpm --filter @zidcms/apps-script build && cd services/apps-script && clasp push --force && clasp create-deployment -i "$(cat ../../.local/secrets/dev-deployment-id.txt)" -d "<sha>"`.
- Vercel env: edit `.local/secrets/dev.env`, then `pnpm exec tsx scripts/vercel-env-sync.ts dev`. In Git Bash set `MSYS_NO_PATHCONV=1` for `vercel api /v…` calls. Runtime/request logs: `vercel logs [requests] --scope <team> --project zidcms-admin` (Hobby keeps ~30 min).
- Browser checks: Playwright + Chromium are installed (`@playwright/test` at the root); local dev login is `admin@example.com` with `pnpm init:local` env.
- Windows gotchas: Python `open()` writes CRLF unless `newline=''`; Biome formats Markdown in CI (run `pnpm exec biome check --write .` before committing); backslashes in shell heredocs can be mangled — use the file-edit tool.

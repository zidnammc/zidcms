# Deployment

## 1. Apps Script (Executor/owner, local with clasp)

1. `pnpm --filter @zidcms/apps-script build` → `services/apps-script/dist/Code.js` + `appsscript.json`.
2. `cd services/apps-script && clasp push`.
3. First time: in the editor, _Deploy → New deployment → Web app_, _Execute as: Me_, _Who has access: Anyone_; authorise the scopes; keep the deployment ID privately. Later: `clasp deploy -i <DEPLOYMENT_ID> -d "<git sha>"` so the URL stays stable.
4. `pnpm poc:gas` (TC-GAS-01…08) and `pnpm setup:sheet`.
5. Apps Script keeps at most 200 versions; delete old versions in _Project history_ when approaching the limit.
6. Prod only with owner approval; prod uses its own spreadsheet, folder, secret, and deployment.

## 2. Vercel (owner — Hobby has no team seats)

| Project | Root directory | Env                                                            |
| ------- | -------------- | -------------------------------------------------------------- |
| admin   | `apps/admin`   | all admin variables in `.env.example`; `PUBLISH_TARGET=github` |
| web     | `apps/web`     | `SITE_URL`                                                     |

- `ignoreCommand` in both `vercel.json` files compares against `VERCEL_GIT_PREVIOUS_SHA` with repo-root pathspecs (`:/apps/admin`, …): admin skips content-only commits, web skips admin-only commits, and the first deployment always builds. Git deployments are enabled for `main` and `dev` only.
- `pnpm exec tsx scripts/vercel-env-sync.ts dev` pushes the variables from `.local/secrets/dev.env` to both projects via the Vercel CLI without printing values.
- `apps/web/vercel.json` sets security headers, `zidcms-version.json` no-cache, and immutable caching for `/media/*`.
- Deployment budget (Hobby, 100/day, 1 concurrent build): batch code pushes; ≤ 40 code deploys + ≤ 30 publishes + 30 reserve per day.

## 3. CI

`.github/workflows/ci.yml` runs on PRs and pushes to `main`/`dev` (content-only commits are ignored): install (frozen lockfile) → lint → typecheck → tests → build → static-output check → secret scans → audit and license reports (non-blocking). No secrets are used in CI. `integration.yml` and `e2e.yml` are `workflow_dispatch` only and run against the local emulator stack; runs against the real dev services are done locally (see [testing.md](testing.md)).

## 4. Release checklist

See plan §27.2.

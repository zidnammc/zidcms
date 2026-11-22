# Deployment

Environments and branches (ADR-0011, amended by ADR-0012). Prod is the only hosted environment: admin <https://zidcms-prod-admin.vercel.app>, site <https://zidcms-prod-web.vercel.app>. `main` carries code only and creates no Vercel deployments (both `vercel.json` files enable Git deployments for `release` only).

| Environment | Vercel projects                        | Git branch | Content folder           | Google resources                   | Private config                                                     |
| ----------- | -------------------------------------- | ---------- | ------------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| dev/staging | retired 2026-11-22 (ADR-0012)          | —          | removed                  | none (old spreadsheet unreachable) | archived as `.local/secrets/*.retired`                             |
| prod        | `zidcms-prod-admin`, `zidcms-prod-web` | `release`  | `apps/web/content/prod/` | "ZidCMS prod" spreadsheet + script | `.local/secrets/prod.env`, `services/apps-script/.clasp.prod.json` |

## 1. Apps Script

Routine redeploy (keeps the web-app URL):

```bash
pnpm --filter @zidcms/apps-script build
cd services/apps-script
clasp push --force && clasp create-deployment -i "$(cat ../../.local/secrets/dev-deployment-id.txt)" -d "<git sha>"            # dev
clasp -P .clasp.prod.json push --force && clasp -P .clasp.prod.json create-deployment -i "$(cat ../../.local/secrets/prod-deployment-id.txt)" -d "<git sha>"   # prod (owner approval)
```

The dev line applies only to a recreated dev environment (ADR-0012). Then `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm poc:gas` (TC-GAS-01…08). Apps Script keeps at most 200 versions; delete old ones in _Project history_ when approaching the limit.

### First-time install of an environment (as done for prod on 2026-11-21)

1. Create spreadsheet + bound script: in `services/apps-script/`, `echo '{"rootDir":"dist"}' > .clasp.prod.json` and `clasp -P .clasp.prod.json create-script --type sheets --title "ZidCMS prod" --rootDir dist > ../../.local/secrets/clasp-create-prod.log`. clasp refuses a `rootDir` outside the folder of the project file, so the project file must live next to `dist/`. `create-script` overwrites `dist/appsscript.json`; rebuild afterwards.
2. `pnpm exec tsx scripts/init-secrets.ts prod` writes new `HMAC_SECRET` / `AUTH_SECRET` into `.local/secrets/prod.env`.
3. `pnpm --filter @zidcms/apps-script build && pnpm exec tsx scripts/gas-bootstrap.ts prod` pushes a temporary `Bootstrap.js` that sets the Script Properties and runs `setup`.
4. **Owner, in the script editor:** _Project Settings → Change project_ → the number of the Google Cloud project that holds the OAuth client (the owner is a test user there; the default Cloud project is blocked from the `drive` scope with `Error 403: access_denied`). Then run `bootstrap` and allow access.
5. If `setup` reports "Izin ditolak saat mengaktifkan API: drive": add `"projectId": "<that project number>"` to the clasp project file and run `clasp -P .clasp.prod.json enable-api drive`.
6. `pnpm exec tsx scripts/gas-bootstrap.ts prod --cleanup` removes `Bootstrap.js` (it contains the secret).
7. `clasp -P .clasp.prod.json create-deployment -d "<sha> initial"`; store the deployment id in `.local/secrets/prod-deployment-id.txt` and `GAS_WEBAPP_URL=https://script.google.com/macros/s/<id>/exec` in `prod.env`. The manifest makes it a web app executing as the owner, accessible to anyone (every request must be HMAC-signed).
8. `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm poc:gas system.setup '{}'` (completes an interrupted setup; afterwards prod setup is locked) and `… pnpm poc:gas` → all PASS, `system.health` shows `environment: prod`, `media_folder_configured: true`.

## 2. Vercel (Hobby)

- `pnpm exec tsx scripts/vercel-create-prod.ts` creates `zidcms-prod-admin` (root `apps/admin`) and `zidcms-prod-web` (root `apps/web`) linked to the repo and sets their production branch to `release` (dashboard API `PATCH /v9/projects/<name>/branch`; if it fails, set _Settings → Git → Production Branch_ manually).
- `pnpm exec tsx scripts/vercel-env-sync.ts dev|prod` pushes variables from `.local/secrets/<env>.env` without printing values: admin gets everything in `.env.example` (`ZIDCMS_ENV`, `CONTENT_ROOT=apps/web/content/<env>`, `GITHUB_BRANCH=main|release`, `VERCEL_STATUS_CONTEXT=<web project>`), web gets `SITE_URL` and `ZIDCMS_ENV`. Variable changes apply to the next deployment.
- Both `vercel.json` files skip every non-production deployment and every production deployment whose diff does not touch the app (`ignoreCommand`), so each project builds only its own branch. Skipped builds show as "Canceled by Ignored Build Step".
- `apps/web/vercel.json` sets security headers, no-cache for `zidcms-version.json`, immutable caching for `/media/*`.
- Google OAuth: one client, one redirect URI per admin domain (`https://<admin>/api/auth/callback/google`).
- Deployment budget (Hobby: 100 deployments per 24 h for the whole account, 1 concurrent build). **Deployments cancelled by the Ignored Build Step count**; Vercel's native "Skipped - Not affected" monorepo skip does not (keep _Skip deployments when there are no changes_ enabled in each project's Build and Deployment settings). Measured 2026-11-21 with four projects (before ADR-0012): of the 100 most recent deployments, 37 were Ignored-Build-Step cancellations, mostly cross-environment previews, and the limit was reached that day. Approximate cost with the two prod projects only:
  - code push to `main`: **0**;
  - prod publish (commit to `release`): 1 prod web build + at most 1 cancelled admin build = **~1–2**;
  - promotion (`main` → `release`): affected prod builds = **~1–2**;
  - `smoke:deployed` (4 publishes): **~4–8**.
    When the limit is hit, publish jobs fail with `DEPLOY_FAILED` ("Deployment rate limited — retry in 24 hours") and the live site stays unchanged. A recreated dev environment on `main` would add its own builds again (re-enable `main` in `git.deploymentEnabled`).

## 3. Promoting code to prod

1. Code is merged to `main`; CI green; the emulator-stack workflows `integration.yml` and `e2e.yml` pass on `main`. There is no staging environment (ADR-0012), so real-service behaviour is first observed on prod.
2. Merge `main` into `release` (owner approval): GitHub PR `release ← main`, or locally `git fetch && git switch release && git merge --no-edit origin/main && git push && git switch main`. `main` never changes `apps/web/content/prod/`, so the merge cannot touch prod content. Never merge `release` into `main`.
3. If Apps Script code changed, redeploy the prod script (§1).
4. `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm check:deployed` (`ZIDCMS_ENV_FILE` is required); for releases also `… pnpm smoke:deployed` (sacrificial post: publish → update → rollback → unpublish). If prod misbehaves, roll back ([operations.md](operations.md) R1) or revert the merge on `release`.

## 4. CI

`.github/workflows/ci.yml` runs on PRs and pushes to `main`/`release` (pushes that only change `apps/web/content/{dev,prod}/**` are ignored): install (frozen lockfile) → lint → typecheck → tests → build → static-output check → secret scans → audit and license reports (non-blocking). No secrets are used in CI. `integration.yml` and `e2e.yml` are `workflow_dispatch` only and run against the local emulator stack; runs against real dev services need a recreated dev environment and are done locally (see [testing.md](testing.md)).

## 5. Release checklist

See plan §27.2 and `docs/status/release-v0.1.0.md`.

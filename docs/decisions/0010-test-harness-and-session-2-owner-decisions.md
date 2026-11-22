# 0010: Integration/E2E harness and owner decisions of session 2

- **Status:** accepted (2026-11-21).

## Owner decisions (2026-11-21, session 2)

| Topic                         | Decision                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Load-test ceiling (G15)       | Default: ≤ 100 concurrent virtual users, ≤ 5 GB total load-test transfer per month                          |
| Dev secrets in GitHub Actions | **No.** `integration.yml` and `e2e.yml` run against the local emulator stack; real-service runs are local   |
| E2E sign-in on staging        | Playwright mints an Auth.js session cookie with the dev `AUTH_SECRET` (no Google UI automation)             |
| Prod environment              | Set up after the staging acceptance run passes; owner performs account-bound steps (OAuth, Vercel, consent) |

## Decision

- **Integration suite** `tests/integration/run.ts` (`pnpm test:integration [gas|data|conc|pub]`) talks signed RPC to whatever `GAS_WEBAPP_URL` the env file points at: the emulator (default `apps/admin/.env.local`) or the dev Apps Script (`ZIDCMS_ENV_FILE=.local/secrets/dev.env`). It refuses to run when `system.health` reports `environment=prod`. Test rows are soft-deleted at the end; the coalescing test closes its job as `failed`/`TEST_CLEANUP`. Results are written to the gitignored `tests/integration/results/`.
- TC-DATA-05 (manual sheet corruption) and TC-CONC-03 (held lock) cannot be produced through the RPC surface; they stay covered by contract tests and are reported as `SKIP` with a pointer.
- **E2E** `tests/e2e/demo.spec.ts` (`pnpm test:e2e`, `E2E_TARGET=local|staging`) runs the demo scenario end to end, including PoC-3 (upload → Drive → publish → `/media/<sha256>.png` served with matching hash), TC-PUB-07 (failed build keeps the old version live), TC-PUB-08 (rollback reproduces the target checksum), TC-PUB-11 (trashing removes the post and its exclusive media), TC-WEB-06 (public page requests only the site origin) and TC-AUTH-04 (sign-out).
- **Session minting on staging** uses `@auth/core/jwt#encode` with the cookie name as salt, i.e. exactly what Auth.js issues after a Google sign-in. It exercises `requireAdmin()` and the allowlist (an `intruder@example.com` cookie is redirected to `/login?error=AccessDenied` and gets 403 from the API) but not the Google `signIn` callback; that path is covered by `apps/admin/lib/security.test.ts` and one manual sign-in with a non-allowlisted Google account. Traces, screenshots and videos are disabled for staging runs because admin pages show the private admin address.
- **Build-failure switch (TC-PUB-07 on staging):** `apps/web` runs `scripts/build-guard.mjs` before `next build`; it exits 1 when `ZIDCMS_FAIL_BUILD=1`. `pnpm build-switch on|off` sets/removes that variable on the dev web project with the Vercel CLI. Code stays unbroken; only the next build fails. Locally the same scenario uses the flag file `.local/publish/deploy-fail`, which makes `LocalStore` record the commit without touching `apps/web` (as a failed Vercel build would) and report `failure`.
- Root `tsconfig.json` now typechecks `scripts/`, `tests/` and `playwright.config.ts` as part of `pnpm typecheck`.

## Consequences

- Staging E2E uses about five Vercel deployments per run (publish, update, failed build, rollback, cleanup); keep it within the deployment budget.
- New root dev dependency `@auth/core@0.41.3` (same version already resolved by `next-auth`) for cookie minting.

# 0012: Staging environment retired

- **Status:** accepted (2026-11-22, owner decision). Amends ADR-0011.

## Decision

The dev/staging environment is removed; ZidCMS runs a single hosted environment, prod.

- Deleted: Vercel projects `zidcms-admin` and `zidcms-web`; the dev Apps Script web-app deployment (the endpoint no longer answers). The dev spreadsheet with its bound script stays in the owner's Drive (unreachable, data only) and may be trashed manually. Local dev config is archived as `.local/secrets/*.retired`.
- `apps/web/content/dev/` is removed from the repository (history keeps it).
- `main` carries code only and creates **no Vercel deployments**: both `vercel.json` files enable Git deployments for `release` only. Prod publishes and promotions are the only deployments, which removes the cancelled cross-environment preview builds that exhausted the Hobby limit on 2026-11-21.
- Verification before promoting: CI plus the emulator-stack workflows (`integration.yml`, `e2e.yml`) on `main`, then `pnpm check:deployed` (and `pnpm smoke:deployed` for releases) against prod after promotion. `check:deployed`, `smoke:deployed` and the staging E2E now require an explicit `ZIDCMS_ENV_FILE`; the E2E and the benchmark/integration tools refuse prod.
- The code stays multi-environment (`ZIDCMS_ENV=dev|prod`, per-environment content folders), so a staging environment can be recreated later by following `docs/deployment.md` §1–2 with `ZIDCMS_ENV=dev`.

## Consequences

- No pre-production environment with real Google/Vercel services: real-service behaviour of a change is first observed on prod. Mitigations: the emulator stack runs the same dispatcher code; prod publish failures keep the previous version live; rollback is one click.
- Real-service integration tests (`ZIDCMS_ENV_FILE=… pnpm test:integration`) and the staging E2E need a recreated dev environment.

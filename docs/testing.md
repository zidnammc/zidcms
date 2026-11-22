# Testing

| Level         | What                                                                                        | Command                                                                       | Where it runs                                               |
| ------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Unit          | `@zidcms/core` (schema, codec, RPC, snapshot, Markdown, slugs)                              | `pnpm test`                                                                   | CI on every push/PR                                         |
| Contract      | GAS dispatcher + actions on in-memory sheets (incl. TC-DATA-05, TC-CONC-03, TC-SEC-03/05)   | `pnpm test`                                                                   | CI                                                          |
| Admin unit    | `requireAdmin`, Origin check, error mapping, RPC signing, publish orchestrator              | `pnpm test`                                                                   | CI                                                          |
| Integration   | Signed RPC against a GAS endpoint: TC-GAS-01…08, TC-DATA-01…07, TC-CONC-01/02, TC-PUB-04/05 | `pnpm test:integration [gas\|data\|conc\|pub]`                                | `integration.yml` (emulator); real dev GAS needs a dev env  |
| E2E           | Plan §24.3 demo incl. media (PoC-3), TC-PUB-07/08/11, TC-WEB-06, TC-AUTH-04                 | `pnpm test:e2e` (local stack) / `E2E_TARGET=staging pnpm test:e2e`            | `e2e.yml` (local stack); staging needs a dev env (ADR-0012) |
| Static output | TC-WEB-01/02: export only, no functions                                                     | `pnpm build && pnpm check:web`                                                | CI                                                          |
| Secret scan   | TC-SEC-07: bundles and tracked files                                                        | `pnpm scan:secrets` / `pnpm scan:secrets --repo`                              | CI                                                          |
| Smoke         | API-level happy path on the local stack                                                     | `pnpm smoke:local`                                                            | local                                                       |
| Load          | Plan §21                                                                                    | `pnpm exec tsx tests/load/public.ts`, `pnpm exec tsx tests/load/backend.ts …` | local, see [benchmarks.md](benchmarks.md)                   |

## Real services (owner machine)

Real-service runs use a private env file and are never run from CI (owner decision, ADR-0010). Since the dev/staging environment was retired on 2026-11-22 (ADR-0012) there is no dev environment to run them against: both need a recreated dev environment ([deployment.md](deployment.md) §1–2 with `ZIDCMS_ENV=dev`). Both refuse prod, and `ZIDCMS_ENV_FILE` must be set explicitly:

```bash
ZIDCMS_ENV_FILE=<dev env file> pnpm test:integration                  # dev Apps Script + dev spreadsheet
ZIDCMS_ENV_FILE=<dev env file> E2E_TARGET=staging pnpm test:e2e       # deployed dev admin + public site
```

On prod, only the non-destructive `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm check:deployed` and, for releases, `… pnpm smoke:deployed` (one sacrificial post) are run after a promotion. The real-service results from 2026-11-21 (integration suite vs. the dev Apps Script, staging E2E) remain the latest such evidence.

- The integration suite refuses to run when `system.health` reports `environment=prod`. It soft-deletes the posts it creates and closes the publish job it opens for TC-PUB-04/05 as `failed` with `TEST_CLEANUP`.
- The staging E2E signs in by minting an Auth.js session cookie with the dev `AUTH_SECRET` (ADR-0010) and refuses env files with `ZIDCMS_ENV=prod`. It creates one post with a freshly generated PNG, publishes, updates, forces one failed build (`pnpm build-switch on`, always switched off again), rolls back, and trashes the post. Expect about five Vercel deployments and 10–20 minutes. Traces and screenshots are off for staging because admin pages show the private admin address.
- Evidence files: `tests/integration/results/*.json`, `tests/e2e/results/e2e-evidence-<target>.json` (both gitignored; copy the relevant numbers into `docs/status/`).

## Local stack notes

- `pnpm test:e2e` starts the emulator, admin and web dev servers if they are not running (`reuseExistingServer`).
- Local publishing writes the gitignored build paths `apps/web/content/snapshot.json`, `apps/web/public/zidcms-version.json` and `apps/web/public/media/*`; `pnpm reset:content` returns them to the empty snapshot.
- Under `next dev` the public site answers unknown static params with HTTP 500 instead of the exported 404 page; the local E2E therefore only asserts "not 200 and not containing the title", the staging E2E asserts 404.

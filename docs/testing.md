# Testing

| Level         | What                                                                                        | Command                                                                       | Where it runs                                              |
| ------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Unit          | `@zidcms/core` (schema, codec, RPC, snapshot, Markdown, slugs)                              | `pnpm test`                                                                   | CI on every push/PR                                        |
| Contract      | GAS dispatcher + actions on in-memory sheets (incl. TC-DATA-05, TC-CONC-03, TC-SEC-03/05)   | `pnpm test`                                                                   | CI                                                         |
| Admin unit    | `requireAdmin`, Origin check, error mapping, RPC signing, publish orchestrator              | `pnpm test`                                                                   | CI                                                         |
| Integration   | Signed RPC against a GAS endpoint: TC-GAS-01…08, TC-DATA-01…07, TC-CONC-01/02, TC-PUB-04/05 | `pnpm test:integration [gas\|data\|conc\|pub]`                                | `integration.yml` (emulator); real dev Apps Script locally |
| E2E           | Plan §24.3 demo incl. media (PoC-3), TC-PUB-07/08/11, TC-WEB-06, TC-AUTH-04                 | `pnpm test:e2e` (local stack) / `E2E_TARGET=staging pnpm test:e2e`            | `e2e.yml` (local stack); staging locally                   |
| Static output | TC-WEB-01/02: export only, no functions                                                     | `pnpm build && pnpm check:web`                                                | CI                                                         |
| Secret scan   | TC-SEC-07: bundles and tracked files                                                        | `pnpm scan:secrets` / `pnpm scan:secrets --repo`                              | CI                                                         |
| Smoke         | API-level happy path on the local stack                                                     | `pnpm smoke:local`                                                            | local                                                      |
| Load          | Plan §21                                                                                    | `pnpm exec tsx tests/load/public.ts`, `pnpm exec tsx tests/load/backend.ts …` | local, see [benchmarks.md](benchmarks.md)                  |

## Real services (owner machine)

Real-service runs use the private env file and are never run from CI (owner decision, ADR-0010):

```bash
ZIDCMS_ENV_FILE=.local/secrets/dev.env pnpm test:integration   # dev Apps Script + dev spreadsheet
E2E_TARGET=staging pnpm test:e2e                                 # deployed dev admin + public site
```

- The integration suite refuses to run when `system.health` reports `environment=prod`. It soft-deletes the posts it creates and closes the publish job it opens for TC-PUB-04/05 as `failed` with `TEST_CLEANUP`.
- The staging E2E signs in by minting an Auth.js session cookie with the dev `AUTH_SECRET` (ADR-0010). It creates one post with a freshly generated PNG, publishes, updates, forces one failed build (`pnpm build-switch on`, always switched off again), rolls back, and trashes the post. Expect about five Vercel deployments and 10–20 minutes. Traces and screenshots are off for staging because admin pages show the private admin address.
- Evidence files: `tests/integration/results/*.json`, `test-results/e2e-evidence-<target>.json` (both gitignored; copy the relevant numbers into `docs/status/`).

## Local stack notes

- `pnpm test:e2e` starts the emulator, admin and web dev servers if they are not running (`reuseExistingServer`).
- Local publishing writes the gitignored build paths `apps/web/content/snapshot.json`, `apps/web/public/zidcms-version.json` and `apps/web/public/media/*`; `pnpm reset:content` returns them to the empty snapshot.
- Under `next dev` the public site answers unknown static params with HTTP 500 instead of the exported 404 page; the local E2E therefore only asserts "not 200 and not containing the title", the staging E2E asserts 404.

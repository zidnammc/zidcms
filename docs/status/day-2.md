## ZidCMS — Day 2 status (2026-11-21, session 2)

Private values (Apps Script URLs, spreadsheet/Drive/GCP/Vercel IDs, secrets, e-mail addresses) stay in the owner's gitignored files and are not recorded here. Result files under `tests/integration/results/`, `tests/e2e/results/` and `test-results/` are gitignored and stay on the owner's machine; the numbers below are copied from them.

**Blockers / approvals needed (top):**

1. **Manual sign-in with a non-allowlisted Google account** → must show "Akses ditolak". Last open check for P0 row 1 and demo step 1 (automated coverage: `apps/admin/lib/security.test.ts`, staging E2E with a minted cookie).
2. **Prod OAuth redirect URI**: add `https://zidcms-prod-admin.vercel.app/api/auth/callback/google` to the existing OAuth client. Until then Google sign-in on the prod admin fails; prod checks so far used a minted prod session cookie.
3. **Vercel usage screenshot** for the month (no private IDs). Needed for release checklist §27.2 and for the "zero function invocations" dashboard part of demo step 8.
4. **Fresh-account setup by another person** following `docs/beginner-guide.md` (§24.4).
5. **Decision:** purge the private execution plan from Git history (destructive rewrite; not done). It was removed from the tree in `87b2017`.
6. **Reminder:** renew the GitHub PAT (used by dev and prod) before 90 days from 2026-11-21.
7. Approval to promote `main` to `release` and tag `v0.1.0` as a pre-release. `release` is at `b75ffad` plus the prod content commits; `4c0691d`, `bb1b1d5`, `87b2017` and `16a4fff` are not promoted yet.

**Planned exit criteria:**

- Stage 1: integration suite against the real dev Apps Script; Playwright E2E (local stack and staging); build-failure switch for TC-PUB-07 on staging.
- Stage 2: staging acceptance (§24.3 demo on the deployed dev admin and site, `pnpm check:deployed`).
- Stage 3: benchmarks per §21; fresh-clone and fresh-account dry runs of the setup docs.
- Stage 4: prod environment, prod smoke and rollback test, `v0.1.0` release.

**Met?** partially. Stages 1 and 2 are met. Prod is set up and its rollback is tested. Still open:

- the manual non-allowlisted Google sign-in;
- the 500-item publish benchmark and the bench cleanup (still running when this file was written);
- the fresh-account cloud setup by another person;
- the Vercel usage screenshot and the prod OAuth redirect URI;
- promotion of the latest `main` commits to `release` and the `v0.1.0` tag.

**Completed (with evidence):**

- Integration harness, Playwright E2E and build-failure switch: `b419c6c` (ADR-0010). Emulator-stack workflows are green: `integration.yml` run 44925349688 and `e2e.yml` run 44925353661.
- Deployed checks, write-trail and P0-5 coverage, load-test tools: `744eae4`.
- Integration suite vs real dev Apps Script: **16 passed, 0 failed, 2 skipped** (`tests/integration/results/2026-11-21T17-08-20-674Z-apps-script.json`, see "Test case coverage").
- Staging E2E run 2: **PASS in 8.8 min** (2026-11-21 16:58:55Z → 17:07:45Z). The run covered every §24.3 demo step plus PoC-3 media and the P0-5 errors (jobs below). Run 1 used an earlier version of the test and also passed in 7.3 min: publish v2, update v3, failed build v4 (v3 stayed live), rollback v5 (= v2), cleanup v6.

  | Step      | Job                                    | States                                             | Version | Commit    | Time | Live after                        |
  | --------- | -------------------------------------- | -------------------------------------------------- | ------- | --------- | ---: | --------------------------------- |
  | publish   | `df5d7823-bb21-4a39-b996-d26b08d051e5` | queued → committing → deploying → verifying → live | v7      | `65a45d4` | 75 s | v7 `sha256:027ef87c33b2…`         |
  | update    | `5e05b9bb-ff37-4b3b-b54b-f619ae585ea8` | collecting → deploying → verifying → live          | v8      | `ed6a536` | 66 s | v8 `sha256:d0fd0ac93cf5…`         |
  | failed    | `8148aaa7-4227-4053-aaa2-8fe2a554ef78` | collecting → deploying → failed (`DEPLOY_FAILED`)  | v9      | `bba6ae3` | 51 s | **v8 stayed live**                |
  | rollback  | `54367da1-5184-414c-852b-4d86ff634dad` | queued → collecting → deploying → verifying → live | v10     | `43fab6d` | 60 s | v10 `sha256:027ef87c33b2…` (= v7) |
  | unpublish | `b8c5ceae-b1ff-4470-8398-ecb70473a695` | collecting → committing → deploying → live         | v11     | `110f66e` | 79 s | v11; post and exclusive media 404 |

  Public request hosts: `zidcms-web.vercel.app` only. The uploaded PNG on `/media/<sha256>.png` matched sha256 `532292c9…3d94`.

- Local E2E: PASS (`tests/e2e/results/e2e-evidence-local.json`). Publish v13 (51 s), update v14, simulated failed build v15 (`DEPLOY_FAILED`, v14 stayed live), rollback v16 (checksum = v13), unpublish v17. The public page requested only `localhost:3001`. The same test also runs in CI `e2e.yml`.
- Per-environment content folders, prod on `release`, exact Vercel status match: `6bf4f62` (ADR-0011).
- Legacy-layout rollback on dev: rolled back to v10, which was committed before the ADR-0011 layout change and has media. Result: v13 (`d1abf8f`, job `3d1824a1-dd25-42bb-ae21-674eca2f3205`) was written to `apps/web/content/dev/`, the media was reused, and the image is served with a matching sha256.
- Prod environment: bootstrap tooling and empty prod snapshot `1fe772f`; re-runnable interrupted setup `b75ffad`.
  - PoC-1 TC-GAS-01…08 all PASS against prod; `system.health` reports `environment=prod`.
  - Install lessons are recorded in `docs/deployment.md` §1: `.clasp.prod.json` next to `dist/`; the script had to be linked to the Cloud project of the OAuth client; the Drive API was enabled via `clasp enable-api drive`.
- Prod smoke and rollback test with a sacrificial post (`tests/e2e/results/smoke-zidcms-prod-web.vercel.app.json`). Health reported admin PROD, target github, GAS prod. Commits landed on `release` only.

  | Step      | Job                                    | Version | Commit    | Time | Live after                |
  | --------- | -------------------------------------- | ------- | --------- | ---: | ------------------------- |
  | publish   | `f1811c5e-1fab-4b4b-a6a5-7711a34afebb` | v1      | `ad3199b` | 87 s | `sha256:f4bba9d4…`        |
  | update    | `e0243147-1871-4df6-9c8d-6931448c268e` | v2      | `ecb3d3b` | 86 s | `sha256:de4aaa09…`        |
  | rollback  | `de927fde-bfd8-4542-8ae7-b7c84815f1fa` | v3      | `f7e7f65` | 79 s | `sha256:f4bba9d4…` (= v1) |
  | unpublish | `b9db1a68-7a40-4e31-832f-6e36cc0e6cbf` | v4      | `6cfa164` | 78 s | `sha256:310447d5…`        |

- `pnpm check:deployed` PASS on dev and on prod:
  - all 35 API routes return 401 without a session, with no stack traces; a foreign Origin gets 403;
  - admin headers: X-Frame-Options DENY, X-Robots-Tag noindex, CSP, HSTS; web headers: CSP, nosniff, Referrer-Policy, HSTS;
  - unknown slug → 404; robots.txt OK; sitemap = snapshot; canonical/OG metadata correct;
  - the snapshot has no actor fields and no e-mail addresses;
  - the current production web deployment has 0 function outputs (the admin has 4).
- Public site latency sampling (instead of a load test, see Decisions), `tests/load/results/public-cdn-2026-11-21T17-48-20-960Z.json`: 1 VU, 500 ms pacing, 120 s. Result: 203 requests, p50 77 ms, p95 131 ms, p99 327 ms, 0 errors, 100 % `x-vercel-cache` HIT, all from edge POP `sin1`, 0.6 MiB transferred.
- Backend benchmark on the dev spreadsheet (`tests/load/results/backend-*.json`, write-up in `docs/benchmarks.md`):
  - Latency at 50/100/250/550 Posts rows. `system.health` p50 is about 11 s at every size; the other RPCs have p50 2–5 s, and the highest p95 is `posts.list` at 8.0 s with 550 rows.
  - Contention with N writers on N posts: 2 → 2 ok; 5 → 5 ok; 10 → 4 ok and 6 `LOCK_TIMEOUT`.
  - Publish end-to-end: 10 items took 91 s (job `25410645-1efa-45de-93af-cff719f191c2`, v15, `c090bb0`, snapshot 26 KB, Vercel build 27 s). 100 items took 78 s (job `6fa2bca7-13d1-4e39-b41b-ff9816952a0a`, v16, `5682b2e`, 231 KB, build 16 s).
  - The 500-item publish and the cleanup are pending.
- Fresh-clone local dry run: followed `docs/setup.md` §1 verbatim in a temp directory. Install took 28 s, then `init:local`, `dev:gas`/`dev:web`/`dev:admin`, seed, and `smoke:local` → SMOKE OK.
- License report (`pnpm -r licenses list --prod`): MIT 104, ISC 6, Apache-2.0 2, BSD-3-Clause 1, 0BSD 1, CC-BY-4.0 1 (caniuse-lite data). The only LGPL item, sharp's libvips (optional and unused), was dropped via `ignoredOptionalDependencies` in `4c0691d`.
- Docs:
  - prod deployment procedure and `ZIDCMS_ENV` guide fixes: `bb1b1d5`;
  - English beginner guide (`docs/beginner-guide.md`) and private execution plan removed from the tree: `87b2017`;
  - evidence files moved outside Playwright's output directory: `16a4fff`.
- Bugs found and fixed:
  - Dev-login rejection raised a server error instead of "Akses ditolak", because Auth.js v5 throws `CredentialsSignin` from `signIn` (`b419c6c`).
  - An integration test assumed coalesced publish keys are stored. Only the key that creates a job is idempotent, so the test was fixed.
  - Dev and prod content on the same path would let a code promotion overwrite prod content. Fixed with per-environment folders (`6bf4f62`).
  - Vercel status matching used a substring and could pick another project's status. It now requires an exact project match (`6bf4f62`).
  - Prod setup locked itself after a partial first run. Now `installed_at` is written last and the lock requires the media folder (`b75ffad`).
  - The beginner guide did not set `ZIDCMS_ENV` for the web project, so builds would fail (`bb1b1d5`).
  - Biome reformatted raw load-test JSON. The results are now excluded from the formatter (`07ef05e`).

**Acceptance — §24.1 Functional (P0):**

| #   | Criterion                                                                              | Status    | Evidence                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Allowlisted admin signs in/out; others rejected                                        | partially | The owner signed in with Google on the dev admin (day-0 PoC-2). Staging E2E step 1: a non-allowlisted minted cookie is sent to `/login?error=AccessDenied` ("Akses ditolak") and gets API 403. Sign-out → 401 (TC-AUTH-04). Allowlist `signIn` callback is unit-tested (`security.test.ts`). **Pending:** manual non-allowlisted Google sign-in. |
| 2   | Unauthenticated/unauthorized callers cannot read drafts or mutate                      | met       | `check:deployed` dev and prod: 35/35 API routes → 401, foreign Origin → 403, no stack traces. Admin media preview without a session → 401 (E2E step 2). TC-GAS-02…08 PASS against real dev and prod Apps Script.                                                                                                                                 |
| 3   | Create, edit, list, search, preview, publish, unpublish, archive, soft-delete, restore | met       | E2E (UI, staging): create, edit, preview, publish v7, update v8, unpublish v11, trash. Integration (real GAS, RPC level): list/search with `q`, soft delete + restore (TC-DATA-07), status lifecycle published → archived → draft (P0-4 trail). Archive and restore are not clicked through the UI in an automated test.                         |
| 4   | Each write: UUID, UTC timestamps, version +1, revision row, audit row                  | met       | Integration "P0-4 write trail" PASS (real dev GAS): 7 writes → v7, 7 revisions, 7 audit rows, UUID v4, ISO UTC timestamps.                                                                                                                                                                                                                       |
| 5   | Duplicate/reserved slug and stale version give specific UI errors                      | met       | Staging E2E step 2b: duplicate slug → "sudah dipakai"; page slug `blog` → "dicadangkan oleh rute situs publik"; stale version → conflict dialog. TC-CONC-02 on real GAS → `SLUG_CONFLICT`.                                                                                                                                                       |
| 6   | Post page: title, sanitized content, canonical, SEO + OG; unknown slug → 404           | met       | `check:deployed` dev and prod: TC-WEB-03 canonical/OG/description, TC-WEB-05 unknown slug → 404. TC-SEC-01 XSS corpus (`packages/core/src/snapshot.test.ts`). Staging E2E asserts 404 after unpublish.                                                                                                                                           |
| 7   | Update + republish changes page and `zidcms-version.json`                              | met       | Staging E2E update v8: version file = job snapshot version, page shows the new text. Prod smoke update v2.                                                                                                                                                                                                                                       |
| 8   | Parallel publish requests → one active job; duplicates coalesce                        | met       | TC-PUB-04/05 PASS on real dev GAS (one job, `rerun_requested`; the same key returns the same job). TC-PUB-04 coalesced follow-up job (`orchestrator.test.ts`).                                                                                                                                                                                   |
| 9   | Failed publish leaves previous version live and offers retry                           | met       | Staging E2E 7a: job `8148aaa7…` v9 `DEPLOY_FAILED` via `ZIDCMS_FAIL_BUILD`, live stayed v8 (same checksum), error shown on `/publish`. Retry is the publish button, which stays enabled once the job has failed. The E2E checks that the error is shown but does not click retry. Transient GitHub errors are retried 3× (unit test).            |
| 10  | Rollback restores an earlier snapshot as a new version                                 | met       | Staging rollback v10 has the checksum of v7. Prod rollback v3 has the checksum of v1. Legacy-layout rollback on dev → v13 with media reused. Unit test TC-PUB-08.                                                                                                                                                                                |
| 11  | Snapshot: only allowlisted fields of published, non-deleted items + public settings    | met       | TC-SEC-06 key-set test and TC-PUB-01 (draft never in snapshot) in `snapshot.test.ts`. `check:deployed` finds no actor fields or e-mails in the live dev and prod snapshots. E2E step 3: draft absent from the public site.                                                                                                                       |

**Acceptance — §24.2 Functional (P1, shipped):**

| #   | Criterion                                                                 | Status    | Evidence                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Pages at top-level routes, in navigation by `nav_order`                   | partially | `/tentang/` is served at top level (203/203 HTTP 200 in CDN sampling across paths). Page URLs are in the sitemap (TC-WEB-04). Reserved-slug guard is tested in E2E. Navigation order by `nav_order` has no automated assertion yet.                                                                                     |
| 13  | Categories/tags assignable and listed on archive pages                    | partially | Snapshot category/tag mapping is unit-tested. Category and tag archive URLs are in the live sitemap (TC-WEB-04, `check:deployed`). No automated test checks archive page contents on staging.                                                                                                                           |
| 14  | Media upload enforces type/size; images served from Vercel; Drive private | met       | TC-SEC-03 contract test: type, size and magic bytes enforced; SVG rejected. PoC-3 on staging: PNG upload → Drive → publish → `/media/<sha256>.png` on `zidcms-web.vercel.app` with matching sha256. Admin media preview without a session → 401. Drive privacy is by design (ADR-0004) and was not probed from outside. |

**Acceptance — §24.3 Demo scenario (TC-E2E-01, staging E2E run 2):**

| #   | Step                                                                | Status    | Evidence                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Log in; show non-allowlisted rejection                              | partially | Minted-cookie intruder → `AccessDenied` + 403, admin signs in (minted cookie, ADR-0010). Manual Google rejection pending (owner).                                                              |
| 2   | Create and save a draft                                             | met       | Draft saved with an uploaded PNG; upload sha256 matches.                                                                                                                                       |
| 3   | Preview; absent from public site                                    | met       | Preview renders; the public URL is not served before publishing.                                                                                                                               |
| 4   | Publish; job states to `live`                                       | met       | Job `df5d7823…` queued → committing → deploying → verifying → live, v7, 75 s.                                                                                                                  |
| 5   | Public URL; `zidcms-version.json`                                   | met       | Post and image on `zidcms-web.vercel.app`; version file v7 `sha256:027ef87c33b2…`.                                                                                                             |
| 6   | Edit, Update, new content after `live`                              | met       | Job `5e05b9bb…` v8, 66 s; page shows the new text.                                                                                                                                             |
| 7   | Failed build keeps previous version; roll back                      | met       | Job `8148aaa7…` v9 `DEPLOY_FAILED`, v8 still served; rollback job `54367da1…` v10 = v7 checksum, 60 s.                                                                                         |
| 8   | Network evidence: only Vercel domain; zero web function invocations | partially | Public page requested only `zidcms-web.vercel.app` (TC-WEB-06). The web deployment has 0 function outputs (`check:deployed`, `check:web`). The Vercel dashboard screenshot is pending (owner). |

**Acceptance — §24.4 Engineering:**

| Criterion                                                                         | Status    | Evidence                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web` build output has zero functions (TC-WEB-02)                            | met       | `pnpm check:web` in CI (latest run 44937929097 on `87b2017`). `check:deployed`: current dev and prod web deployments have 0 function outputs.                                                                                                                                                                              |
| Bundle secret scan passes for both apps (TC-SEC-07)                               | met       | `pnpm scan:secrets` in CI. `pnpm scan:secrets --repo` clean on every commit.                                                                                                                                                                                                                                               |
| All §18.1 test levels executed with recorded output                               | partially | Unit, contract and admin unit tests run in CI. Integration ran against real dev GAS. E2E ran locally, in CI and on staging. Security checks ran in CI, integration and `check:deployed`. Load: the public CDN got 1-VU sampling only (Vercel policy) and the backend run is missing the 500-item publish.                  |
| TC-CONC-01/02 and TC-PUB-04 pass                                                  | met       | Real dev GAS: TC-CONC-01 10 parallel updates → 1 ok + 9 `VERSION_CONFLICT` (p50 8.8 s, max 13.5 s). TC-CONC-02 5 creates on the same slug → 1 ok + 4 `SLUG_CONFLICT`. TC-PUB-04/05 PASS.                                                                                                                                   |
| Benchmark report complete per §21                                                 | partially | `docs/benchmarks.md` covers latency vs rows, contention, seed, publish at 10/100 items and public 1-VU sampling. Missing: publish at 500 items. The 1/10/50/100-VU CDN levels were replaced by sampling (Vercel allows load tests only on Enterprise). Dashboard confirmation of zero functions is pending the screenshot. |
| Fresh-account setup reproduced from docs                                          | pending   | Fresh-clone local dry run passed (SMOKE OK). Cloud setup on a fresh account by another person is not done.                                                                                                                                                                                                                 |
| Deployment steps and owner approvals documented                                   | met       | `docs/deployment.md` (incl. first-time prod install), `docs/setup.md`, `docs/beginner-guide.md`, ADR-0010, ADR-0011, `docs/status/day-0.md`.                                                                                                                                                                               |
| README, architecture, API, security, operations, limitations, benchmarks, license | met       | `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/security.md`, `docs/operations.md`, `docs/limitations.md`, `docs/benchmarks.md`, `LICENSE`, `NOTICE`.                                                                                                                                                            |

**Test case coverage (§18.2):**

| Group | Cases                                                                                   | Where covered                                                                                                                                                                              | Result                                                            |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| AUTH  | 01 allowlisted sign-in · 02 rejection · 03 401 matrix · 04 sign-out · 05 foreign Origin | Unit `security.test.ts` (02, 03, 05); staging/local E2E (01 via minted cookie / dev login, 02, 04); `check:deployed` dev + prod (03, 05); manual Google sign-in by the owner on day 0 (01) | PASS; manual non-allowlisted Google sign-in (02) pending          |
| GAS   | 01–08                                                                                   | Unit `rpc.test.ts`; contract `dispatcher.test.ts` (08); integration vs real dev GAS; PoC-1 vs real prod GAS                                                                                | PASS (all 8 on dev and prod)                                      |
| DATA  | 01–07                                                                                   | Unit/contract; integration vs real dev GAS (01/02/03, 04 at the implemented 40,000-char limit, 06, 07); 05 contract only (cannot be produced over RPC)                                     | PASS; 05 SKIP in integration, PASS in contract                    |
| CONC  | 01–03                                                                                   | Contract (01–03); integration vs real dev GAS (01, 02); 03 contract only. Real `LOCK_TIMEOUT`s also appeared in the 10-writer benchmark                                                    | PASS; 03 SKIP in integration, PASS in contract                    |
| PUB   | 01–11                                                                                   | Unit `snapshot.test.ts` (01, 10), `orchestrator.test.ts` (02, 03/06, 04, 07, 08, 09, 10); integration real GAS (04/05); staging E2E (02, 03, 07, 08, 11); prod smoke (02, 03, 08, 11)      | PASS                                                              |
| SEC   | 01–07                                                                                   | Unit `snapshot.test.ts` (01, 06), `core.test.ts` (04); contract (03, 05); `check:deployed` dev + prod (02, 05, 06); CI `scan:secrets` (07)                                                 | PASS                                                              |
| WEB   | 01–06                                                                                   | Unit (01); CI `check:web` (01, 02); `check:deployed` dev + prod (02, 03, 04, 05); staging/local E2E (05, 06)                                                                               | PASS                                                              |
| E2E   | 01 full demo §24.3                                                                      | `tests/e2e/demo.spec.ts`: local stack, CI `e2e.yml` run 44925353661, staging (run 2, 8.8 min)                                                                                              | PASS (step 1 manual part and step 8 dashboard part pending owner) |

**Tests run:**

- `pnpm test` (working tree, 2026-11-21) → core 73, apps-script 25, admin 76 passed.
- CI `ci.yml` run 44937929097 on `87b2017` → green (lint, typecheck, tests, build, `check:web`, secret scans, audit/license reports). All recent runs are green.
- `integration.yml` run 44925349688 and `e2e.yml` run 44925353661 (emulator stack, `b419c6c`) → green.
- `ZIDCMS_ENV_FILE=… pnpm test:integration` (real dev Apps Script) → 16 passed, 0 failed, 2 skipped.
- `E2E_TARGET=staging pnpm test:e2e` → PASS (8.8 min; run 1 PASS 7.3 min). `pnpm test:e2e` (local) → PASS.
- `pnpm check:deployed` (dev and prod) → PASS.
- `ZIDCMS_ENV_FILE=… pnpm poc:gas` (prod) → TC-GAS-01…08 PASS, `environment=prod`.
- `pnpm smoke:deployed` (prod) → publish v1, update v2, rollback v3 (= v1), unpublish v4.
- `pnpm exec tsx tests/load/public.ts` (1 VU) → p50 77 ms, p95 131 ms, 0 errors, 100 % HIT.
- `pnpm exec tsx tests/load/backend.ts latency|seed|contention|publish` → results above; publish 500 pending.
- Fresh clone, `docs/setup.md` §1 → `pnpm smoke:local` SMOKE OK.
- `pnpm scan:secrets --repo` → clean on every commit. `pnpm -r licenses list --prod` → no incompatible licenses.

**Decisions:**

- [ADR-0010](../decisions/0010-test-harness-and-session-2-owner-decisions.md):
  - Integration and E2E harness.
  - No dev secrets in GitHub Actions; `integration.yml` and `e2e.yml` run on the emulator stack, and real-service runs are local.
  - Staging E2E signs in with a minted Auth.js session cookie.
  - `ZIDCMS_FAIL_BUILD` build-failure switch.
  - Load-test ceiling of ≤ 100 VU and ≤ 5 GB/month.
- [ADR-0011](../decisions/0011-environment-topology.md): per-environment content folders (`apps/web/content/dev|prod/`); prod builds from branch `release`; promotion = merge `main` into `release`; exact Vercel status context match.
- Owner decisions:
  - **Vercel load-testing policy:** load tests are allowed only on Enterprise. Because of this, no CDN load test was run and `tests/load/public.ts` refuses more than 1 VU or pacing under 250 ms against Vercel.
  - **Prod setup:** done after staging passed. Prod uses Vercel projects `zidcms-prod-admin` / `zidcms-prod-web`, reuses the dev GitHub PAT and the same OAuth client (with its own redirect URI), and runs smoke/rollback with a prod session cookie.
  - **README Poke acknowledgment wording confirmed:** "ZidCMS was developed during a seven-day sprint using Devin AI Max access provided by Poke."
  - **Docs:** beginner guide translated to English; private execution plan removed from the tree.
  - **Project status:** early stage. `v0.1.0` will be a GitHub pre-release; the project remains a non-commercial experiment and not a WordPress replacement.

**Risks changed:**

- **New — Apps Script write contention:** at 10 simultaneous writers on different posts, 6 of 10 got `LOCK_TIMEOUT` (10 s lock wait). That error is retryable and surfaced, but multi-author bursts are limited.
- **New — `system.health` is slow:** it takes about 11 s p50 at every sheet size, above the 10 s mark in §21. It is a diagnostic call, not on the editing path. Every other RPC stayed under 10 s p95 up to 550 Posts rows.
- **Reduced — content overwrite on promotion:** removed by ADR-0011.
- **Reduced — wrong Vercel status:** fixed with exact project matching.
- **Reduced — partial prod setup locking itself:** fixed in `b75ffad`.
- **New — public capacity untested:** CDN capacity under concurrency is not measured (Vercel policy). The "3,000 simultaneous visitors" figure stays an untested hypothesis.
- **New — shared credentials:** dev and prod share one GitHub PAT, which needs renewal within 90 days, and one OAuth client. A leaked PAT affects both environments (runbook R7).
- **Open — history:** the private execution plan is still in old Git history until the owner decides on a purge.

**Scope cuts applied:** none. P1 (pages, taxonomy, media, read-only revisions) shipped. The public 1/10/50/100-VU load test was replaced by 1-VU latency sampling because of Vercel's policy, not as a scope cut.

**Plan for next session:**

1. Finish the 500-item publish benchmark and the bench cleanup, then update `docs/benchmarks.md` and §24.4.
2. Owner items: manual non-allowlisted Google sign-in, prod OAuth redirect URI (then a Google sign-in on the prod admin), Vercel usage screenshot, history-purge decision.
3. Promote `main` to `release` after approval, redeploy the prod script if needed, then run prod `check:deployed` and smoke again.
4. Re-run staging integration and E2E within 24 h of the release commit, confirm CI is green, and tag `v0.1.0` as a pre-release.
5. Optional hardening: automated assertions for `nav_order` navigation and category/tag archive contents; a UI-level archive/restore step in the E2E.
6. Fresh-account setup by another person following `docs/beginner-guide.md`; record the result.

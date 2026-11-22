# Benchmarks

**Status:** measured on 2026-11-21 against the **dev** environment. Raw output is committed in `tests/load/results/`. Every number below comes from a single run from one location. These are observations, not guarantees.

Scope: the public site, the admin/Apps Script backend, and publishing end-to-end.

## Environment and method

| Item    | Value                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| Tester  | Owner laptop, residential connection, Windows (win32 10.0.26220, 2 CPUs), Node v26.13.1    |
| Backend | Google Apps Script web app on a consumer Google account, bound to the dev spreadsheet      |
| Hosting | Vercel Hobby: dev admin (`zidcms-admin`), dev site (`zidcms-web`, branch `main`)           |
| Git     | GitHub (public repo); the publisher commits `apps/web/content/dev/snapshot.json` to `main` |
| Scripts | `tests/load/backend.ts` (admin/Apps Script), `tests/load/public.ts` (public site)          |

How each measurement works:

- **Latency** (`backend.ts latency`): signed RPCs sent directly to Apps Script, **10 sequential samples per action**, one action at a time. `posts.get`, `posts.update` and `editor.context` target a single draft bench post. `posts.update` changes only the excerpt and uses the returned version for the next sample. Row counts come from `system.health` at the start of the run.
- **Seed** (`backend.ts seed --to N`): creates "Bench NNNN" posts (about 2 KB of Markdown each) until N bench posts exist. Runs with **concurrency 3**.
- **Contention** (`backend.ts contention`): **N writers update N different posts at the same time** (N = 2, 5, 10). Each writer sends one `posts.update` with a fresh `expected_version`. Writes are serialized by the Apps Script script lock, which waits up to **10 s** (`tryLock(10_000)` in `services/apps-script/src/gas/adapters.ts`) and then returns `LOCK_TIMEOUT`.
- **Publish** (`backend.ts publish --items N`): sets exactly N bench posts to `published` via RPC (concurrency 3). It then sends `POST /api/publish` to the **deployed dev admin** and polls `GET /api/publish/{job}` (3 s pause between polls) until the job reaches `live` or `failed`. Total time starts when the POST returns. State durations are the gaps between the first polls that observed each state, so their resolution is the poll interval. Snapshot size is the GitHub `contents` size of `snapshot.json` at the publish commit. Vercel build seconds run from the first to the final `zidcms-web` commit status on that commit.
- **Public site** (`public.ts`): closed-loop HTTP GETs with keep-alive. The script records latency, status, `x-vercel-cache`, edge POP (from `x-vercel-id`) and bytes, and enforces a monthly transfer budget.

## Public site

### No load test, by policy

The intended CDN test used 1/10/50/100 virtual users, and the owner approved a ceiling of ≤ 100 VU and ≤ 5 GB/month (ADR-0010). Vercel's [load-testing policy](https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments) (last updated 2026-11-18) permits load testing only on **Enterprise** plans. It says unannounced tests breach fair use and can get the source IPs blocked. ZidCMS runs on Hobby, so **no 1/10/50/100-VU CDN test was run**. `tests/load/public.ts` refuses more than 1 VU, or pacing under 250 ms, against any non-`http://` (Vercel) URL.

### Latency sampling (1 VU)

`public-cdn-2026-11-21T17-48-20-960Z.json`: `https://zidcms-web.vercel.app`, 1 VU, 500 ms pause between requests, 5 s warm-up, then 120 s of measurement.

| Path                             | Requests | p50 (ms) | p95 (ms) |
| -------------------------------- | -------: | -------: | -------: |
| `/`                              |       51 |       78 |      140 |
| `/blog/menulis-dengan-markdown/` |       51 |       78 |       96 |
| `/tentang/`                      |       51 |       75 |      127 |
| `/zidcms-version.json`           |       50 |       77 |      183 |
| **All**                          |  **203** |   **77** |  **131** |

- p99 327 ms, max 493 ms, 1.7 requests/s, error rate 0 % (203 × HTTP 200).
- `x-vercel-cache`: **HIT for 203/203 (100 %)**. Edge POP: `sin1` for all requests.
- Transfer: 560,808 B measured plus warm-up, 579,666 B total (**0.6 MiB**).

These numbers describe the latency of one reader from one residential connection to a warm CDN edge. They say nothing about throughput under concurrency.

### What this does and does not show

- The "3,000 simultaneous visitors" figure from the pitch is an **untested hypothesis**. No concurrency level above 1 was measured on Vercel, and nothing here supports an extrapolation.
- The current production deployment of the web project has **0 function outputs** (verified by `pnpm check:deployed`; the admin has 4). Reader traffic is served as static files and never reaches the admin, Apps Script or Google Sheets. Backend limits below therefore do not apply to readers.

## Admin / Apps Script

### Single-call latency vs. Posts rows

Posts rows were measured at **50, 100, 250 and 550**. The sheet always held about 50 non-bench rows from earlier tests (many trashed). The Revisions and AuditLog sheets grew with every write. All values are in seconds, with 0 errors in all runs.

| Sheet rows (Posts / Revisions / AuditLog / all sheets) | 50 / 122 / 281 / 500 | 100 / 182 / 341 / 670 | 250 / 363 / 530 / 1,192 | 550 / 763 / 938 / 2,302 |
| ------------------------------------------------------ | -------------------: | --------------------: | ----------------------: | ----------------------: |
| `system.health` p50 / p95                              |          11.2 / 14.7 |           11.2 / 13.0 |             11.6 / 17.1 |             11.1 / 14.9 |
| `posts.list` (limit 20) p50 / p95                      |            2.1 / 3.5 |             2.3 / 3.0 |               2.3 / 2.8 |               2.4 / 8.0 |
| `posts.list` (limit 50, `q`) p50 / p95                 |            2.0 / 2.4 |             2.4 / 2.9 |               2.4 / 4.7 |               2.3 / 3.3 |
| `posts.get` p50 / p95                                  |            2.1 / 3.4 |             2.2 / 3.0 |               2.5 / 4.3 |               2.2 / 3.1 |
| `posts.update` p50 / p95                               |            4.1 / 5.8 |             4.2 / 6.1 |               4.3 / 6.0 |               5.3 / 6.3 |
| `publish.readPublished` p50 / p95                      |            3.4 / 4.3 |             4.0 / 5.5 |               4.7 / 7.7 |               4.8 / 6.8 |
| `editor.context` p50 / p95                             |            4.2 / 5.2 |             3.9 / 6.2 |               5.1 / 7.0 |               4.9 / 6.1 |

Raw: `backend-2026-11-21T17-51-08-932Z-latency.json`, `…T17-59-45-276Z-latency.json`, `…T18-17-09-245Z-latency.json`, `…T18-46-55-137Z-latency.json`. With 10 samples, p95 equals the maximum.

`system.health` loads and validates every sheet (11 sheets, about 500–2,300 rows in total). Its p50 is about 11 s at every size and shows no clear trend in this range. It is a diagnostic call, not part of the editing path.

### Seed (create latency, concurrency 3)

| Run                  | Created | Wall time | Throughput   | Create p50 |    p95 |    Max | Errors |
| -------------------- | ------: | --------: | ------------ | ---------: | -----: | -----: | -----: |
| to 50 (Posts → 100)  |      49 |     160 s | 0.31 posts/s |      9.3 s | 11.8 s | 12.4 s |      0 |
| to 200 (Posts → 250) |     150 |     472 s | 0.32 posts/s |      9.3 s | 11.8 s | 12.9 s |      0 |
| to 500 (Posts → 550) |     300 |   1,003 s | 0.30 posts/s |      9.9 s | 12.7 s | 21.0 s |      0 |

With 3 concurrent writers, each create waits for the other two under the script lock. Throughput stays at about one create every 3.3 s regardless of sheet size.

### Write contention (N writers, N different posts)

`backend-2026-11-21T18-05-24-282Z-contention.json` (Posts ≈ 100 rows):

| Writers | Success | `LOCK_TIMEOUT` | Other errors | Latency p50 | Latency max | Wall time |
| ------: | ------: | -------------: | -----------: | ----------: | ----------: | --------: |
|       2 |       2 |              0 |            0 |       4.0 s |       6.6 s |     6.6 s |
|       5 |       5 |              0 |            0 |       7.7 s |      12.6 s |    12.6 s |
|      10 |       4 |              6 |            0 |      11.6 s |      14.5 s |    14.5 s |

The script lock waits 10 s. At 10 simultaneous writers, 4 writes completed inside that window and the other 6 returned the retryable `LOCK_TIMEOUT`.

### Same post, parallel writers (TC-CONC-01, integration suite)

Taken from `tests/integration/results/2026-11-21T17-08-20-674Z-apps-script.json` against real dev Apps Script:

- 10 parallel updates of the **same** post with the same `expected_version`: 1 success and 9 `VERSION_CONFLICT`. Latency p50 8.8 s, max 13.5 s.
- TC-CONC-02: 5 parallel creates with the same slug gave 1 success and 4 `SLUG_CONFLICT`.

## Publish end-to-end

| Items |                          Total (POST → `live`) | Before first poll | Collecting | Committing |             Deploying | Verifying |      Snapshot bytes | Vercel build | Job / commit                                               |
| ----: | ---------------------------------------------: | ----------------: | ---------: | ---------: | --------------------: | --------: | ------------------: | -----------: | ---------------------------------------------------------- |
|    10 |                                           91 s |            12.9 s |     16.1 s |     20.2 s |                27.9 s |    14.2 s |      26,266 (26 KB) |         27 s | job `25410645-1efa-45de-93af-cff719f191c2`, v15, `c090bb0` |
|   100 |                                           78 s |             8.7 s |     14.5 s |     19.6 s |                21.2 s |    13.9 s |    231,108 (231 KB) |         16 s | job `6fa2bca7-13d1-4e39-b41b-ff9816952a0a`, v16, `5682b2e` |
|   500 | failed after 71 s (`DEPLOY_FAILED`, see below) |             9.5 s |     21.4 s |     25.2 s | 15.3 s (rate limited) |   not run | 1,143,050 (1.14 MB) |    not built | job `061db927-60b2-45a9-9e2b-71a9df96631f`, v17, `a70017f` |

Raw: `backend-2026-11-21T18-06-25-418Z-publish.json` (Posts ≈ 100 rows) and `…T18-23-36-064Z-publish.json` (Posts ≈ 250 rows). Both jobs ended `live` with no error. "Before first poll" is the time from the POST response to the first status response, which already showed `collecting`. `publish.readPublished` just before each publish took 4.3 s (10 items) and 5.3 s p50 (100 items).

- The snapshot grows by about 2.3 KB per post with the bench bodies (26 KB → 231 KB for +90 posts).
- The 100-item publish finished faster than the 10-item one. The difference comes from Apps Script and Vercel build variance, not item count. With one run per size, the trend is not significant.

### Other publish data points (real services)

| Source                        | Operation                    | Duration |
| ----------------------------- | ---------------------------- | -------: |
| Staging E2E (dev)             | publish v7                   |     75 s |
| Staging E2E (dev)             | update v8                    |     66 s |
| Staging E2E (dev)             | rollback v10 (checksum = v7) |     60 s |
| Prod smoke (sacrificial post) | publish v1                   |     87 s |
| Prod smoke                    | update v2                    |     86 s |
| Prod smoke                    | rollback v3 (checksum = v1)  |     79 s |
| Prod smoke                    | unpublish v4                 |     78 s |

### 500 items and the Vercel deployment limit

Raw: `backend-2026-11-21T18-53-34-672Z-publish.json` (Posts ≈ 550 rows). Switching 400 bench posts to `published` over RPC took several minutes (concurrency 3). `publish.readPublished` returned 500 posts in 6.0 s p50 (14.1 s max). Collecting (21 s) and committing the 1.14 MB snapshot (25 s) worked; then Vercel refused the build because the deployment rate limit was reached (retry in 24 hours), and the job ended `failed` / `DEPLOY_FAILED` with the previous version (v16) still live. The failure path behaved as designed.

The account had reached the Vercel Hobby limit of 100 deployments per 24 h (`api-deployments-free-per-day`, HTTP 402). Among the 100 most recent deployments listed by the Vercel API (all from the preceding ~4 h): 32 `READY`, 3 `ERROR`, **37 cancelled by the Ignored Build Step** (these count toward the limit, see [Vercel KB](https://vercel.com/kb/guide/why-aren-t-commits-triggering-deployments-on-vercel)), and 28 native "not affected" monorepo skips, which no longer count since Vercel's [2026-10-21 change](https://vercel.com/changelog/skipped-monorepo-deployments-no-longer-count-against-limits). Most Ignored-Build-Step cancellations are preview builds of the other environment's branch (prod projects building `main`, dev projects building `release`). See the deployment budget in [deployment.md](deployment.md#2-vercel-hobby).

Not measured because of the limit: the Vercel build time and verification for a 500-item snapshot. The cleanup (unpublish and trash the bench posts) ran over RPC; its final publish has to wait until the limit resets.

## Findings and limits

- **Single writes take 4–6 s.** `posts.update` p50 was 4.1–5.3 s and p95 5.8–6.3 s from 50 to 550 Posts rows. Reads (`posts.get`, `posts.list`) were about 2–2.5 s p50.
- **Row count up to 550 Posts rows had little effect** on reads. `posts.update` p50 rose from 4.1 s to 5.3 s and `publish.readPublished` p50 from 3.4 s to 4.8 s. One outlier, `posts.list` limit 20 at 550 rows, reached 8.0 s.
- **Writes are serialized.** Effective write throughput was about one write every 2.5–3.6 s, both in contention runs and in seeding at concurrency 3.
- **≥ 10 simultaneous writers produce `LOCK_TIMEOUT`** (6 of 10 in this run). 5 writers succeeded but the last one waited 12.6 s.
- **Vercel Hobby deployment limit is the practical publish ceiling:** 100 deployments per 24 h across all projects, and builds cancelled by the Ignored Build Step count too. A day of heavy testing (two staging E2E runs, a prod install, benchmarks, ~20 pushes) exhausted it.
- **`system.health` takes about 11 s** (p50) because it reads all 11 sheets. Its p95 reached 17.1 s. In this range it did not grow measurably with total rows (500 → 2,302).
- **Cold start:** the first call after idle took 11.1 s, versus 1.3–1.6 s warm (PoC-1, `docs/history/day-0.md`).
- **Publish takes about 1–1.5 min.** Measured values were 60–91 s across all runs on dev and prod. Apps Script calls (collecting and committing, about 35 s) and the Vercel build and verification (deploying and verifying, about 35–42 s) take most of that time.
- **RPCs over 10 s** (the first item count where this happens):
  - `system.health` already exceeds 10 s at the smallest size measured (50 Posts rows).
  - Concurrent writes exceed 10 s from 5 writers (max 12.6 s), and from 3 concurrent creates during seeding (p95 11.8–12.7 s, max 21.0 s at 550 rows).
  - TC-CONC-01 reached a max of 13.5 s.
  - Sequential single editing calls stayed under 10 s up to 550 Posts rows (worst case 8.0 s).
- Public-site capacity under concurrent load is **unmeasured** (see above).

## How to reproduce

Run only against **dev**. `tests/load/backend.ts` calls `system.health` first and refuses to run when `environment` is `prod`. The env file supplies the Apps Script URL and HMAC secret, plus, for `publish`, the admin URL, admin allowlist, `AUTH_SECRET` and the GitHub repo and token.

```bash
export ZIDCMS_ENV_FILE=.local/secrets/dev.env   # a dev environment: retired, recreate it first (ADR-0012); the tools refuse prod
pnpm exec tsx tests/load/backend.ts latency            # 10 samples per action (--samples N)
pnpm exec tsx tests/load/backend.ts seed --to 50        # --concurrency 3 by default
pnpm exec tsx tests/load/backend.ts contention          # needs ≥ 10 draft bench posts
pnpm exec tsx tests/load/backend.ts publish --items 10  # sets N bench posts published, then publishes via the dev admin
pnpm exec tsx tests/load/backend.ts cleanup --publish   # unpublish + trash bench posts, then republish

pnpm exec tsx tests/load/public.ts --vus 1 --pace-ms 500 --duration 120 --warmup 5 \
  --network "owner laptop, residential connection"
```

Each run writes a JSON file to `tests/load/results/`, which Biome excludes so the raw output is never reformatted.

**Transfer budget:** `public.ts` adds up `totalBytes` from this month's `public-cdn-*` results. It stops when the monthly budget (`--budget-gb`, default 5 GB, i.e. 5 % of the 100 GB Hobby allotment) or the per-run budget (`--run-budget-gb`, default 2 GB) is reached. The November 2026 sampling used 0.6 MiB.

## Local reference only (not a benchmark)

`pnpm smoke:local` on the developer laptop with the in-memory emulator completed each publish job in ~2–7 s (local file target, no Vercel build). This says nothing about production latency.

# ZidCMS — retrospective (v0.1.0, 2026-11-21)

ZidCMS is an **early-stage**, non-commercial experiment, not a WordPress replacement. v0.1.0 is an early-stage pre-release and the project may be developed further. Detailed evidence: [day-2.md](day-2.md) and [release-v0.1.0.md](release-v0.1.0.md).

## What we set out to do

Build a single-admin CMS that costs $0 to run: a Next.js admin on Vercel Hobby, Google Sheets + Apps Script as the database behind HMAC-signed RPC, private Drive for media, Git as the store for published snapshots, and a fully static public site. Scope: P0 (posts, publish/rollback, static site, settings, docs) and P1 (pages, taxonomy, media, read-only revisions) if P0 was green. The goal was also to measure the limits of this architecture instead of claiming them.

## What shipped

| Area                                  | Status                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 scope                              | Shipped. Live on dev (`main`) and prod (`release`).                                                                                                                                                                                                   |
| P1 scope                              | Shipped (pages, categories/tags, media library + cover/inline images, read-only revisions).                                                                                                                                                           |
| PoC-1…4                               | All pass against real services (HMAC RPC, publish → Git → Vercel, media → Drive → build, Sheets round trip).                                                                                                                                          |
| Integration suite vs real Apps Script | 16 passed, 0 failed, 2 skipped (manual sheet corruption and a held lock; both covered by contract tests).                                                                                                                                             |
| Staging E2E (demo scenario)           | Pass in 8.8 min: sign-in rejection, draft + image upload, validation errors, conflict dialog, preview, publish, update, failed build keeps the old version live, rollback reproduces the target checksum, unpublish removes post and exclusive media. |
| Deployed checks (dev and prod)        | Pass: 35 API routes return 401 without session, foreign Origin → 403, security headers, 404s, sitemap/robots, snapshot contains no actor data, public web project has 0 functions.                                                                    |
| Prod                                  | Apps Script TC-GAS-01…08 pass; smoke + rollback with a sacrificial post (publish, update, rollback with matching checksum, unpublish) pass.                                                                                                           |
| CI                                    | Green on `main`; `integration.yml` and `e2e.yml` green on the emulator stack.                                                                                                                                                                         |
| Fresh-clone dry run                   | Local setup from `docs/setup.md` reproduced in a temp dir (install 28 s, `smoke:local` OK). Fresh-account cloud setup by another person: **pending**.                                                                                                 |
| Hygiene                               | Secret scans clean on every commit; production licenses are permissive (the only LGPL item, an optional image binary, was removed).                                                                                                                   |

Open items: a manual sign-in with a non-allowlisted Google account, the prod OAuth redirect URI (Google sign-in on the prod admin), the fresh-account dry run and the 500-item publish benchmark.

## What failed and why

**Day 0 (first contact with real services)**

- The `drive.file` scope is not enough for `DriveApp.createFolder`; switched to `drive` (ADR-0006). The plan had flagged this as an assumption, and the PoC confirmed it was wrong.
- "Write new article" looked broken on the deployed admin: the editor waited for five Apps Script calls (3–7 s cold) with no feedback, and repeated clicks cancelled navigation. Fixed with a loading state and a single `editor.context` RPC.
- The Vercel ignore step used cwd-relative pathspecs, so the first admin deployment was skipped.
- A dev HMAC secret was visible in a screenshot. It was rotated before first use.

**Session 2**

- A rejected dev login caused a server error instead of "Akses ditolak", because Auth.js v5 throws `CredentialsSignin` from `signIn`.
- One integration test was wrong: only the creating idempotency key of a coalesced publish is stored. The test was fixed, not the code.
- Design bug: dev and prod used the same content path on two branches, so promoting code could silently overwrite prod content. Fixed with per-environment content folders and prod on `release` (ADR-0011).
- Vercel commit-status matching used a substring and could pick up another project's status. It now requires an exact project match.
- An interrupted prod setup left the install marker in place, which locked the setup. The marker is now written last, and the lock requires the media folder.
- After the content-layout change, the beginner guide no longer set `ZIDCMS_ENV` for the web project, so builds would have failed.
- Biome reformatted raw load-test JSON. The folder is now excluded.

**Platform discoveries**

- **Load testing on Vercel:** the plan budgeted a public-site load test at up to 100 virtual users. Vercel's published policy (updated 2026-11-18) allows load testing only on Enterprise plans, and unannounced tests can get IPs blocked. No CDN load test was run. The tool now refuses more than 1 VU or pacing below 250 ms against Vercel, and a gentle latency sample was taken instead.
- **Prod install on Google:** clasp rejects a `rootDir` outside the project-file folder, so a separate `.clasp.prod.json` is needed. A new script on Google's default Cloud project could not get consent for the `drive` scope (403 `access_denied`) until the owner linked it to the Cloud project that holds the OAuth client. After that, the Drive API also had to be enabled explicitly for that project. Both steps are now in `docs/deployment.md`.

## Where AI execution helped and where it hurt

**Helped**

- Fast end-to-end scaffolding: monorepo, GAS backend with an in-memory emulator, admin, static site, publish orchestrator and a local walking skeleton existed before any cloud account was ready. Real-service work then mostly meant configuration.
- Test harnesses were built alongside features: shared HMAC test vectors, contract tests, an integration suite that refuses to run against prod, Playwright E2E with session-cookie minting, a build-failure switch, deployed-security checks, prod smoke/rollback and benchmark scripts.
- Tests against real services found real bugs that unit tests could not (Drive scope, cold-start UX, status matching, setup lock, Auth.js error path), and the content-topology flaw was caught before it could damage prod.
- Secrets were never handled in chat. Private values stayed in gitignored files, and scans ran on every commit.

**Hurt / limits**

- Account-bound steps needed the owner: OAuth consent screens, Cloud project linking, Vercel and GitHub tokens, manual sign-in checks. These were the critical path more than once.
- Platform policies were assumed rather than checked. The load-test plan was only corrected when the Vercel policy was read, and the `drive.file` assumption only failed at the PoC. Checking vendor policies and scopes up front would have saved rework.
- A later run overwrote a test-evidence file (Playwright cleans its output folder), so the evidence had to be reconstructed from logs. Evidence now lives outside Playwright's output folder.
- Some fixes had to be applied twice: the docs needed a follow-up once the content layout changed (beginner guide `ZIDCMS_ENV`).

## Time and credit use

- Two working sessions on 2026-11-21 (session 1: foundation, Day 0, PoC-1/2/4; session 2: test harnesses, staging acceptance, prod, benchmarks, docs).
- 36 commits on `main`: 20 code/docs commits and 16 publisher content commits (publishes and rollbacks on dev).
- Each staging E2E run uses about five Vercel deployments. Monthly Vercel usage is pending an owner screenshot.
- AI credit consumption is not observable from the repository and is not reported here.

## Measured limits of the architecture

Details and raw data: [../benchmarks.md](../benchmarks.md). All numbers are from the dev environment, measured from a residential connection.

- **Public site (CDN):** latency sample at 1 VU, 500 ms pacing, 120 s: 203 requests, p50 77 ms, p95 131 ms, p99 327 ms, 0 errors, 100 % cache HIT. Throughput was intentionally not measured (Vercel policy).
- **Admin RPC latency (Apps Script):** reads (`posts.list`, `posts.get`) stay around 2–2.5 s p50 from 50 to 550 post rows; `posts.update` is around 4–5 s p50 and about 6 s p95. The plan's admin-action target of p95 ≤ 4 s is **not met for writes**. `system.health` takes about 11 s p50 because it scans every sheet. The first call after idle has an ~11 s cold start.
- **Write contention (single script lock):** 2 and 5 parallel writers all succeed; at 10 writers, 4 succeed and 6 hit `LOCK_TIMEOUT`. Ten parallel updates to the same post produce 1 success and 9 `VERSION_CONFLICT` (as designed).
- **Publish to live:** 60–91 s end to end (10 and 100 items, staging E2E, prod smoke), well within the 5 min target. A 100-item snapshot is ~231 KB. The 500-item publish was still running when this was written.

These numbers fit the intended envelope of one admin, a few hundred items and a few publishes a day. They do not support multi-user editing or interactive-speed writes.

## Recommended next steps (P2 backlog, in order)

The order favours safety and operating cost first, then authoring correctness, then reader features. Each step stays within the $0 / Hobby constraints.

1. **Dual-secret HMAC rotation:** accept the current and next secret during a rotation window. Today a rotation needs a coordinated Vercel and Apps Script change with downtime. Small change, high operational value.
2. **Cheaper health check:** split `system.health` into a fast liveness/config check and an on-demand full validation. At ~11 s it is the slowest RPC.
3. **Pruning Revisions and AuditLog:** keep the last N revisions per item and archive old audit rows. Both sheets grow on every write (more than 900 audit rows after one benchmark run), which slowly increases read cost and moves toward spreadsheet cell limits.
4. **Separate published-revision pointer:** allow editing a live post without exposing the edit until _Perbarui_. This removes today's biggest authoring limitation and is a prerequisite for 5 and 6.
5. **Autosave:** debounced, based on 4 so drafts of live posts never go public. It must respect the ~4–5 s write latency and the single-lock contention numbers above.
6. **Scheduled publishing:** a time-driven Apps Script trigger that starts a normal publish job. It counts against the Vercel deployment budget, so cap it per day.
7. **RSS/Atom feed:** generated statically from the snapshot. Cheap and independent, so it can be done earlier if wanted.
8. **Static full-text search:** build-time index served as a static file. It has to stay small enough for the snapshot size seen above.
9. **Revision diff/restore and a media garbage-collection UI:** useful once real content exists.

Items like a rich-text editor, RBAC/workflows, multilingual, themes or multi-tenant would need a different backend than one spreadsheet behind one script lock. They should be re-evaluated against the measured limits before they are started.

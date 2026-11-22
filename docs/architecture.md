# Architecture

```text
                         ┌──────────────────────────────┐
 Admin browser ─────────►│ apps/admin (Next.js, Vercel) │
 (session cookie)        │  • Auth.js + allowlist       │
                         │  • validation (@zidcms/core) │
                         │  • publish orchestrator      │
                         └──────┬───────────────┬───────┘
              signed RPC (HMAC) │               │ GitHub Git Data API
                                ▼               ▼
                 ┌─────────────────────┐   ┌─────────────────────────┐
                 │ services/apps-script│   │ GitHub repo             │
                 │  doPost dispatcher  │   │  apps/web/content/prod  │
                 │  LockService        │   │  (branch release; main  │
                 │                     │   │   is code only) ADR-0012│
                 └──────┬───────┬──────┘   └───────────┬─────────────┘
                        ▼       ▼                      │ push → Vercel build
               Google Sheets  Google Drive             ▼
               (data, jobs,   (private media) ┌──────────────────────────┐
                audit)                        │ apps/web (static export) │
                                              └───────────┬──────────────┘
                                                          ▼
                                                   Readers (static only)
```

## Components

| Component      | Responsibility                                                                                                                                                                                                | Key files                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `@zidcms/core` | Types, sheet schema (`SHEET_COLUMNS`), cell codec (formula escape), validators, slugs, status transitions, RPC envelope/verification, snapshot builder + checksum, live-state, Markdown renderer, pure sha256 | `packages/core/src/*`                                                    |
| Apps Script    | The only component touching Sheets/Drive. Dispatcher verifies the RPC, runs an action (under the script lock for writes), writes revision + audit rows                                                        | `services/apps-script/src/dispatcher.ts`, `actions/*`, `gas/adapters.ts` |
| Admin          | Auth, HTTP API, server-rendered screens, publish orchestration                                                                                                                                                | `apps/admin/lib/*`, `apps/admin/app/*`                                   |
| Public site    | Static HTML generated from `content/<env>/snapshot.json`, copied to gitignored build paths by `scripts/prepare-content.mjs` (`ZIDCMS_ENV`)                                                                    | `apps/web/*`                                                             |

## Request flows

**Edit:** editor → `PATCH /api/posts/:id` (session + Origin + validation) → `posts.update` RPC → GAS lock → version check → write row + Revisions + AuditLog → response. If the item is published, the admin immediately calls `publish.acquire` and returns the job.

**Publish:** `POST /api/publish` → `publish.acquire` (coalescing/idempotency) → the browser polls `GET /api/publish/:id` every 3 s; each poll claims and performs one step:

| State         | Work                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| queued        | → collecting                                                                                                                           |
| collecting    | `publish.readPublished` → `buildSnapshot()` → checksum; equal to live → `live` (no-op)                                                 |
| committing    | rebuild snapshot, fetch new media bytes (`media.getBytes`), atomic Git commit to `CONTENT_ROOT` on `GITHUB_BRANCH`, `snapshots.record` |
| deploying     | read the web project's Vercel commit status (`VERCEL_STATUS_CONTEXT`, exact project match first) for the SHA; 15-min timeout           |
| verifying     | fetch `/zidcms-version.json?ts=…`; match version + checksum; 3-min timeout                                                             |
| live / failed | terminal; snapshot `live` (previous `superseded`) or `failed`                                                                          |

**Read (public):** CDN → static files. No function, no Google request.

## Data model

See plan §9 and `packages/core/src/schema/sheets.ts` (columns are resolved by header name; additional `PublishJobs` columns are listed in ADR-0008). Rows are never deleted; soft delete uses `deleted_at`.

## Trust zones

| Zone                 | Holds                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| Browser              | session cookie only                                                   |
| Admin server         | `AUTH_SECRET`, `GAS_HMAC_SECRET`, `GITHUB_TOKEN`, Google OAuth secret |
| Apps Script          | `HMAC_SECRET`, Drive folder id; runs as the owner                     |
| GitHub / public site | published snapshot + media only                                       |

## Local development topology

`pnpm dev:gas` (dispatcher over HTTP with in-memory sheets persisted to `.local/`), `pnpm dev:admin` with `PUBLISH_TARGET=local` (writes the gitignored build paths `apps/web/content/snapshot.json`, `apps/web/public/zidcms-version.json`, `apps/web/public/media/`), `pnpm dev:web` (`next dev` serving the freshly written files). The protocol, validation, and orchestrator code paths are the production ones.

## Environments

Prod is the only hosted environment: it builds `release` and publishes to `apps/web/content/prod/`, with its own spreadsheet, script, secrets and Vercel projects. `main` carries code only and creates no Vercel deployments; code reaches prod by merging `main` into `release`. Until 2026-11-22 a dev/staging environment built `main` and published to `apps/web/content/dev/`; it was retired (ADR-0012), but the code stays multi-environment (`ZIDCMS_ENV=dev|prod`, per-environment content folders), so it can be recreated. See ADR-0011, ADR-0012 and [deployment.md](deployment.md).

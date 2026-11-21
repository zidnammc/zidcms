# Changelog

All notable changes to ZidCMS are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-11-21 (early stage)

First public release, published as a GitHub pre-release. ZidCMS is an early-stage, non-commercial experiment and not a WordPress replacement; it may be developed further.

### Added

- **Admin dashboard** (`apps/admin`, Next.js on Vercel, UI in Bahasa Indonesia)
  - Auth.js v5 with Google sign-in, e-mail allowlist (`ADMIN_EMAILS`), single admin role, server-side `requireAdmin()` on every route and page, Origin check on mutations (ADR-0002).
  - Posts and pages: create, list with filter/search, Markdown editor with preview, SEO fields, publish, unpublish, archive, trash and restore; conflict dialog on stale versions; unsaved-changes guard.
  - Categories (one per post) and tags (many per post).
  - Media library: image upload to a private Google Drive folder, alt text, cover images, inline references.
  - Read-only revision history per item.
  - Site settings: title, description, language, posts per page, default author name.
  - Publish screen: pipeline progress, job history, snapshot history, rollback.
- **Apps Script backend** (`services/apps-script`)
  - The only component that touches Google Sheets and Drive, reached through an HMAC-SHA256-signed RPC with timestamp window, nonce replay cache, and action allowlist; fails closed without a secret (ADR-0001).
  - Formula-safe sheet codec (values such as `=…`, `+1`, `001`, `TRUE` round-trip unchanged).
  - Script lock and optimistic version checks on every write; revision and audit rows for each write.
  - Local emulator running the same dispatcher code against in-memory sheets.
- **Publish pipeline** (ADR-0003, ADR-0008)
  - Published-only snapshot → one atomic Git commit (GitHub Git Data API) → Vercel build → freshness verification via `zidcms-version.json`.
  - Coalescing of concurrent publish requests, idempotency keys, no-op detection, step leases, timeouts, and retries.
  - Failure safety: a failed build leaves the previous version live.
  - Rollback to any earlier snapshot, reproducing its checksum and reusing media blobs.
- **Static public site** (`apps/web`, Next.js static export on the Vercel CDN, ADR-0005)
  - Home with pagination, post and page routes, category and tag archives, 404.
  - `sitemap.xml`, `robots.txt`, canonical URLs, Open Graph metadata.
  - CSP and security headers; no serverless functions; readers never reach Apps Script, Sheets, or Drive.
- **Environments** (ADR-0011): dev/staging builds from `main`, prod from `release`, with per-environment content folders and separate Google resources, secrets, and Vercel projects.
- **Tooling and tests**
  - Unit and contract tests (Vitest), integration suite against the emulator or a real dev Apps Script, Playwright E2E for the demo scenario (local and staging).
  - `pnpm check:deployed` (auth, headers, metadata, and snapshot privacy checks on a deployment), `pnpm smoke:local` and `pnpm smoke:deployed`.
  - Load-test scripts for the backend and a rate-limited public latency sampler (`tests/load/`).
  - Secret scans of build bundles and tracked files; CI on GitHub Actions without secrets.
- **Documentation**: English [beginner guide](docs/beginner-guide.md), architecture, API, security, testing, setup, deployment, operations, limitations, benchmarks, and ADRs 0001–0011.

### Known limitations

See [`docs/limitations.md`](docs/limitations.md).

### Not yet validated

- Setup on fresh accounts by a third party following [`docs/beginner-guide.md`](docs/beginner-guide.md).
- Public CDN capacity under load. Vercel permits load testing only on Enterprise plans, so only low-rate latency sampling was run (see [`docs/benchmarks.md`](docs/benchmarks.md)).

[0.1.0]: https://github.com/zidnammc/zidcms/releases/tag/v0.1.0

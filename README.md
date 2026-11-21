# ZidCMS

**Publish from Sheets. Serve at scale.**

ZidCMS is an open-source, spreadsheet-native headless CMS:

- a standalone **admin dashboard** (Next.js on Vercel) for allowlisted admins,
- **Google Sheets** as the content store and **Google Drive** as the private media origin,
- **Google Apps Script** as the only component that touches Sheets/Drive, reached through an **HMAC-signed RPC**,
- **Git (GitHub)** as the versioned store of published snapshots,
- a **fully static public site** (Next.js static export on the Vercel CDN), rebuilt from the snapshot on every publish.

Readers never trigger Apps Script, Sheets, Drive, or any serverless function. Content becomes public only through a verifiable publish job: `queued → collecting → committing → deploying → verifying → live`.

> **Status: experimental (v0.1.0 in progress).** This is a non-commercial open-source experiment built during a seven-day AI-executed sprint — not a WordPress replacement. See [`docs/limitations.md`](docs/limitations.md).

```text
Admin browser ──► apps/admin (Next.js) ──HMAC RPC──► services/apps-script ──► Sheets / Drive
                         │
                         └── GitHub Git Data API ──► apps/web/content/snapshot.json ──► Vercel static build ──► Readers
```

## Repository layout

| Path                   | Contents                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core`        | Shared, framework-free domain logic: types, sheet schema + codec, validators, slugs, status transitions, RPC envelope + verification, snapshot builder + checksum, Markdown renderer |
| `services/apps-script` | GAS dispatcher, actions, GAS adapters, in-memory adapters, local GAS emulator, esbuild bundle                                                                                        |
| `apps/admin`           | Admin dashboard (Auth.js + allowlist, HTTP API, publish orchestrator, UI in Bahasa Indonesia)                                                                                        |
| `apps/web`             | Static public site generated from `content/snapshot.json`                                                                                                                            |
| `scripts`              | setup, seed, smoke test, PoCs, secret scan, static-output check                                                                                                                      |
| `docs`                 | architecture, API, security, setup, deployment, operations, limitations, benchmarks, ADRs, daily status                                                                              |

> **Pemula?** Baca [Panduan ZidCMS untuk Pemula](docs/panduan-pemula.md) (Bahasa Indonesia): cara memakai dasbor, mencoba di komputer sendiri, dan memasang online langkah demi langkah.

## Quick start (local, no Google/GitHub/Vercel account needed)

```bash
pnpm install
pnpm init:local   # writes apps/admin/.env.local with random local secrets
pnpm dev:gas      # Apps Script emulator on :8787 (same dispatcher code as production, in-memory sheets)
pnpm dev:web      # public site on :3001
pnpm dev:admin    # admin on :3000 — use "Dev login" with admin@example.com
pnpm seed         # optional sample content
pnpm smoke:local  # optional end-to-end check: draft → publish → update → no-op → rollback
```

Production setup (Google account, Apps Script, Vercel Hobby, GitHub PAT): [`docs/setup.md`](docs/setup.md) and [`docs/deployment.md`](docs/deployment.md).

Set `ADMIN_EMAILS` to your own Google account. Never commit it.

## Quality gates

`pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:web && pnpm scan:secrets` — the same steps run in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Documentation

[Panduan pemula (ID)](docs/panduan-pemula.md) · [Architecture](docs/architecture.md) · [API](docs/api.md) · [Security](docs/security.md) · [Setup](docs/setup.md) · [Deployment](docs/deployment.md) · [Operations](docs/operations.md) · [Limitations](docs/limitations.md) · [Benchmarks](docs/benchmarks.md) · [Decisions](docs/decisions/)

## Hosting note

The reference deployment runs on Vercel Hobby, GitHub Free, and a free Google account ($0 budget). Vercel Hobby is for non-commercial use; this project stays a non-commercial experiment.

## Acknowledgments

ZidCMS was developed during a seven-day sprint using Devin AI Max access provided by Poke. _(Wording to be confirmed by the owner before release.)_

## License

Copyright 2026 The ZidCMS Authors. Licensed under the [Apache License, Version 2.0](LICENSE). See [`NOTICE`](NOTICE).

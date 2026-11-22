# 0011 — Environment topology: per-environment content folders, prod on `release`

Amended by ADR-0012: the dev/staging environment was retired on 2026-11-22.

- **Status:** accepted (2026-11-21, owner approval). Supersedes the staging mechanism default in plan §8.1/G10 (`dev` branch).

## Problem

Dev and prod need separate published snapshots. With one content path (`apps/web/content/snapshot.json`) on two branches, every code promotion merges content files: either a conflict, or — when prod content is unchanged since the merge base — dev content silently replaces prod content and is deployed to the prod site.

## Decision

| Environment | Admin / web Vercel projects             | Git branch built | Publisher writes to                                 | Google resources                  |
| ----------- | --------------------------------------- | ---------------- | --------------------------------------------------- | --------------------------------- |
| local       | `localhost:3000` / `localhost:3001`     | working tree     | gitignored build paths in `apps/web` (`LocalStore`) | in-memory emulator                |
| dev/staging | `zidcms-admin` / `zidcms-web`           | `main`           | `apps/web/content/dev/` on `main`                   | dev spreadsheet, script, secrets  |
| prod        | `zidcms-prod-admin` / `zidcms-prod-web` | `release`        | `apps/web/content/prod/` on `release`               | prod spreadsheet, script, secrets |

- Each environment folder holds `snapshot.json`, `zidcms-version.json` and `media/`. `CONTENT_ROOT` defaults to `apps/web/content/<ZIDCMS_ENV>` and `GITHUB_BRANCH` to `main` (dev) or `release` (prod).
- `apps/web/scripts/prepare-content.mjs` runs before `next build`, `next dev` and `tsc`: with `ZIDCMS_ENV=dev|prod` it copies that folder to the build paths `content/snapshot.json`, `public/zidcms-version.json`, `public/media/` (all gitignored). Without `ZIDCMS_ENV` (local, CI) it keeps an existing local snapshot or falls back to `content/empty/`. On Vercel a missing `ZIDCMS_ENV` fails the build.
- **Promotion** = merge `main` into `release` (fast-forward or merge commit, GitHub UI is fine). `main` never touches `content/prod/`, so merges cannot conflict on or overwrite prod content. `release` is never merged back into `main`; fixes land on `main` first.
- Both `vercel.json` files skip every non-production deployment (`VERCEL_ENV != production`), so dev projects build only `main` and prod projects only `release` even though they share one `vercel.json`. `git.deploymentEnabled` allows `main` and `release`.
- The admin matches the Vercel commit status of exactly its web project (`Vercel – <project>`), so `zidcms-web` cannot pick up the status of `zidcms-prod-web` or similarly named projects.
- Snapshots committed before this change (dev v1–v12) used `apps/web/content/snapshot.json` and `apps/web/public/media/`; `GitHubStore.readSnapshot` and rollback media reuse fall back to those paths, so rollbacks to old versions keep working.

## Consequences

- Local publishing output can no longer be committed by accident (build paths are gitignored); `pnpm reset:content` only resets the local build paths.
- CI ignores pushes that only touch `apps/web/content/dev/**` or `apps/web/content/prod/**` and runs on `main` and `release`.
- Prod web builds only on promotion or prod publishes; dev publishes do not consume prod builds.

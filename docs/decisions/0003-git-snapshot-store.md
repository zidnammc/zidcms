# 0003: Snapshot store: Git commits to the project repository

- **Status:** accepted (2026-11-21). **PoC-2 passed on 2026-11-21**: the owner published v1 from the deployed admin; publisher commit `7ac3141` (authored by the PAT owner) triggered the Vercel build, the orchestrator detected the `Vercel – zidcms-web` commit status, and `zidcms-version.json` on the live site matched version 1 and its checksum.

## Decision

- `apps/admin/lib/publish/github.ts` creates one atomic commit per publish with the Git Data API: ref → base commit → recursive tree (media paths) → blobs for new media only → tree with `base_tree` (+ `sha: null` deletions for media no longer referenced) → commit → `PATCH refs` with `force: false`; a 422 (non-fast-forward) rebuilds on the new head, max 3 attempts.
- Commit message `content: publish v<N> (job <id>)`. The marker makes the step idempotent: before committing, the orchestrator looks for a recent commit containing `(job <id>)` and reuses its SHA.
- Rollback reuses blob SHAs from the target commit's tree (no re-download from Drive).
- Deploy status: GitHub combined commit status filtered by a context substring (`VERCEL_STATUS_CONTEXT`, default `Vercel`) **[NV]**. Fallback: Vercel REST API token (owner approval).
- Freshness: `GET ${PUBLIC_SITE_URL}/zidcms-version.json?ts=<now>` with `cache: no-store`; `apps/web/vercel.json` sets `max-age=0, must-revalidate` on that file.
- Staging (G10 default): `dev` branch + dev Google resources; `vercel.json` enables deployments only for `main` and `dev` **[NV exact semantics]**.

## [NV] items resolved by PoC-2

- **Confirmed:** commits authored by the PAT owner trigger Hobby deployments.
- **Confirmed:** the combined commit status contains one context per project (`Vercel – zidcms-web`, `Vercel – zidcms-admin`), and `VERCEL_STATUS_CONTEXT=zidcms-web` selects the web project.
- Branch protection: not enabled on `main` yet; if enabled later, the publisher token needs a bypass or a `content` branch.
- Fixed after PoC-2: the media-dir cleanup no longer deletes `public/media/.gitkeep`.

## Accepted consequence (G2)

Every published version stays in public Git history forever, including later-unpublished content and media.

## Local development

`PUBLISH_TARGET=local` uses `lib/publish/local.ts`: writes into `apps/web/content` + `apps/web/public` on disk, keeps history under `.local/publish/`, and reports deploys as immediately successful (set `LOCAL_DEPLOY_FAIL=true` to simulate TC-PUB-07). Verification still fetches the real local web server.

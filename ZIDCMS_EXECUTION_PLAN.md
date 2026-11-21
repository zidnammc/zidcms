# ZidCMS — Execution Plan

**Document type:** Implementation specification and handoff to Executor AI  
**Version:** 2.2 (v2.0 + owner decisions G2, G5, G8, G11, G14, G16 recorded — see §26)  
**Status:** Planning baseline — implementation not started — working brand name pending owner approval  
**Target:** Day-0 owner preflight + seven-day MVP sprint after Devin Bots credit redemption  
**Planner:** Devin (planning only; no code written, no work claimed)  
**Executor:** AI development agent(s), supervised by the project owner

---

## Table of contents

0. How to read this document
1. Executive brief
2. Roles, protocol, and evidence rules
3. Scope: priorities, design envelope, non-goals
4. Architecture overview
5. Architecture decision records (defaults)
6. Technology stack
7. Repository layout and conventions
8. Environments, domains, and secrets
9. Data model (Google Sheets)
10. Admin ↔ Apps Script RPC specification
11. Admin HTTP API specification
12. Content rules (slugs, Markdown, media references, limits)
13. Publishing model and publish job state machine
14. Snapshot format
15. Public site specification
16. Admin dashboard specification
17. Security specification and threat model
18. Testing strategy and test case catalog
19. CI/CD and deployment
20. Observability and operations runbooks
21. Benchmark plan
22. Schedule, work breakdown, and cut rules
23. Workstreams and collaboration
24. Acceptance criteria
25. Risk register
26. Owner approval gates
27. Deliverables, release checklist, templates
28. Known limitations (initial draft for `docs/limitations.md`)
29. Glossary
30. First instruction to Executor AI

---

## 0. How to read this document

**Labels.** Every platform claim carries one of:

| Label    | Meaning                                                              | Executor obligation                                   |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| **[V]**  | Verified against official documentation by the planner on 2026-11-21 | Re-check at implementation time; limits change        |
| **[A]**  | Assumption based on common knowledge                                 | Confirm from docs before relying on it                |
| **[NV]** | Needs validation                                                     | Prove with a test or PoC; record the result in an ADR |

**Normative words.** _MUST_ = required for MVP acceptance. _SHOULD_ = default; deviation needs a written reason in an ADR. _MAY_ = optional.

**Changes in v2.1.** Owner decisions recorded: repository is **public from day 1**; single admin = owner's Google account (value kept out of the repo); **Vercel Hobby, $0 total budget**; Devin AI Max access provided by **Poke** is acknowledged in the README. Consequences are applied throughout (see §26.1): secret hygiene for a public repo, Vercel Hobby limits (100 deployments/day, 1 concurrent build), deployment budget.

**Changes in v2.2.** License decided: **Apache-2.0**, copyright holder **The ZidCMS Authors** (G11). No owner gate blocks the start of work any more.

**Changes since v1.1 (summary).** Day-0 preflight; concrete default ADRs with fallbacks; Apps Script web-app constraints designed in (no request headers, always HTTP 200, 302 redirect); signed RPC protocol; publish semantics and poll-driven job state machine; Git-based snapshot store; private Drive with media copied into the build; fully static public site; Sheets integrity rules (50k-char cells, type coercion, formula injection); full data model incl. `Snapshots`/`AuditLog`/`_Meta`; snapshot JSON format; admin UI and public site specs; threat model; test catalog; runbooks; task-level work breakdown; cut rules.

---

## 1. Executive brief

Build **ZidCMS** ("Publish from Sheets. Serve at scale."), an open-source, spreadsheet-native headless CMS:

- **Standalone admin dashboard** (Next.js on Vercel) for authorized admins.
- **Google Sheets** as the structured content store.
- **Google Apps Script (GAS)** as the only component that touches Sheets and Drive, called through a signed RPC.
- **Google Drive** as the _private_ media origin.
- **Git (GitHub)** as the versioned store of published snapshots.
- **Static Next.js public site** on Vercel CDN, rebuilt from the snapshot on each publish.

Readers **never** trigger Apps Script, Sheets, Drive, or any serverless function. Content becomes public only through a controlled, verifiable publish job.

The project is an experiment in the usefulness, limits, and maintainability of an AI-developed CMS — **not** a WordPress replacement.

**Primary success journey:** sign in → create article → save draft → preview → publish → view on deployed site → update → republish → roll back if necessary.

**Constraints.**

- Seven-day sprint. Execution capacity: **Devin AI Max access provided by Poke** (owner-stated). Access reportedly expires seven days after redemption and the sign-in link 48 hours after issuance **[A]**. The owner verifies the exact entitlement and deadlines in the provider UI and completes **Day 0** (§22.1) _before_ redeeming.
- **Budget: $0.** Vercel Hobby, GitHub Free (public repo), free consumer Google account. No paid service, add-on, or upgrade may be introduced (§26.1).
- **Public repository from the first commit** — everything committed is world-readable immediately.

---

## 2. Roles, protocol, and evidence rules

### 2.1 Roles

| Role          | Responsibilities                                                                  | Must not                                                                         |
| ------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Planner       | This plan, constraints, milestones, acceptance criteria                           | Write production code; claim progress                                            |
| Executor AI   | Code, tests, docs, PoCs, deployments (when authorized), evidence, daily reports   | Invent approvals; broaden scope silently; handle secrets outside approved stores |
| Project owner | Accounts, credentials, scopes, repo visibility, deployments, costs, scope changes | —                                                                                |

### 2.2 Executor rules

1. Read this document fully before coding.
2. Day 1 begins by confirming or overriding the default ADRs in §5 and running the PoCs in §22.3.
3. Label claims **[V] / [A] / [NV]**.
4. No success claim without evidence (§2.3).
5. Secrets never appear in Git, client bundles, logs, screenshots, PR/issue text, or chat transcripts.
6. Record decisions in `docs/decisions/NNNN-kebab-title.md` (status: proposed / accepted / superseded).
7. Prefer simple, auditable solutions; every new dependency needs a one-line justification in the PR.
8. Ask the owner before: paid resources, production credentials, repo visibility changes, production deploys, load tests beyond §21 limits, making any data public.
9. Post a daily report (§27.3).
10. Protect the core publish path over optional features (cut rules §22.11).
11. When blocked on an owner decision, continue with work that does not depend on it and list the blocker at the top of the daily report.

### 2.3 What counts as evidence

| Claim                | Acceptable evidence                                                                   |
| -------------------- | ------------------------------------------------------------------------------------- |
| "Tests pass"         | Command + output excerpt + CI run URL                                                 |
| "Deployed"           | Vercel deployment URL + commit SHA                                                    |
| "Published"          | Publish job id, final state `live`, `zidcms-version.json` content from the public URL |
| "Secure against X"   | Automated negative test name + output                                                 |
| "Performance is Y"   | Raw load-test output file in `tests/load/results/` + environment description          |
| "Setup reproducible" | Log of a fresh-account run following `docs/setup.md` verbatim                         |

---

## 3. Scope

### 3.1 Priorities

**P0 — must ship (demo fails without it)**

- Admin sign-in/out, single `admin` role, email allowlist, server-side authorization.
- Posts: create, list (filter/search), edit, preview, publish, unpublish, archive, soft-delete, restore from trash.
- Fields: title, slug, Markdown body, excerpt, author name, SEO title/description, timestamps, version.
- Optimistic concurrency + locking; revision and audit rows on every write.
- Publish job: published-only snapshot → Git commit → Vercel build → freshness verification; coalescing; failure safety.
- Rollback to a previous snapshot version.
- Static public site: home with pagination, post detail, 404, SEO metadata, canonical URLs, Open Graph basics, `sitemap.xml`, `robots.txt`.
- Site settings: title, description, language, posts per page, default author name.
- Docs: README, setup, deployment, architecture, API, security, limitations, benchmarks.

**P1 — only if P0 is green at end of Day 4**

- Pages (top-level routes) sharing the post editor.
- Categories (one per post) and tags (many per post), with public archive pages.
- Media: upload, library, alt text, cover image, inline image references, inclusion in the build.
- Read-only revision history per item.

**P2 — post-MVP backlog**
Rich-text/WYSIWYG editor, autosave, scheduled publishing, separate "published revision" pointer (edit live posts without exposing changes), revision diff/restore, RSS/Atom, full-text search, comments, themes, layout builder, multilingual, multi-tenant, RBAC, workflows/approvals, analytics, plugins, AI authoring, image transformations, media garbage-collection UI, HMAC dual-secret rotation.

### 3.2 Design envelope (MVP targets, to be measured — not promises)

| Dimension            | Target                                               |
| -------------------- | ---------------------------------------------------- |
| Posts + pages        | ≤ 500 total                                          |
| Media files          | ≤ 200, each ≤ 3 MB                                   |
| Concurrent admins    | ≤ 3                                                  |
| Publish frequency    | ≤ 30 per day (Vercel Hobby deployment budget, §19.4) |
| Admin action latency | p95 ≤ 4 s (GAS round trip dominates)                 |
| Publish to live      | p95 ≤ 5 min (Vercel build dominates)                 |
| Public page latency  | CDN-served static files                              |

Exceeding the envelope is not a bug; it is documented as a limitation with measured numbers.

### 3.3 Non-goals

- WordPress parity; arbitrary traffic or unlimited content guarantees.
- Transactional relational semantics on spreadsheets.
- An autonomous 24/7 bot team for appearances.
- Any **unauthenticated** writable endpoint (the GAS URL is reachable by design; every request MUST be signed — ADR-001).
- Editing data directly in the spreadsheet as a supported workflow. The sheet is a datastore; manual edits are unsupported and may be rejected by validation.

---

## 4. Architecture overview

```text
                         ┌──────────────────────────────┐
 Admin browser ─────────►│ apps/admin (Next.js, Vercel) │
 (session cookie)        │  • Auth.js + allowlist       │
                         │  • validation (packages/core)│
                         │  • publish orchestrator      │
                         └──────┬───────────────┬───────┘
              signed RPC (HMAC) │               │ GitHub Git Data API
                                ▼               ▼
                 ┌─────────────────────┐   ┌─────────────────────────┐
                 │ services/apps-script│   │ GitHub repo `zidcms`    │
                 │  doPost dispatcher  │   │  apps/web/content/...   │
                 │  LockService        │   │  apps/web/public/media/ │
                 └──────┬───────┬──────┘   └───────────┬─────────────┘
                        ▼       ▼                      │ push → Vercel build
               Google Sheets  Google Drive             ▼
               (data, jobs,   (private media) ┌──────────────────────────┐
                audit)                        │ apps/web (static export) │
                                              │ Vercel CDN               │
                                              └───────────┬──────────────┘
                                                          ▼
                                                   Readers (static only)
```

**Trust zones**

| Zone            | Contents                                    | Trusted with                      |
| --------------- | ------------------------------------------- | --------------------------------- |
| Browser (admin) | Session cookie only                         | Nothing secret                    |
| Admin server    | Auth secrets, HMAC secret, GitHub token     | All privileged orchestration      |
| GAS             | HMAC secret, Drive folder id; runs as owner | Sheets/Drive access               |
| GitHub          | Published snapshots + media, code           | Public data only (if repo public) |
| Public site     | Static files                                | Public data only                  |

---

## 5. Architecture decision records (defaults)

Executor writes each as `docs/decisions/000N-*.md` on Day 1 with status _accepted_ or _superseded (reason)_.

### ADR-001 — Admin ↔ GAS: HMAC-signed RPC to a GAS web app

- **Deployment:** web app, _Execute as: Me (owner)_, _Who has access: Anyone_. Under this setting anyone with the URL can invoke it **[V]**; authentication is entirely application-level.
- **Platform constraints [V]:** `doPost(e)` cannot read request headers (Google declined the feature in 2023); `ContentService` output is always HTTP 200; the response is served via a 302 redirect to `script.googleusercontent.com` that must be followed with GET.
- **Protocol:** see §10. Signature over the exact envelope string; timestamp window; nonce replay cache; action allowlist; size limit.
- **Why not alternatives first:** shared secret in the browser is unacceptable; CORS is not authorization; header-based Bearer auth to "Anyone" web apps is impossible because headers are not readable.
- **Fallback A:** Apps Script API `scripts.run` using the owner's OAuth refresh token stored server-side (requires a standard GCP project; service accounts unsupported **[A, NV]**). Caveat for a $0 consumer setup: an OAuth app left in _Testing_ publishing status issues refresh tokens that expire after about 7 days **[A, NV]**, which would force weekly re-authorization — another reason ADR-001's default is preferred.
- **Fallback B (owner approval required):** Sheets/Drive APIs directly from the admin server with a service account; removes GAS and `LockService` from the write path, changes the project premise.
- **Residual risk:** anyone who learns the URL can consume GAS executions (30 simultaneous per user **[V]**) even though requests are rejected. Mitigation: URL is server-side only; rejected requests return fast; documented.

### ADR-002 — Admin authentication

- Auth.js (NextAuth) with Google provider. Sign-in allowed only if `email_verified === true` and lower-cased email ∈ `ADMIN_EMAILS`. **[NV]** current stable Auth.js major for the chosen Next.js version.
- Session cookie: httpOnly, Secure, SameSite=Lax; max age 7 days; JWT strategy (no session DB).
- Every server action / route handler calls `requireAdmin()`; middleware is a convenience, not the security boundary.
- Mutations verify `Origin` equals `ADMIN_URL`.
- Admin domain is separate from the public site; all admin responses send `X-Robots-Tag: noindex, nofollow`.

### ADR-003 — Snapshot store: Git commits to the project repo

- The orchestrator creates **one atomic commit** per publish with the GitHub Git Data API: get ref → base commit → create blobs → create tree (with `base_tree`) → create commit → update ref (fast-forward only) **[A]**.
- Commit contents: `apps/web/content/snapshot.json`, `apps/web/public/zidcms-version.json`, and the media set (§14.3).
- Non-fast-forward on ref update (someone pushed code meanwhile) → re-read head and rebuild the tree on the new base (content paths are owned exclusively by the publisher), max 3 attempts.
- Vercel Git integration builds the web project on push. A failed build does not replace the current production deployment **[A, NV]**.
- Vercel Hobby allows **1 concurrent build [V]**; a publish build may queue behind an admin or code build, so deploy timeouts account for queueing (§13.4).
- **[NV]** On Hobby, confirm that commits authored by the publisher identity (PAT owner) and by the Executor's Git identity both trigger deployments; if Vercel blocks commits from non-owner authors, the publisher PAT MUST belong to the owner's GitHub account and the Executor's pushes are deployed via merges by the owner or CI.
- Deploy status: poll GitHub commit statuses / deployments for the SHA (Vercel reports to GitHub) **[NV]**; fallback: Vercel REST API with a read token.
- Freshness: fetch `${PUBLIC_SITE_URL}/zidcms-version.json?ts=<now>`; compare `version` and `checksum`.
- Branch protection on `main` may block the publisher **[NV]** → fallback: dedicated `content` branch as the Vercel production branch for `apps/web`, merged from `main` by CI; or an owner-approved bypass for the bot token.
- **Accepted by owner (G2):** the repo is public, so every published version remains in public Git history forever, including later-unpublished content and media.

### ADR-004 — Media: private Drive origin, published copies in the build

- Drive folder is private. ZidCMS never changes Drive sharing.
- Upload: browser → admin server (auth, magic-byte MIME check, size check, sha256) → GAS `media.upload` (base64) → Drive → `Media` row.
- Allowed: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. **SVG is rejected.**
- Max 3 MB per file; Vercel Function request bodies are capped at 4.5 MB **[A, NV]** and base64 inflates ~33% on the GAS hop.
- At publish, referenced media are fetched (once per sha256) and committed under `apps/web/public/media/<sha256>.<ext>`; URLs are stable and CDN-served.

### ADR-005 — Public site: Next.js static export

- `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`, `generateStaticParams` everywhere, `dynamicParams = false`.
- No route handlers, middleware, server actions, ISR, or runtime env reads.
- Build output with zero functions is the evidence for "no runtime backend".
- Markdown rendered at build time by `@zidcms/core` `renderMarkdown()`; admin preview uses the same function.
- Builds MUST succeed with an empty snapshot (fresh install).

### ADR-006 — GAS code organization and tooling

- Pure domain logic in `packages/core` (TypeScript, no Node/GAS APIs).
- GAS code depends on `SheetStore`, `MediaStore`, `NonceStore`, `Clock`, `Lock` interfaces; GAS implementations wrap `SpreadsheetApp`, `DriveApp`, `CacheService`, `LockService`; tests use in-memory fakes.
- esbuild bundles into one IIFE file, target ES2019, exposing global `doPost`/`doGet`/`setup` functions. **[NV]** recent clasp majors may not transpile TypeScript — bundling is required regardless.
- Container-bound to the CMS spreadsheet SHOULD be used so the manifest can declare `https://www.googleapis.com/auth/spreadsheets.currentonly` **[NV]**; Drive scope: try `drive.file` first (works for files the script creates) **[NV]**, else `drive`.
- Explicit `oauthScopes` in `appsscript.json`; `"webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }` **[NV exact enum values]**.
- Always redeploy to the **same deployment ID** to keep the URL stable; GAS limits each script to **200 versions [V]** → document cleanup.
- Zod in the GAS bundle only if bundle size and runtime are acceptable **[NV]**; otherwise `packages/core` exports plain validator functions used by both sides.

### ADR-007 — Monorepo tooling

- pnpm workspaces; no Turborepo unless build times justify it.
- TypeScript `strict`; Biome for lint + format (single tool) unless Next.js integration issues force ESLint + Prettier.
- Vitest (unit/contract), Playwright (e2e), k6 (load; autocannon acceptable).
- Node LTS pinned via `.nvmrc` and `engines`; `packageManager` field pins pnpm.
- Lockfile committed; dependencies pinned to exact versions published ≥ 7 days ago.

### ADR-008 — Publish orchestration is poll-driven

- No background workers, cron, or long-running functions. Each status poll advances the job by at most one idempotent step (§13.4). Rationale: fits Vercel function time limits and GAS 6-minute runtime **[V]**, survives closed tabs via leases.

---

## 6. Technology stack

| Layer          | Choice                                                                                   | Notes                                                     |
| -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Language       | TypeScript (strict)                                                                      | Everywhere, including GAS source                          |
| Admin          | Next.js App Router                                                                       | Server Components for reads; route handlers for mutations |
| Admin UI kit   | Plain CSS modules or Tailwind (Executor picks one)                                       | No component library unless justified                     |
| Public site    | Next.js App Router, static export                                                        |                                                           |
| Markdown       | unified + remark-parse + remark-gfm + remark-rehype + rehype-sanitize + rehype-stringify | Raw HTML disabled                                         |
| Validation     | Zod (admin) / shared validators (GAS)                                                    | §ADR-006                                                  |
| Backend        | Google Apps Script V8 runtime                                                            |                                                           |
| Data           | Google Sheets                                                                            |                                                           |
| Media origin   | Google Drive                                                                             |                                                           |
| Snapshot store | GitHub                                                                                   | Fine-grained PAT                                          |
| Hosting        | Vercel (two projects)                                                                    |                                                           |
| Tests          | Vitest, Playwright, k6                                                                   |                                                           |
| CI             | GitHub Actions                                                                           |                                                           |

---

## 7. Repository layout and conventions

```text
zidcms/
  apps/
    admin/
      app/                    # routes (§16)
      lib/gas-client.ts       # signed RPC client
      lib/publish/            # orchestrator steps
      lib/auth.ts             # Auth.js config + requireAdmin()
      vercel.json             # ignoreCommand (§19.3)
    web/
      app/                    # public routes (§15)
      content/snapshot.json   # written only by publish commits
      public/media/           # written only by publish commits
      public/zidcms-version.json
  packages/
    core/
      src/schema/             # entity types + validators
      src/slug.ts
      src/status.ts           # transitions
      src/markdown.ts         # renderMarkdown()
      src/snapshot.ts         # buildSnapshot(), checksum()
      src/rpc.ts              # envelope types, error codes
  services/
    apps-script/
      src/                    # dispatcher, actions, stores
      appsscript.json
      .clasp.json.example
      build.mjs               # esbuild
  scripts/
    setup-sheet.ts            # calls system.setup
    seed.ts
    poc/                      # PoC-1..3 scripts (kept as regression tools)
    verify-bundle-secrets.ts
  tests/
    e2e/
    load/  load/results/
  docs/
    decisions/ architecture.md api.md security.md setup.md deployment.md
    operations.md benchmarks.md limitations.md status/
  .github/workflows/
  README.md LICENSE NOTICE .env.example .nvmrc biome.json pnpm-workspace.yaml
```

**Conventions**

- Package names: `@zidcms/core`, `@zidcms/admin`, `@zidcms/web`, `@zidcms/apps-script`.
- Branches: `feat/<area>-<short>`, `fix/...`, `docs/...`; small PRs; squash merge.
- Commits: Conventional Commits. Publish commits: `content: publish v<N> (job <id>)` authored by the bot identity.
- Unit tests colocated (`*.test.ts`).
- No empty scaffolding directories.

---

## 8. Environments, domains, and secrets

### 8.1 Environment matrix

| Env         | Admin                                    | Public site                                    | Spreadsheet / Drive | GAS deployment | Git branch                              |
| ----------- | ---------------------------------------- | ---------------------------------------------- | ------------------- | -------------- | --------------------------------------- |
| local       | `localhost:3000`                         | `localhost:3001` (static build served locally) | dev                 | dev            | feature branches                        |
| dev/staging | Vercel admin project, preview/dev domain | Vercel web project, preview/dev domain         | dev                 | dev            | `dev` (or preview deployments) **[NV]** |
| prod        | Vercel admin project, production domain  | Vercel web project, production domain          | prod                | prod           | `main`                                  |

All environments run on **Vercel Hobby (free)**, default `*.vercel.app` domains, a free consumer Google account, and GitHub Free. Vercel builds only `main` and `dev`; preview deployments for feature branches are disabled to protect the deployment budget (§19.4).

Dev and prod MUST use different spreadsheets, Drive folders, GAS deployments, HMAC secrets, OAuth redirect URIs, and GitHub target branches. The Executor confirms the concrete staging mechanism (separate branch vs. separate Vercel projects) in ADR-003.

### 8.2 Secret and config inventory

| Name                                    | Where                 | Secret       | Purpose                                                                                                                                                                             |
| --------------------------------------- | --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                           | admin                 | yes          | Auth.js cookie/JWT signing                                                                                                                                                          |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | admin                 | yes (secret) | Google OAuth client                                                                                                                                                                 |
| `ADMIN_EMAILS`                          | admin                 | private      | Comma-separated allowlist. MVP value: the owner's Google account only (G5). **Never** written to the repo, docs, fixtures, screenshots, or logs; tests use `@example.com` addresses |
| `ADMIN_URL`                             | admin                 | no           | Origin check, callbacks                                                                                                                                                             |
| `GAS_WEBAPP_URL`                        | admin                 | private      | RPC endpoint                                                                                                                                                                        |
| `GAS_HMAC_SECRET`                       | admin                 | yes          | RPC signing (≥ 32 random bytes, base64)                                                                                                                                             |
| `GITHUB_TOKEN`                          | admin                 | yes          | Fine-grained PAT: one repo, contents RW, commit statuses R                                                                                                                          |
| `GITHUB_REPO` / `GITHUB_BRANCH`         | admin                 | no           | Publish target                                                                                                                                                                      |
| `PUBLIC_SITE_URL`                       | admin, web            | no           | Canonicals, verification                                                                                                                                                            |
| `HMAC_SECRET`                           | GAS Script Properties | yes          | Same value as `GAS_HMAC_SECRET`                                                                                                                                                     |
| `MEDIA_FOLDER_ID`                       | GAS Script Properties | private      | Drive upload destination                                                                                                                                                            |
| `ENVIRONMENT`                           | GAS Script Properties | no           | `dev` / `prod`; shown in health check                                                                                                                                               |
| `SITE_URL`                              | web (build)           | no           | Same as `PUBLIC_SITE_URL`                                                                                                                                                           |

Because the repository is public from day 1, the following are also treated as **private configuration** and are never committed: GAS web-app URL, script ID (`.clasp.json` is gitignored; only `.clasp.json.example` is committed), deployment IDs, spreadsheet and Drive folder IDs, OAuth client ID, Vercel project/team IDs, admin email(s).

`.env.example` lists names and descriptions only. Secrets live in Vercel env (encrypted), GAS Script Properties, the owner's password manager, and — only if a CI job needs them — GitHub Actions secrets scoped to an environment with required reviewers.

---

## 9. Data model (Google Sheets)

### 9.1 General rules

- One spreadsheet per environment; header row 1 is the contract; columns resolved **by header name**.
- All data columns formatted as plain text (`@`) by the setup action.
- IDs: UUID v4. Timestamps: UTC ISO 8601 with milliseconds (`2026-11-21T10:15:30.123Z`). Booleans: `TRUE`/`FALSE` strings. JSON columns: compact JSON strings.
- Rows are never physically deleted or reordered in MVP. Soft delete via `deleted_at`.
- Every mutation runs inside a script lock (§9.4).

### 9.2 Sheets and columns

**`_Meta`** — `key`, `value`. Keys: `schema_version` (integer, starts at `1`), `installed_at`, `environment`.

**`Posts`**

| Column                      | Type        | Rules                                                         | In snapshot         |
| --------------------------- | ----------- | ------------------------------------------------------------- | ------------------- |
| `id`                        | uuid        | immutable                                                     | yes                 |
| `title`                     | string      | 1–200 chars                                                   | yes                 |
| `slug`                      | string      | §12.1                                                         | yes                 |
| `content_markdown`          | string      | ≤ 40,000 chars                                                | yes (as `markdown`) |
| `excerpt`                   | string      | ≤ 500 chars; auto-derived from body if empty at snapshot time | yes                 |
| `status`                    | enum        | `draft`/`published`/`archived`                                | no (implicit)       |
| `author_name`               | string      | ≤ 100; default from settings                                  | yes                 |
| `category_id`               | uuid?       | must exist, not deleted                                       | yes (resolved)      |
| `tag_ids`                   | json uuid[] | ≤ 20; each exists                                             | yes (resolved)      |
| `cover_media_id`            | uuid?       | must exist                                                    | yes (resolved)      |
| `seo_title`                 | string      | ≤ 200 (warn > 70)                                             | yes                 |
| `seo_description`           | string      | ≤ 500 (warn > 160)                                            | yes                 |
| `created_at` / `updated_at` | ISO         | server-set                                                    | `updated_at` yes    |
| `created_by` / `updated_by` | email       | server-set from signed actor                                  | **never**           |
| `published_at`              | ISO?        | set on first publish; admin MAY edit                          | yes                 |
| `deleted_at`                | ISO?        | soft delete                                                   | no                  |
| `version`                   | int         | +1 per write                                                  | no                  |

**`Pages`** — same as `Posts` minus `excerpt`, `author_name`, `category_id`, `tag_ids`, `cover_media_id`; plus `nav_order` (int?, pages with a value appear in the header navigation, ascending).

**`Categories`** / **`Tags`** — `id`, `name` (1–60), `slug`, `description` (≤ 300), `created_at`, `updated_at`, `deleted_at`, `version`.

**`Media`** — `id`, `drive_file_id`, `filename` (sanitized), `mime_type`, `size_bytes`, `width`, `height` (if cheaply detectable, else empty), `sha256`, `alt_text` (≤ 300), `created_at`, `created_by`, `deleted_at`, `version`.

**`Settings`** — `key`, `value_json`, `is_public`, `updated_at`, `updated_by`.

| Key                     | Type     | Public         | Default       |
| ----------------------- | -------- | -------------- | ------------- |
| `site_title`            | string   | yes            | `ZidCMS Site` |
| `site_description`      | string   | yes            | `""`          |
| `site_language`         | BCP-47   | yes            | `en`          |
| `posts_per_page`        | int 1–50 | yes            | `10`          |
| `default_author_name`   | string   | yes            | `""`          |
| `social_image_media_id` | uuid?    | yes (resolved) | null          |
| `footer_text`           | string   | yes            | `""`          |

**`Revisions`** — `id`, `content_type` (`post`/`page`), `content_id`, `version`, `title`, `content_markdown`, `meta_json` (other fields, ≤ 40,000 chars), `created_at`, `created_by`.

**`PublishJobs`** — `id`, `type` (`publish`/`rollback`), `idempotency_key`, `requested_by`, `state` (§13.4), `target_version` (rollback only), `snapshot_version`, `checksum`, `rerun_requested`, `lease_expires_at`, `step_attempts`, `git_commit_sha`, `created_at`, `updated_at`, `finished_at`, `error_code`, `error_message` (sanitized, ≤ 500).

**`Snapshots`** — `version` (int, monotonic), `checksum`, `git_commit_sha`, `item_count`, `media_count`, `status` (`committed`/`live`/`failed`/`superseded`), `source_job_id`, `based_on_version` (rollbacks), `created_at`, `created_by`.

**`AuditLog`** — `id`, `at`, `actor`, `action`, `entity_type`, `entity_id`, `request_id`, `result` (`ok`/error code), `detail` (≤ 300, no content bodies).

### 9.3 Integrity rules

| Risk                           | Rule                                                                                      | Test                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 50,000-char cell limit **[V]** | Field limits in §9.2 enforced in admin and GAS                                            | TC-DATA-04                                                                                                 |
| Auto type coercion             | Plain-text format on data columns                                                         | TC-DATA-01: `"2026-01-01"`, `"001"`, `"TRUE"`, `"1e5"`, `"12:30"` round-trip unchanged                     |
| Formula injection              | Values starting `=`, `+`, `-`, `@` must never evaluate                                    | TC-DATA-02 **[NV]**: decide if plain-text format suffices or an escape prefix + unescape on read is needed |
| Manual edits                   | Read path validates rows; invalid rows reported in `system.health`, skipped from snapshot | TC-DATA-05                                                                                                 |
| Lost updates                   | `expected_version` check under lock                                                       | TC-CONC-01                                                                                                 |
| Slug duplicates                | Uniqueness check under lock                                                               | TC-CONC-02                                                                                                 |
| Migration damage               | Setup is idempotent; Drive copy of spreadsheet before any schema change                   | TC-DATA-06                                                                                                 |

### 9.4 Write algorithm (GAS)

```text
lock = LockService.getScriptLock(); lock.waitLock(10000)  → else LOCK_TIMEOUT
try:
  rows = sheet.getDataRange().getValues()          # one read
  idx  = findById(rows, id)                        # NOT_FOUND if absent or deleted
  if row.version != expected_version → VERSION_CONFLICT {current_version}
  validate(input); checkSlugUnique(rows, slug, id) # SLUG_CONFLICT
  newRow = merge(row, input, updated_at, updated_by, version+1)
  sheet.getRange(idx+2, 1, 1, cols).setValues([newRow])   # one write
  appendRow(Revisions, ...); appendRow(AuditLog, ...)
  SpreadsheetApp.flush()
finally:
  lock.releaseLock()
```

Reads (list/get) do not take the lock. List responses omit `content_markdown`.

---

## 10. Admin ↔ Apps Script RPC specification

### 10.1 Transport

- `POST ${GAS_WEBAPP_URL}` with `Content-Type: application/json`; client follows redirects (fetch converts the 302 to GET per spec **[A, NV]**).
- Request body (raw):

```json
{ "e": "<envelope JSON string>", "s": "<hex HMAC-SHA256 of e>" }
```

- Envelope (inside the string):

```json
{
  "v": 1,
  "action": "posts.update",
  "payload": { "id": "…", "expected_version": 3, "patch": { "title": "…" } },
  "ts": 1763720130123,
  "nonce": "b64url-16-bytes",
  "actor": "admin@example.com",
  "requestId": "uuid"
}
```

Signing the exact string avoids JSON canonicalization bugs.

### 10.2 GAS verification order (fail fast, cheapest first)

1. Body ≤ 5 MB **[A]**, parses, has `e` and `s` → else `BAD_REQUEST`.
2. `HMAC-SHA256(HMAC_SECRET, e)` via `Utilities.computeHmacSha256Signature(e, key, Utilities.Charset.UTF_8)` → hex; constant-time compare → else `SIGNATURE_INVALID`.
3. Parse envelope; `v === 1`; `|now − ts| ≤ 300000 ms` → else `REQUEST_EXPIRED`.
4. Nonce not in `CacheService.getScriptCache()`; store with TTL 600 s → else `REPLAY_DETECTED`.
5. `action` ∈ allowlist and enabled for `ENVIRONMENT` → else `UNKNOWN_ACTION`.
6. `actor` is a syntactically valid email (authorization already done by admin; GAS records it).
7. Payload validation → `VALIDATION_ERROR`.

Security-relevant rejections (2–5) are logged with `requestId` and reason only.

### 10.3 Response envelope (always HTTP 200)

```json
{ "ok": true,  "data": { }, "requestId": "uuid", "ms": 812 }
{ "ok": false, "error": { "code": "VERSION_CONFLICT", "message": "…", "details": { "current_version": 4 }, "retryable": false }, "requestId": "uuid" }
```

The admin client treats non-200, non-JSON, or HTML responses (Google error pages) as `UPSTREAM_ERROR` (retryable).

### 10.4 Action catalog

| Action                                                  | Lock          | Payload (summary)                                         | Returns                                                                              |
| ------------------------------------------------------- | ------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `system.health`                                         | no            | —                                                         | env, schema_version, invalid row count                                               |
| `system.setup`                                          | yes           | —                                                         | created sheets/columns; disabled in prod after first run                             |
| `posts.list`                                            | no            | `status?`, `q?`, `cursor?`, `limit≤50`, `includeDeleted?` | items (no body), nextCursor                                                          |
| `posts.get`                                             | no            | `id`                                                      | full item                                                                            |
| `posts.create`                                          | yes           | fields                                                    | item                                                                                 |
| `posts.update`                                          | yes           | `id`, `expected_version`, `patch`                         | item                                                                                 |
| `posts.setStatus`                                       | yes           | `id`, `expected_version`, `to`                            | item, `publishRequired`                                                              |
| `posts.softDelete` / `posts.restore`                    | yes           | `id`, `expected_version`                                  | item, `publishRequired`                                                              |
| `posts.revisions`                                       | no            | `id`                                                      | revision metadata list                                                               |
| `pages.*`                                               | as posts      | as posts                                                  | P1                                                                                   |
| `taxonomy.list/create/update/softDelete`                | as posts      | `kind: category                                           | tag`                                                                                 | P1  |
| `media.upload`                                          | yes           | `filename`, `mime`, `sha256`, `base64`, `alt_text`        | media item (dedupe by sha256)                                                        |
| `media.list` / `media.update`                           | no / yes      | — / `alt_text`                                            | P1                                                                                   |
| `media.getBytes`                                        | no            | `id`                                                      | `base64`, `mime`, `sha256`                                                           |
| `settings.get` / `settings.update`                      | no / yes      | keys                                                      | settings                                                                             |
| `publish.acquire`                                       | yes           | `type`, `idempotency_key`, `target_version?`              | job, `coalesced`                                                                     |
| `publish.getJob` / `publish.listJobs`                   | no            | `id` / `limit`                                            | job(s)                                                                               |
| `publish.updateJob`                                     | yes           | `id`, `from_state`, `to_state`, fields                    | job (compare-and-set on state)                                                       |
| `publish.readPublished`                                 | no            | —                                                         | all published, non-deleted posts/pages + taxonomy + public settings + media metadata |
| `snapshots.record` / `snapshots.list` / `snapshots.get` | yes / no / no | —                                                         | snapshot rows                                                                        |

### 10.5 Client (admin) behavior

- Timeout 30 s; retry only `retryable` errors and transport failures, max 2 retries with jitter, **reads only** — mutations are not auto-retried (they are not idempotent at the GAS level).
- One RPC per screen load or mutation; Server Components call the client directly (no hop through the admin's own HTTP API).

---

## 11. Admin HTTP API specification

Used by client components; all JSON; all require `requireAdmin()`; mutations require Origin check. Types from `@zidcms/core`.

| Method    | Route                                    | Body / query                        | Success                              | Priority |
| --------- | ---------------------------------------- | ----------------------------------- | ------------------------------------ | -------- |
| GET       | `/api/posts`                             | `status, q, cursor, limit`          | 200 list                             | P0       |
| POST      | `/api/posts`                             | fields                              | 201 item                             | P0       |
| GET       | `/api/posts/:id`                         | —                                   | 200 item                             | P0       |
| PATCH     | `/api/posts/:id`                         | `expected_version`, patch           | 200 item                             | P0       |
| POST      | `/api/posts/:id/status`                  | `to`, `expected_version`            | 200 item + `publishJob?`             | P0       |
| DELETE    | `/api/posts/:id`                         | `expected_version`                  | 200 item + `publishJob?`             | P0       |
| POST      | `/api/posts/:id/restore`                 | `expected_version`                  | 200 item                             | P0       |
| GET       | `/api/posts/:id/revisions`               | —                                   | 200 list                             | P1       |
| *         | `/api/pages[/:id[/status                 | /restore]]`                         | as posts                             |          | P1  |
| *         | `/api/categories[...]`, `/api/tags[...]` |                                     |                                      | P1       |
| GET/POST  | `/api/media`                             | multipart `file`, `alt_text`        | 201 item                             | P1       |
| PATCH     | `/api/media/:id`                         | `alt_text`, `expected_version`      | 200                                  | P1       |
| GET       | `/api/media/:id/preview`                 | —                                   | image bytes (admin only, for picker) | P1       |
| GET/PATCH | `/api/settings`                          | keys                                | 200                                  | P0       |
| POST      | `/api/publish`                           | `idempotency_key`                   | 202 job                              | P0       |
| GET       | `/api/publish/:jobId`                    | —                                   | 200 job (advances one step)          | P0       |
| GET       | `/api/publish`                           | —                                   | jobs + snapshots                     | P0       |
| POST      | `/api/publish/rollback`                  | `target_version`, `idempotency_key` | 202 job                              | P0       |
| GET       | `/api/health`                            | —                                   | admin + GAS health (admin only)      | P0       |

**Error mapping**

| Code                                                                           | HTTP                                | Retryable |
| ------------------------------------------------------------------------------ | ----------------------------------- | --------- |
| `UNAUTHENTICATED`                                                              | 401                                 | no        |
| `FORBIDDEN`                                                                    | 403                                 | no        |
| `BAD_REQUEST` / `VALIDATION_ERROR`                                             | 400                                 | no        |
| `NOT_FOUND`                                                                    | 404                                 | no        |
| `SLUG_CONFLICT` / `VERSION_CONFLICT` / `INVALID_TRANSITION`                    | 409                                 | no        |
| `PUBLISH_IN_PROGRESS`                                                          | 202 (returns existing job)          | n/a       |
| `PAYLOAD_TOO_LARGE`                                                            | 413                                 | no        |
| `UNSUPPORTED_MEDIA_TYPE`                                                       | 415                                 | no        |
| `LOCK_TIMEOUT`                                                                 | 503                                 | yes       |
| `UPSTREAM_ERROR`                                                               | 502                                 | yes       |
| `SIGNATURE_INVALID` / `REQUEST_EXPIRED` / `REPLAY_DETECTED` / `UNKNOWN_ACTION` | 500 (config/security fault; logged) | no        |

Error body: `{ "error": { "code", "message", "details?", "requestId" } }`. Messages are user-readable and never include stack traces or secrets.

---

## 12. Content rules

### 12.1 Slugs

- Auto-generated from title (NFKD normalize, strip diacritics, lowercase, non-alnum → `-`, collapse/trim dashes), editable.
- Pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–100 chars.
- Unique per namespace among non-deleted rows (archived rows still reserve their slug).
- Namespaces: posts `/blog/<slug>/`, pages `/<slug>/`, categories `/category/<slug>/`, tags `/tag/<slug>/`.
- Reserved page slugs: `blog`, `category`, `tag`, `page`, `media`, `api`, `admin`, `content`, `search`, `feed`, `rss`, `sitemap.xml`, `robots.txt`, `404`, `_next`, `zidcms-version.json`, `favicon.ico`.
- Changing the slug of a published item breaks old URLs (no redirects in MVP) — UI warns.

### 12.2 Markdown

- CommonMark + GFM (tables, strikethrough, task lists, autolinks).
- Raw HTML is **not** rendered (escaped). `rehype-sanitize` with a strict schema as defense in depth.
- Links: `javascript:`, `data:`, `vbscript:` schemes stripped; external links get `rel="noopener noreferrer"`.
- Headings get stable ids for anchors.
- Images: only `zid-media:<mediaId>` references (§12.3) or absolute `https://` URLs (P1 setting `allow_external_images`, default false → external images rendered as links).

### 12.3 Media references

- Editor inserts `![alt text](zid-media:<mediaId>)`.
- At snapshot build, each reference is resolved to `/media/<sha256>.<ext>` and alt text falls back to `Media.alt_text`.
- Unknown or deleted media ids → publish fails with `VALIDATION_ERROR` listing offending items (never publishes a broken page silently).
- Admin preview resolves to `/api/media/:id/preview`.

### 12.4 Limits summary

Title 200 · slug 100 · excerpt 500 · body 40,000 · SEO title 200 · SEO description 500 · tags per post 20 · media 3 MB · filename 120 · alt text 300.

---

## 13. Publishing model

### 13.1 Semantics

- `status` is editorial intent; the **live site** is the latest `live` snapshot.
- Saving a draft never affects the public site.
- _Publish_ (draft → published) and _Update_ (saving an already published item) each record the change and start or coalesce a publish job.
- Unpublish, archive, delete, and restore of a published item also start a publish job.
- Settings and taxonomy changes do not auto-publish; the UI shows "Changes pending publish" and a Publish site button.
- To work privately on a live post, unpublish it first. This is a documented MVP limitation (P2: separate published-revision pointer).

### 13.2 Status transitions

| From → To                      | Allowed                                 | Side effects                         | Starts publish   |
| ------------------------------ | --------------------------------------- | ------------------------------------ | ---------------- |
| draft → published              | yes                                     | `published_at` set if empty          | yes              |
| published → published (Update) | yes                                     | —                                    | yes              |
| published → draft              | yes                                     | —                                    | yes              |
| published → archived           | yes                                     | —                                    | yes              |
| draft → archived               | yes                                     | —                                    | no               |
| archived → draft               | yes                                     | —                                    | no               |
| archived → published           | no (`INVALID_TRANSITION`; go via draft) | —                                    | —                |
| any → deleted                  | yes                                     | `deleted_at` set                     | if was published |
| deleted → restore              | yes                                     | `deleted_at` cleared, status → draft | no               |

### 13.3 Live-state indicator (admin)

Computed by comparing the item's `updated_at`/status with the latest live snapshot's `generatedAt` and item list: **Live**, **Live – pending update**, **Pending publish**, **Not live**, **Removal pending**.

### 13.4 Publish job state machine

```text
queued → collecting → committing → deploying → verifying → live
   └──────────────┴──────────┴───────────┴────────────→ failed
```

| State        | Step performed on next poll                                                                                                           | Success →                          | Failure handling                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `queued`     | —                                                                                                                                     | `collecting`                       | —                                                                                                                                    |
| `collecting` | `publish.readPublished`; validate; resolve media; `buildSnapshot()`; checksum. If checksum == current live checksum → `live` (no-op). | `committing`                       | Validation errors → `failed` with item list                                                                                          |
| `committing` | Fetch new media bytes (only sha256 not already in the target tree); create commit; `snapshots.record(status=committed)`               | `deploying`                        | GitHub errors retried ≤ 3 per step, then `failed`                                                                                    |
| `deploying`  | Read commit status/deployment for SHA; expose Vercel's queued/building sub-state in the UI                                            | `verifying` when success           | Vercel failure → `failed` (`DEPLOY_FAILED`); > 15 min (Hobby builds queue, 1 concurrent build **[V]**) → `failed` (`DEPLOY_TIMEOUT`) |
| `verifying`  | GET `zidcms-version.json` (cache-busted)                                                                                              | `live` when version+checksum match | > 3 min mismatch → `failed` (`VERIFY_TIMEOUT`)                                                                                       |
| `live`       | Snapshot → `live`, previous live → `superseded`; if `rerun_requested` create a follow-up job                                          | terminal                           | —                                                                                                                                    |
| `failed`     | Snapshot (if any) → `failed`; last live snapshot untouched                                                                            | terminal                           | UI shows Retry (new job)                                                                                                             |

**Rules**

- `publish.acquire` under lock: an active job with a valid lease → set `rerun_requested`, return it (`coalesced: true`); same `idempotency_key` → return the existing job; otherwise create a job with a 10-minute lease.
- Each poll: compare-and-set state transition via `publish.updateJob(from_state, to_state)`; lost race → just return current state. Lease extended on each successful step.
- Expired lease → any poll or new publish request resumes the job from its current state.
- Admin UI polls every 3 s while the job tab is open; the job continues on the next poll if the tab closes.

### 13.5 Rollback

- `POST /api/publish/rollback { target_version }` → job `type=rollback`.
- `collecting` loads `snapshot.json` from the target snapshot's commit (`git_commit_sha`) instead of Sheets; it is re-stamped with a **new** version (history is append-only) and `based_on_version`.
- Media for the rollback commit reuse blob SHAs from the target commit's tree (no re-download).
- Rollback does not modify item `status` in Sheets; affected items show a mismatch indicator.
- Manual emergency path: Vercel dashboard Instant Rollback, documented in runbook R1.

---

## 14. Snapshot format

### 14.1 `apps/web/content/snapshot.json`

```json
{
  "schema": "zidcms.snapshot/1",
  "version": 12,
  "basedOnVersion": null,
  "generatedAt": "2026-11-21T10:15:30.123Z",
  "checksum": "sha256:…",
  "site": {
    "title": "…",
    "description": "…",
    "language": "en",
    "url": "https://…",
    "postsPerPage": 10,
    "footerText": "…",
    "socialImage": "/media/<sha>.jpg"
  },
  "posts": [
    {
      "id": "…",
      "slug": "…",
      "title": "…",
      "excerpt": "…",
      "markdown": "…",
      "authorName": "…",
      "publishedAt": "…",
      "updatedAt": "…",
      "category": { "slug": "…", "name": "…" },
      "tags": [{ "slug": "…", "name": "…" }],
      "cover": { "src": "/media/<sha>.webp", "alt": "…", "width": 1200, "height": 630 },
      "seo": { "title": "…", "description": "…" }
    }
  ],
  "pages": [{ "id": "…", "slug": "…", "title": "…", "markdown": "…", "navOrder": 1, "updatedAt": "…", "seo": {} }],
  "categories": [{ "slug": "…", "name": "…", "description": "…" }],
  "tags": [{ "slug": "…", "name": "…", "description": "…" }],
  "media": [{ "sha256": "…", "path": "/media/<sha>.webp", "mime": "image/webp" }]
}
```

- Built only by `buildSnapshot()` in `@zidcms/core` using explicit field mapping (allowlist), never object spread of rows.
- Arrays sorted deterministically (posts by `publishedAt` desc then `id`; others by slug).
- `checksum` = sha256 of the canonical JSON of the snapshot **excluding** `version`, `basedOnVersion`, `generatedAt`, `checksum` → identical content yields identical checksum (no-op detection).
- Markdown stays unrendered; `zid-media:` references are already rewritten to `/media/...` paths.

### 14.2 `apps/web/public/zidcms-version.json`

`{ "version": 12, "checksum": "sha256:…", "generatedAt": "…" }` — public, cache-busted by query string during verification.

### 14.3 Media in the build

- `apps/web/public/media/` mirrors exactly the set referenced by the snapshot (unreferenced files are removed in the same commit), so unpublished media do not stay reachable on the live site. Old blobs remain in Git history.

### 14.4 Empty snapshot

The repository ships an initial snapshot with `version: 0` and empty arrays so `apps/web` builds on a fresh install.

---

## 15. Public site specification

### 15.1 Routes

| Route                  | Content                                                                          | Priority |
| ---------------------- | -------------------------------------------------------------------------------- | -------- |
| `/`                    | Site title/description, first page of posts (cards: title, excerpt, date, cover) | P0       |
| `/page/[n]/`           | Pagination (n ≥ 2)                                                               | P0       |
| `/blog/[slug]/`        | Post detail                                                                      | P0       |
| `/[slug]/`             | Page detail                                                                      | P1       |
| `/category/[slug]/`    | Posts in category (paginated if needed)                                          | P1       |
| `/tag/[slug]/`         | Posts with tag                                                                   | P1       |
| `/404` (`not-found`)   | Not found page                                                                   | P0       |
| `/sitemap.xml`         | All public URLs with `lastmod`                                                   | P0       |
| `/robots.txt`          | Allow all + sitemap link                                                         | P0       |
| `/zidcms-version.json` | Version stamp                                                                    | P0       |

### 15.2 Metadata

- `<title>`: `seo.title || title` + `–` + site title; home uses site title.
- `description`: `seo.description || excerpt || site description`.
- Canonical: `${SITE_URL}` + route with trailing slash.
- Open Graph: `og:title`, `og:description`, `og:type` (`article` for posts), `og:url`, `og:image` (cover or site social image); `article:published_time`, `article:modified_time`.
- `<html lang>` from settings.

### 15.3 Quality bars

- Semantic HTML, accessible landmarks, alt text required for images in published content (publish warns if missing).
- No client-side JavaScript required to read content (Next.js runtime JS is acceptable but content is in the HTML).
- Lighthouse (mobile) on a sample post: Performance, Accessibility, SEO, Best Practices ≥ 90 **[target]**.
- Minimal, neutral default theme branded "Powered by ZidCMS" in the footer.

---

## 16. Admin dashboard specification

### 16.1 Screens

| Route                       | Purpose             | Key elements                                                                                                                                                                                     | Priority |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `/login`                    | Sign in             | "Sign in with Google", error for non-allowlisted                                                                                                                                                 | P0       |
| `/`                         | Dashboard           | Counts by status, latest publish job, live version, "Publish site"                                                                                                                               | P0       |
| `/posts`                    | List                | Status tabs (All/Draft/Published/Archived/Trash), search, live-state badges, pagination                                                                                                          | P0       |
| `/posts/new`, `/posts/[id]` | Editor              | Title, slug (auto + edit), Markdown textarea with preview toggle, excerpt, author, SEO panel with length counters, category/tags (P1), cover image (P1), status actions, version conflict dialog | P0       |
| `/preview/posts/[id]`       | Full-page preview   | Uses public site styles + `renderMarkdown()`, banner "Preview – not published", `noindex`                                                                                                        | P0       |
| `/pages`, `/pages/[id]`     | Pages               | Same editor, nav order                                                                                                                                                                           | P1       |
| `/taxonomy`                 | Categories and tags | Inline create/rename/delete                                                                                                                                                                      | P1       |
| `/media`                    | Library             | Upload (drag/drop optional), grid, alt text edit, copy reference                                                                                                                                 | P1       |
| `/publish`                  | Publishing          | Job timeline with states and timestamps, snapshot history, rollback button per version, retry                                                                                                    | P0       |
| `/settings`                 | Site settings       | §9.2 keys                                                                                                                                                                                        | P0       |

### 16.2 UX rules

- Primary buttons by status: Draft → **Save draft**, **Publish**; Published → **Update** (with note "Updating publishes immediately"), **Unpublish**; Archived → **Move to draft**.
- Unsaved-changes guard on navigation.
- `VERSION_CONFLICT` → dialog: "This post was changed elsewhere" with options _Reload (discard mine)_ or _Copy my content to clipboard_; no silent merge.
- Every action shows pending state (GAS latency is seconds); disable double-submit.
- Freshness notice next to Publish: "Changes go live after the publish job reaches Live (usually a few minutes)."
- Environment badge (`DEV`/`PROD`) always visible.
- Responsive down to 375 px width; keyboard accessible; visible focus states.

---

## 17. Security specification and threat model

### 17.1 Controls

1. **AuthN/AuthZ:** ADR-002; `requireAdmin()` in every handler; allowlist re-read from env per request.
2. **GAS boundary:** §10.2; negative tests in the integration suite.
3. **CSRF:** SameSite=Lax + Origin check on all mutations; no state-changing GET.
4. **XSS:** §12.2 renderer; React escaping; no `dangerouslySetInnerHTML` except renderer output; CSP on admin (`default-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'`, adjusted for Auth.js and Next.js needs **[NV]**) and on the public site via `vercel.json` headers.
5. **Headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (admin), HSTS via Vercel.
6. **Uploads:** magic-byte sniffing, allowlist, size cap, sanitized filename, sha256 dedupe, never public in Drive.
7. **Snapshot privacy:** allowlist builder + key-set test (TC-SEC-06) + publish-time assertion that no value matches an email regex outside `authorName`.
8. **Secrets:** §8.2; bundle scan in CI (TC-SEC-07); no secrets in logs (log redaction helper). Public-repo hygiene: GitHub secret scanning + push protection enabled (free for public repos **[A, NV]**); `.gitignore` covers `.env*` (except `.env.example`), `.clasp.json`, `.clasprc.json`, `tests/load/results/*.har`; CI never runs workflows with secrets on pull requests from forks; issues/PRs/daily reports never contain private configuration (§8.2). Any accidental commit of a secret → rotate immediately (history rewrite alone is insufficient once public).
9. **Supply chain:** lockfile, exact versions, packages ≥ 7 days old, `pnpm audit` in CI (non-blocking report), no postinstall scripts from unknown packages.
10. **Least privilege:** GAS scopes (ADR-006), single-repo PAT, separate dev/prod resources.
11. **Audit:** every mutation and publish/rollback writes `AuditLog`.

### 17.2 Threat model (STRIDE-lite)

| #   | Threat                     | Vector                         | Control                                                    | Test         |
| --- | -------------------------- | ------------------------------ | ---------------------------------------------------------- | ------------ |
| T1  | Spoofed write to GAS       | Attacker POSTs to GAS URL      | HMAC signature                                             | TC-GAS-02    |
| T2  | Replay of captured request | Re-send a valid body           | ts window + nonce cache                                    | TC-GAS-04/05 |
| T3  | Tampered payload           | Modify body                    | Signature covers envelope                                  | TC-GAS-03    |
| T4  | Non-admin access           | Other Google account signs in  | Allowlist + `email_verified`                               | TC-AUTH-02   |
| T5  | CSRF                       | Cross-site form post           | SameSite + Origin                                          | TC-AUTH-05   |
| T6  | Stored XSS                 | Malicious Markdown             | Sanitizing renderer, CSP                                   | TC-SEC-01    |
| T7  | Draft/PII leak             | Snapshot builder bug           | Allowlist + key-set test                                   | TC-SEC-06    |
| T8  | Secret leak in bundle      | `NEXT_PUBLIC_` misuse          | Bundle scan                                                | TC-SEC-07    |
| T9  | Malicious upload           | SVG/script/polyglot            | Magic bytes, no SVG                                        | TC-SEC-03    |
| T10 | Formula injection          | `=IMPORTXML(...)` in title     | Plain-text cells / escaping                                | TC-DATA-02   |
| T11 | Site defacement via token  | Leaked `GITHUB_TOKEN`          | Single-repo PAT, rotation R7                               | runbook      |
| T12 | GAS quota exhaustion       | Flood of junk requests         | Server-only URL, cheap rejection; documented residual risk | —            |
| T13 | Lost update                | Concurrent edits               | Version check under lock                                   | TC-CONC-01   |
| T14 | Duplicate publish          | Double click / parallel admins | Idempotency key + coalescing                               | TC-PUB-04    |

---

## 18. Testing strategy and test case catalog

### 18.1 Levels

| Level       | Scope                                                           | Where                                    | Gate                 |
| ----------- | --------------------------------------------------------------- | ---------------------------------------- | -------------------- |
| Unit        | `@zidcms/core`                                                  | CI on every PR                           | Required             |
| Contract    | GAS dispatcher + actions on in-memory stores                    | CI                                       | Required             |
| Admin unit  | `requireAdmin`, Origin check, error mapping, RPC client signing | CI                                       | Required             |
| Integration | Real dev GAS + dev sheet                                        | Local / manual workflow with dev secrets | Day 5 exit           |
| E2E         | Playwright on staging                                           | Manual workflow                          | Day 5 and Day 7 exit |
| Security    | §17 tests                                                       | CI + integration                         | Day 5 exit           |
| Load        | §21                                                             | Manual                                   | Day 6                |

Integration and load tests MUST NOT target prod data.

### 18.2 Test case catalog (minimum)

**Auth** — TC-AUTH-01 allowlisted sign-in works · 02 non-allowlisted rejected · 03 unauthenticated API → 401 for every route (generated matrix) · 04 sign-out clears session · 05 mutation with foreign Origin → 403.

**GAS protocol** — TC-GAS-01 valid signed call succeeds · 02 missing/invalid signature rejected · 03 tampered envelope rejected · 04 expired ts rejected · 05 replayed nonce rejected · 06 unknown action rejected · 07 oversize body rejected · 08 sheet unchanged after 02–07.

**Data** — TC-DATA-01 type-coercion round trip · 02 formula-injection round trip · 03 Unicode/emoji round trip · 04 field limits enforced (49,999/50,001 chars) · 05 manually corrupted row reported and excluded · 06 setup idempotent (run twice, no duplicate columns) · 07 soft delete hides from list, restore works.

**Concurrency** — TC-CONC-01 10 parallel updates at same version → exactly 1 success, 9 `VERSION_CONFLICT` · 02 parallel creates with same slug → 1 success · 03 lock timeout surfaces `LOCK_TIMEOUT` (simulated).

**Publish** — TC-PUB-01 draft never in snapshot · 02 publish → live with matching version file · 03 update → new version, content changed · 04 parallel publish requests → one job, `rerun_requested` set · 05 same idempotency key → same job · 06 unchanged content → no-op live without commit · 07 broken build → `failed`, old version still served · 08 rollback → new version equals target content · 09 job resumes after lease expiry · 10 unknown media reference fails publish with clear error · 11 unpublish removes post and its exclusive media from site.

**Security** — TC-SEC-01 XSS corpus (script tags, event handlers, `javascript:` links, HTML entities, nested Markdown/HTML) renders inert · 02 CSP headers present · 03 SVG/polyglot/oversize uploads rejected · 04 client cannot pass sheet/Drive/repo identifiers (schema rejects unknown keys) · 05 error responses contain no stack traces · 06 snapshot key-set exactly matches allowlist; no `created_by`/`updated_by`/emails · 07 bundle secret scan.

**Public site** — TC-WEB-01 build with empty snapshot · 02 build output contains no functions · 03 metadata/canonical/OG correct · 04 sitemap lists all and only published URLs · 05 unknown slug → 404 page · 06 HAR shows only Vercel-domain requests.

**E2E** — TC-E2E-01 full demo scenario §24.3.

---

## 19. CI/CD and deployment

### 19.1 Workflows

| Workflow          | Trigger                                                                                                                      | Steps                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ci.yml`          | PR, push to `main`/`dev`; `paths-ignore: apps/web/content/**, apps/web/public/media/**, apps/web/public/zidcms-version.json` | install (frozen lockfile) → lint → typecheck → unit + contract → build admin, web, GAS bundle → bundle secret scan |
| `integration.yml` | `workflow_dispatch`                                                                                                          | Runs integration suite against dev GAS (environment secrets with required reviewer)                                |
| `e2e.yml`         | `workflow_dispatch`                                                                                                          | Playwright against staging URLs; uploads report artifact                                                           |

GAS deployment is performed by the Executor locally with clasp for MVP (clasp credentials are not stored in CI) and documented in `docs/deployment.md`.

### 19.2 GAS deployment procedure

1. `pnpm --filter @zidcms/apps-script build` → `dist/Code.js` + `appsscript.json`.
2. `clasp push` to the dev script.
3. `clasp deploy -i <DEV_DEPLOYMENT_ID> -d "<git sha>"` (same deployment id → stable URL).
4. Run `system.health` via `scripts/poc/hmac-call.ts`; record output.
5. Repeat for prod only with owner approval.

### 19.3 Vercel configuration

- Two projects from the same repo: root `apps/admin` and root `apps/web`.
- Admin `ignoreCommand`: skip builds when only content paths changed (e.g. `git diff --quiet HEAD^ HEAD -- apps/admin packages pnpm-lock.yaml`) **[NV]**.
- Web project builds on any change under `apps/web` or `packages/core`.
- Env vars per environment exactly as §8.2.
- Disable deployments for branches other than `main` and `dev` (e.g. `git.deploymentEnabled` in `vercel.json`) **[NV]**.

### 19.4 Vercel Hobby budget ($0)

| Limit (Hobby)                | Value                  | Source      | Plan impact                                                                       |
| ---------------------------- | ---------------------- | ----------- | --------------------------------------------------------------------------------- |
| Deployments created per day  | 100                    | **[V]**     | Shared by code pushes and publishes; skipped monorepo builds do not count **[V]** |
| Concurrent builds            | 1                      | **[V]**     | Builds queue; deploy timeout 15 min                                               |
| Build time per deployment    | 45 min                 | **[V]**     | Ample for a static site of MVP size                                               |
| Function max duration        | 300 s                  | **[V]**     | Each publish poll step stays far below; ADR-008                                   |
| Fast Data Transfer / month   | first 100 GB           | **[V]**     | Caps load testing (§21)                                                           |
| Function invocations / month | first 1,000,000        | **[V]**     | Admin only; public site uses none                                                 |
| Active CPU / month           | 4 h                    | **[V]**     | Admin only; keep handlers light                                                   |
| Commercial use               | Not permitted on Hobby | **[A, NV]** | Project stays a non-commercial open-source experiment                             |

**Daily deployment budget (guideline):** ≤ 40 code deployments (batch commits; push to `dev` at integration points, not per commit) + ≤ 30 publishes + 30 reserve. When the Vercel limit is reached, publish jobs fail with `DEPLOY_FAILED` and the reason is shown; the live site is unaffected.

**$0 rule:** the Executor MUST NOT enable any paid plan, trial, add-on, marketplace integration, custom domain purchase, or usage-based feature on Vercel, GitHub, or Google Cloud. Anything that would require a billing account is out of scope.

---

## 20. Observability and operations runbooks

### 20.1 Logging

- Admin: structured JSON logs `{ level, msg, requestId, jobId?, action?, ms, code? }` via one logger helper with redaction of known secret names and email local parts in non-audit logs.
- GAS: `console.log` structured strings; available in the Apps Script executions dashboard (and Cloud Logging when on a standard GCP project) **[A]**.
- `requestId` propagates admin → GAS → response for correlation.

### 20.2 Runbooks (`docs/operations.md`)

| ID  | Situation           | Procedure (summary)                                                                                                                                       |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Bad content live    | Admin → Publish → Rollback to last good version; if admin is down: Vercel dashboard Instant Rollback of the web project                                   |
| R2  | Publish job stuck   | Open `/publish`, poll job; if lease expired it resumes; if state inconsistent, mark `failed` via `publish.updateJob` script and start a new job           |
| R3  | Rotate HMAC secret  | Generate new secret → set in GAS Script Properties → set in Vercel env → redeploy admin; expect a short window of `SIGNATURE_INVALID` (dual-secret is P2) |
| R4  | Redeploy GAS        | §19.2; verify health; check version count < 200                                                                                                           |
| R5  | Restore spreadsheet | Use Drive version history or the pre-migration copy; re-run `system.health`; republish                                                                    |
| R6  | Remove an admin     | Remove from `ADMIN_EMAILS`, redeploy admin, rotate `AUTH_SECRET` to invalidate sessions                                                                   |
| R7  | Leaked GitHub token | Revoke PAT, create new one, update Vercel env, inspect repo history for unexpected commits                                                                |
| R8  | Quota exhaustion    | Check executions dashboard; wait for reset (24 h from first request **[V]**); reduce publish frequency; document                                          |

---

## 21. Benchmark plan

**Public site (owner approves levels first; stay within Vercel usage terms — load-testing a CDN can be treated as abuse).**

- Targets: `/`, one post, one page, `zidcms-version.json`.
- Concurrency 1, 10, 50, 100 virtual users, 60 s each, with warm-up; higher only with approval.
- Record: p50/p95/p99, RPS, error rate, `x-vercel-cache` distribution, bytes transferred, tester location and network.
- Confirm in Vercel dashboard that no functions were invoked.
- The pitch's "3,000 simultaneous visitors" is a hypothesis; extrapolations must be labeled as such.
- Hobby budget: estimate transfer before each run (avg response bytes × expected requests) and keep **total load-test transfer ≤ 5 GB per month** (5% of the 100 GB Hobby allotment **[V]**). Follow Vercel's published load-testing guidance; stop immediately on any Vercel abuse/usage warning.

**Admin/backend (dev spreadsheet only).**

- Single-call latency for `posts.list` (50, 200, 500 rows), `posts.get`, `posts.update`.
- Write contention: 2, 5, 10 parallel writers → success rate, lock wait, `LOCK_TIMEOUT` rate.
- Publish end-to-end: click → `live`, broken down by state durations, for 10, 100, 500 items.
- Snapshot size and build time vs. item count.
- Identify the item count at which any RPC exceeds 10 s.

**Reporting:** `docs/benchmarks.md` with methodology, environment, raw results in `tests/load/results/`, and limitations. No apples-to-apples claims versus WordPress without matched conditions.

---

## 22. Schedule, work breakdown, and cut rules

### 22.1 Day 0 — Owner preflight (before redeeming credits)

| ID   | Task                                                                                                                                 | Done when                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| O-01 | Review remaining open gates in §26 (defaults apply if unanswered)                                                                    | Table reviewed                                  |
| O-02 | Create **public** GitHub repo `zidcms` (first commit: Apache-2.0 `LICENSE`, `NOTICE`, `.gitignore` per §17.1), grant Executor access | Executor can push a branch                      |
| O-03 | Owner's Google account; enable Apps Script API in Apps Script user settings                                                          | `clasp login` works                             |
| O-04 | Dev + prod spreadsheets and private Drive folders                                                                                    | IDs stored privately                            |
| O-05 | Google OAuth client (free, consent screen _External_, basic scopes `openid email profile` only) with dev/prod redirect URIs          | Client id/secret in password manager            |
| O-06 | Two Vercel **Hobby** projects linked to the repo (owner's Vercel account; Hobby has no team seats, so the owner sets env vars)       | Project URLs known                              |
| O-07 | Fine-grained GitHub PAT (single repo, contents RW, statuses R)                                                                       | Stored privately                                |
| O-08 | Generate dev and prod HMAC secrets                                                                                                   | Stored privately                                |
| O-09 | Confirm Executor environment: Node LTS, pnpm, clasp, network to Google/GitHub/Vercel                                                 | Executor confirms                               |
| O-10 | Decide how secrets are handed to Executor (Vercel env UI / secrets manager), never via chat                                          | Agreed                                          |
| O-11 | Enable GitHub secret scanning and push protection on the repo                                                                        | Settings screenshot (no private values visible) |

### 22.2 Day 1 — Foundation

| ID    | Task                                                                                             | Evidence                   |
| ----- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| D1-01 | Monorepo scaffold, tooling (ADR-007), `.env.example`, README stub                                | CI green                   |
| D1-02 | `ci.yml`                                                                                         | CI run URL                 |
| D1-03 | ADR-001…008 drafted                                                                              | Files in `docs/decisions/` |
| D1-04 | `@zidcms/core` RPC envelope + HMAC helpers (+ unit tests, shared test vectors for admin and GAS) | Tests                      |

### 22.3 Day 1 — Feasibility PoCs (time-boxed: 4 h each)

| ID    | PoC                                                                                                     | Pass criteria                                    |
| ----- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| PoC-1 | Minimal GAS `doPost` with §10.2 verification                                                            | TC-GAS-01…08 pass from a Node script against dev |
| PoC-2 | Commit dummy snapshot + version file via Git Data API → Vercel build → detect status → verify live JSON | End-to-end script output with SHA and URL        |
| PoC-3 | Upload image via GAS → Drive; fetch bytes; commit into `public/media`; loads from Vercel URL            | Image URL + sha256 match                         |
| PoC-4 | Sheets round trip TC-DATA-01/02/03                                                                      | Results recorded; escape strategy decided        |

**Decision points:** PoC-1 fails → Fallback A (inform owner). PoC-2 fails on branch protection → content branch; fails on status detection → Vercel API token (approval). PoC-3 fails → media becomes P2, document. PoC-4 shows formula evaluation → implement escape prefix scheme.

### 22.4 Day 2 — Walking skeleton

| ID    | Task                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------- |
| D2-01 | `@zidcms/core`: post schema, slug, status transitions, `buildSnapshot`, `checksum`, `renderMarkdown` + tests                |
| D2-02 | GAS: dispatcher, stores, `system.setup/health`, `posts.create/get/list/update/setStatus`, revisions, audit + contract tests |
| D2-03 | Admin: Auth.js + allowlist, `requireAdmin`, posts list + basic editor, publish button                                       |
| D2-04 | Orchestrator: job states `queued → live` (happy path), `/api/publish` + polling UI                                          |
| D2-05 | Web: home + post detail + 404 from snapshot; empty-snapshot build                                                           |
| D2-06 | Deploy dev admin + dev web; run demo steps 1–5                                                                              |

**Exit:** demo steps 1–5 work on staging (evidence: URLs, job id, SHA). **Contract freeze** of `@zidcms/core` types, RPC actions, error codes.

### 22.5 Day 3 — Complete P0 content

| ID    | Task                                                                              |
| ----- | --------------------------------------------------------------------------------- |
| D3-01 | Unpublish, archive, soft-delete, restore, trash view                              |
| D3-02 | SEO fields with counters, excerpt, author default, settings screen + `settings.*` |
| D3-03 | Preview route                                                                     |
| D3-04 | Conflict UX (`VERSION_CONFLICT`, `SLUG_CONFLICT`), live-state badges              |
| D3-05 | Public: pagination, metadata/OG/canonical, sitemap, robots                        |
| D3-06 | Contract tests for every action/error code; TC-AUTH-03 matrix                     |

**Exit:** all P0 content criteria (§24.1 rows 1–6) pass on staging.

### 22.6 Day 4 — Publish robustness, then P1

| ID    | Task                                                               |
| ----- | ------------------------------------------------------------------ |
| D4-01 | Coalescing, idempotency, leases, resume, no-op detection, timeouts |
| D4-02 | Rollback job                                                       |
| D4-03 | Failure simulation (TC-PUB-07)                                     |
| D4-04 | P1 (only if D4-01…03 green): categories/tags + archive pages       |
| D4-05 | P1: pages + nav                                                    |

**Exit:** TC-PUB-01…09 pass on staging.

### 22.7 Day 5 — Security, concurrency, E2E, media

| ID    | Task                                                                         |
| ----- | ---------------------------------------------------------------------------- |
| D5-01 | Integration suite vs dev GAS (TC-GAS, TC-DATA, TC-CONC)                      |
| D5-02 | Security suite (TC-SEC-01…07), headers/CSP                                   |
| D5-03 | Playwright TC-E2E-01 on staging                                              |
| D5-04 | P1 media upload/library/picker/cover + TC-PUB-10/11 (only if D5-01…03 green) |
| D5-05 | Fix all critical/high findings                                               |

**Exit:** E2E green; no open critical/high issues.

### 22.8 Day 6 — Benchmarks and documentation

| ID    | Task                                                                                      |
| ----- | ----------------------------------------------------------------------------------------- |
| D6-01 | Benchmarks §21 (after owner approves levels)                                              |
| D6-02 | Docs: setup, deployment, operations, API, architecture, security, limitations, benchmarks |
| D6-03 | Fresh-account setup dry run following docs verbatim; fix doc gaps                         |
| D6-04 | Dependency license report reviewed; `LICENSE`/`NOTICE` use `The ZidCMS Authors`           |

**Exit:** setup reproduced from docs; benchmark report committed.

### 22.9 Day 7 — Release

| ID    | Task                                                                                      |
| ----- | ----------------------------------------------------------------------------------------- |
| D7-01 | Feature freeze; full regression (CI + integration + E2E)                                  |
| D7-02 | Prod setup and deploy (owner approval), smoke test, rollback test with a sacrificial post |
| D7-03 | Tag `v0.1.0` if all P0 criteria pass; release notes                                       |
| D7-04 | Demo video/screenshots, retrospective (§27.4)                                             |

### 22.10 Daily rhythm

Start of day: re-read exit criteria, confirm blockers. Midday: integrate to `dev`, deploy staging. End of day: daily report with evidence.

### 22.11 Cut rules

- End of Day 2 without walking skeleton → all P1 frozen; Day 3 finishes the skeleton.
- End of Day 4 with P0 not green → drop pages, taxonomy, media; Day 5 is P0 hardening only.
- End of Day 6 with docs incomplete → Day 7 morning is docs; demo uses staging.
- Never cut: auth boundary, signed RPC, published-only allowlist, failed-publish safety, rollback, limitations doc, evidence.

---

## 23. Workstreams and collaboration

- **Days 1–2:** one Executor owns the vertical slice end-to-end.
- **Days 3–6:** at most two parallel streams after contract freeze:
  - Stream A — GAS actions, publish orchestrator, integration tests.
  - Stream B — admin UI, public site, E2E tests.
- `packages/core` changes after freeze need a PR reviewed by the other stream.
- Branch per task; PR ≤ ~400 changed lines where practical; merge to `dev` at least daily; `dev` → `main` only when CI and staging smoke pass.
- Mandatory human review: auth, GAS manifest/scopes, secret handling, publish orchestrator, production deploy, repo visibility.

---

## 24. Acceptance criteria

### 24.1 Functional (P0)

1. [ ] Allowlisted admin can sign in/out; other accounts are rejected.
2. [ ] Unauthenticated/unauthorized callers cannot read drafts or mutate anything (admin API and GAS).
3. [ ] Admin can create, edit, list, search, preview, publish, unpublish, archive, soft-delete, and restore a Markdown post.
4. [ ] Each write persists in Sheets with stable UUID, UTC timestamps, incremented version, a revision row, and an audit row.
5. [ ] Duplicate/reserved slug and stale version produce specific, understandable UI errors.
6. [ ] Public post page renders title, sanitized content, canonical URL, SEO + OG metadata; unknown slugs show the 404 page.
7. [ ] Updating and republishing changes the public page and `zidcms-version.json`.
8. [ ] Parallel publish requests produce one active job; duplicates coalesce.
9. [ ] A failed publish leaves the previous version live and offers retry.
10. [ ] Rollback restores an earlier snapshot as a new version.
11. [ ] Snapshot contains only allowlisted fields of published, non-deleted items and public settings.

### 24.2 Functional (P1, if shipped)

12. [ ] Pages publish at top-level routes and appear in navigation by `nav_order`.
13. [ ] Categories/tags assignable and listed on archive pages.
14. [ ] Media upload enforces type/size; published images are served from the Vercel domain; Drive files remain private.

### 24.3 Demo scenario

1. Log into admin (show non-allowlisted rejection briefly).
2. Create and save a draft.
3. Preview it; show it is absent from the public site.
4. Publish; watch job states to `live`.
5. Open the public URL; show `zidcms-version.json`.
6. Edit, click Update; verify new content after `live`.
7. Simulate a failed build; show the previous version still served; then roll back to an earlier version.
8. Show HAR/network evidence that public reads only hit the Vercel domain, and the Vercel dashboard showing zero function invocations for the web project.

### 24.4 Engineering

- [ ] `apps/web` build output contains zero functions (TC-WEB-02).
- [ ] Bundle secret scan passes for both apps (TC-SEC-07).
- [ ] All test levels in §18.1 executed with recorded output.
- [ ] Concurrency tests TC-CONC-01/02 and TC-PUB-04 pass.
- [ ] Benchmark report complete per §21.
- [ ] Fresh-account setup reproduced from docs.
- [ ] All deployment steps and owner approvals documented.
- [ ] README, architecture, API, security, operations, limitations, benchmarks, license present.

---

## 25. Risk register

| Risk                                      | Likelihood    | Impact | Mitigation / validation                                 |
| ----------------------------------------- | ------------- | ------ | ------------------------------------------------------- |
| GAS auth design flaw                      | M             | H      | ADR-001, TC-GAS suite, fallback A                       |
| GAS latency 1–3 s per call **[A]**        | H             | M      | One RPC per action, pending UI, measured                |
| GAS quotas / 6-min runtime **[V]**        | M             | M      | Poll-driven steps, batching, measured caps              |
| 50k-char cell limit **[V]**               | M             | M      | Field limits                                            |
| Type coercion / formula injection         | M             | H      | Plain-text format, PoC-4, tests                         |
| Write contention                          | L             | H      | Lock + version check, TC-CONC                           |
| Manual spreadsheet edits                  | M             | M      | Validation on read, health report, docs                 |
| Branch protection blocks publisher        | M             | M      | PoC-2, content-branch fallback                          |
| Vercel status detection unreliable        | M             | M      | PoC-2, Vercel API fallback                              |
| Public repo retains unpublished content   | H (if public) | M      | Owner gate                                              |
| Vercel 4.5 MB body limit **[A]**          | H             | L      | 3 MB cap                                                |
| Repo growth from media                    | M             | L      | Size caps, dedupe, documented                           |
| Markdown XSS                              | M             | H      | Sanitizer, CSP, TC-SEC-01                               |
| Snapshot leaks private data               | L             | H      | Allowlist builder, TC-SEC-06                            |
| Build failure/delay                       | M             | M      | Timeouts, last-good stays live, rollback                |
| Credits expire early                      | M             | H      | Day 0, skeleton Day 2, cut rules                        |
| Agent conflicts                           | M             | M      | Single executor until freeze                            |
| Unapproved cost                           | L             | M      | $0 rule (§19.4), no billing accounts                    |
| Vercel Hobby deployment cap (100/day) hit | M             | M      | Deployment budget, branch filter, batching (§19.4)      |
| Private config leaked in public repo      | M             | H      | §8.2 private list, push protection, gitignore, rotation |
| Owner email exposed publicly              | M             | L      | Env-only allowlist; `@example.com` in tests/docs        |
| Auth.js / Next.js version friction        | M             | M      | Pin versions Day 1, PoC sign-in early                   |

---

## 26. Owner approval gates

| #   | Decision                 | Recommended default                         | Owner answer (2026-11-21)                                                                                       |
| --- | ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| G1  | Product name / repo slug | ZidCMS / `zidcms`                           | Open — default in use                                                                                           |
| G2  | Repo visibility          | Private during sprint, public at release    | **Public from day 1**                                                                                           |
| G3  | Dashboard model          | Standalone dashboard                        | Open — default in use                                                                                           |
| G4  | Admin auth               | Auth.js + Google + email allowlist          | Open — default in use                                                                                           |
| G5  | Admin emails             | —                                           | **Owner's personal Google account (single admin).** Value provided privately; set only in `ADMIN_EMAILS` (§8.2) |
| G6  | GAS access model         | ADR-001                                     | Open — default in use                                                                                           |
| G7  | Snapshot store           | ADR-003, same repo                          | Open — default in use                                                                                           |
| G8  | Vercel plan and projects | Two projects                                | **Vercel Hobby (free), two projects**                                                                           |
| G9  | Domains                  | Vercel default domains for MVP              | Default (implied by $0)                                                                                         |
| G10 | Staging mechanism        | `dev` branch + dev Google resources         | Open — default in use                                                                                           |
| G11 | License                  | MIT or Apache-2.0                           | **Apache-2.0**, copyright holder `The ZidCMS Authors`                                                           |
| G12 | Media policy             | Images only, ≤ 3 MB, copied into build      | Open — default in use                                                                                           |
| G13 | Sample/demo content      | Executor writes neutral sample posts        | Open — default in use                                                                                           |
| G14 | Spending limit           | $0 unless approved                          | **$0 — fully free**                                                                                             |
| G15 | Load-test ceiling        | 100 concurrent users, ≤ 5 GB transfer/month | Open — default in use                                                                                           |
| G16 | "Poke"                   | —                                           | **Poke provided the Devin AI Max access; acknowledge in README**                                                |

"Open — default in use" means the Executor proceeds with the recommended default; the owner may override at any time, and the Executor records the override in an ADR. No open gate blocks the start of work.

### 26.1 Consequences of recorded decisions

**G2 — public from day 1**

- Every commit, branch, issue, PR, Actions log, and daily report in the repo is public immediately. Daily reports live in `docs/status/` and follow the private-configuration rule (§8.2).
- Without a license file a public repo is "all rights reserved", so the license (G11) is part of the first commit.

**G11 — Apache-2.0**

- Root `LICENSE` contains the unmodified Apache License 2.0 text; the copyright holder is the collective name **`The ZidCMS Authors`** (owner decision). The copyright line `Copyright 2026 The ZidCMS Authors` goes in `NOTICE`, the README License section, and the appendix boilerplate if used.
- Root `NOTICE` file:

  ```text
  ZidCMS
  Copyright 2026 The ZidCMS Authors
  ```

  (Apache-2.0 §4(d) requires redistributors to keep it.)
- "The ZidCMS Authors" means the contributors recorded in Git history; no `AUTHORS` file is required for MVP.
- Every `package.json` declares `"license": "Apache-2.0"`; README has a License section. Per-file SPDX headers (`// SPDX-License-Identifier: Apache-2.0`) are optional — SHOULD be added to source files only if the Executor applies them consistently.
- Dependency licenses must be compatible with Apache-2.0: MIT, BSD, ISC, Apache-2.0, 0BSD are fine; **GPL/AGPL/LGPL and "no license" packages are not allowed** without owner approval. CI produces a dependency license report (non-blocking on Day 1, blocking at release).
- Contributions are accepted under the same license (Apache-2.0 §5); no separate CLA for MVP.
- Published content (and media) stays in public Git history forever (ADR-003).
- Fork PRs never receive secrets; integration/e2e workflows are `workflow_dispatch` only.

**G5 — single admin, owner's Google account**

- The same account owns the GAS project ("Execute as: Me"), the spreadsheets, and the Drive folders, so consumer-account Apps Script quotas apply **[V]** (§9, §17).
- Sign-in uses only basic OAuth scopes, so no Google verification process is needed for the admin login **[A, NV]**.
- The real address never appears in the repository; the README says "set `ADMIN_EMAILS` to your Google account".

**G8 / G14 — Vercel Hobby, $0**

- Hobby limits and the deployment budget in §19.4 are binding design constraints.
- Hobby has no team seats: the owner performs Vercel dashboard tasks (linking, env vars, Instant Rollback); the Executor provides exact step lists.
- Non-commercial use only on Hobby **[A, NV]**; README states the project is a non-commercial open-source experiment.
- GitHub Actions minutes are free for public repositories **[A]**; Google services used are free tiers.

**G16 — Poke**

- README contains an _Acknowledgments_ section, e.g.: "ZidCMS was developed during a seven-day sprint using Devin AI Max access provided by Poke." Exact wording confirmed by the owner before release (§27.2).
- The retrospective (§27.4) is written so it can be shared with Poke.

Executor may proceed with local work while gates are open but must not invent answers.

---

## 27. Deliverables, release checklist, templates

### 27.1 Deliverables

1. Repository URL, `v0.1.0` tag/commit.
2. Live admin and public URLs (if approved).
3. Setup, deployment, and operations docs (validated by fresh run).
4. Architecture diagram and ADRs.
5. Data model, RPC catalog, HTTP API, and error codes (`docs/api.md`).
6. Test outputs and known gaps.
7. Benchmark methodology, results, raw artifacts.
8. Security review (threat model status), unresolved risks, limitations.
9. Demo walkthrough, screenshots/video.
10. Retrospective.

### 27.2 Release checklist (`v0.1.0`)

- [ ] All P0 acceptance criteria checked with evidence links
- [ ] CI green on the release commit
- [ ] Integration + E2E run on staging within the last 24 h
- [ ] Prod resources separate from dev (verified by `system.health` environment)
- [ ] Prod rollback tested
- [ ] Secrets scan clean; no secrets in repo history
- [ ] Docs complete; limitations honest
- [ ] Apache-2.0 `LICENSE` + `NOTICE` present; all packages declare `Apache-2.0`; dependency license report has no incompatible licenses
- [ ] README states project status as experimental and non-commercial (hosting), with License section
- [ ] README _Acknowledgments_ credits Poke (wording confirmed by owner)
- [ ] Repo-wide check that no private configuration (§8.2) or admin email is present in files or history
- [ ] Vercel usage for the month within Hobby allotments (screenshot without private IDs)

### 27.3 Daily report template (`docs/status/day-N.md`)

```markdown
## ZidCMS — Day N status (YYYY-MM-DD)

**Blockers / approvals needed (top):**
**Planned exit criteria:**
**Met?** yes / partially / no
**Completed (with evidence):** task id — PR/commit/log/URL
**Tests run:** command → result (link)
**Decisions:** ADR links
**Risks changed:**
**Scope cuts applied:**
**Plan for tomorrow:**
```

### 27.4 Retrospective template

What we set out to do · what shipped (with criteria status) · what failed and why · where AI execution helped/hurt · time and credit use (where observable) · measured limits of the architecture · recommended next steps (P2 backlog order).

### 27.5 Definition of Done (per task)

Merged via PR · CI green · behavior covered by a test · docs updated if behavior/setup changed · no secrets in diff · evidence in the daily report.

---

## 28. Known limitations (initial draft for `docs/limitations.md`)

- Content appears publicly only after a publish job completes (minutes, not seconds).
- Editing a published post and clicking Update publishes immediately; private edits require unpublishing first.
- Single role (admin); no editorial workflow.
- Sheets cells cap content at 40,000 characters per field (platform cell limit 50,000).
- Admin actions take seconds due to Apps Script round trips.
- Throughput of writes is serialized by a single script lock.
- Manual edits in the spreadsheet are unsupported.
- Media: images only, ≤ 3 MB, no transformations; media history accumulates in Git.
- If the repository is public, all once-published content remains in Git history.
- Slug changes break old URLs (no redirects).
- Platform quotas (Apps Script, Vercel, GitHub) apply and may change without notice.
- Reference deployment runs on Vercel Hobby: ≤ 100 deployments/day shared by code and publishes, one build at a time, non-commercial use only.

---

## 29. Glossary

| Term             | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| GAS              | Google Apps Script                                                     |
| RPC envelope     | Signed JSON string carrying action, payload, ts, nonce, actor          |
| Snapshot         | Immutable JSON of all published content for one version                |
| Live snapshot    | Snapshot currently served by the public site (verified)                |
| Publish job      | Tracked process turning current published content into a live snapshot |
| Coalescing       | Merging concurrent publish requests into one running job + one rerun   |
| Lease            | Time window during which a job is considered actively driven           |
| Walking skeleton | Thinnest end-to-end working path through all components                |
| Contract freeze  | Point after which shared types/actions change only via reviewed PRs    |

---

## 30. First instruction to Executor AI

> Read `ZIDCMS_EXECUTION_PLAN.md` v2.0 in full. You are the **Executor**, not the Planner.
> 1. Check Day-0 items O-01…O-11 (§22.1). List anything missing; if a blocker exists, stop and ask the owner. The repo is public and the budget is $0 — apply §8.2, §17.1 item 8, and §19.4 from the very first commit.
> 2. Day 1: complete D1-01…D1-04, write ADR-001…008 (accept or justify changes to §5), and run PoC-1…4 within their time boxes. Record pass/fail evidence for every PoC and apply the decision points in §22.3.
> 3. Do not start Day-2 feature work until PoC-1 and PoC-2 pass or an approved fallback is chosen.
> 4. Use §22 (schedule and cut rules) and §24 (acceptance criteria) as the source of truth, post a daily report (§27.3), and report evidence rather than claiming unverified success.

---

**Planning note:** This document is a design proposal, not proof of implementation. **[V]** items were checked against official documentation at writing time; limits change. All **[A]** and **[NV]** items must be confirmed or tested before being relied on.

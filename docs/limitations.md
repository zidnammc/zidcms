# Known limitations

ZidCMS is at an early stage (v0.1.0, pre-release): a non-commercial experiment, not a WordPress replacement. Measured numbers and their raw sources are in [benchmarks.md](benchmarks.md).

- Content appears publicly only after a publish job completes (commit → Vercel build → verification): about 1–1.5 min per publish on the deployed environments.
- Editing a published post and clicking _Perbarui_ publishes immediately; private edits require _Batalkan terbit_ first.
- Single role (admin); no editorial workflow.
- Fields are capped at 40,000 characters (platform cell limit 50,000).
- Admin actions take seconds because every action is an Apps Script round trip: a single write takes about 4–6 s, and the first call after the script has been idle takes about 11 s (cold start).
- Writes are serialised by a single script lock that waits at most 10 s. With about 10 simultaneous writers some requests fail with `LOCK_TIMEOUT` (retryable); concurrent edits of the same item succeed once and return `VERSION_CONFLICT` for the rest.
- `system.health` (and `GET /api/health`) reads every sheet; it took about 11 s (p50) on the dev spreadsheet (11 sheets, about 500–2,300 rows in total).
- `Revisions`, `AuditLog` and trashed (soft-deleted) rows grow forever; there is no pruning or archiving.
- Manual edits in the spreadsheet are unsupported; invalid rows are reported in health and skipped.
- Media: images only (JPEG/PNG/WebP/GIF), ≤ 3 MB, no transformations; media history accumulates in Git.
- The repository is public: every once-published post and image remains in Git history.
- Slug changes break old URLs (no redirects).
- Rollback republishes old content without changing item status in Sheets; affected items show _Selisih Rollback_.
- Deleted categories/tags disappear from posts at the next publish (with a warning).
- With an empty site, the static export contains placeholder paths (`/blog/__zidcms-empty__/` etc.) that render the noindex 404 page — a Next.js 16 constraint.
- Admin pending-changes and live badges depend on reading the live snapshot from GitHub; if that read fails, items are shown as pending.
- Public-site capacity is unmeasured beyond 1-user latency sampling: Vercel permits load testing only on Enterprise plans ([policy](https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments)), so no CDN load test was run.
- A new Apps Script install may have to be linked to your own Google Cloud project (Google's default project is blocked from the `drive` scope with `Error 403: access_denied`) and needs the Google Drive API enabled there; see [setup.md](setup.md) §2 and [deployment.md](deployment.md) §1.
- Platform quotas (Apps Script, Vercel Hobby, GitHub) apply and may change. Vercel Hobby: ≤ 100 deployments/day shared by code and publishes, one build at a time, non-commercial use only.
- Early stage: APIs, the sheet schema and the docs may still change; a cloud install from scratch by someone other than the developer has not been done yet.

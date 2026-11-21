# Known limitations

- Content appears publicly only after a publish job completes (minutes, not seconds).
- Editing a published post and clicking _Perbarui_ publishes immediately; private edits require _Batalkan terbit_ first.
- Single role (admin); no editorial workflow.
- Fields are capped at 40,000 characters (platform cell limit 50,000).
- Admin actions take seconds because every action is an Apps Script round trip.
- Writes are serialised by a single script lock.
- Manual edits in the spreadsheet are unsupported; invalid rows are reported in health and skipped.
- Media: images only (JPEG/PNG/WebP/GIF), ≤ 3 MB, no transformations; media history accumulates in Git.
- The repository is public: every once-published post and image remains in Git history.
- Slug changes break old URLs (no redirects).
- Rollback republishes old content without changing item status in Sheets; affected items show _Selisih Rollback_.
- Deleted categories/tags disappear from posts at the next publish (with a warning).
- With an empty site, the static export contains placeholder paths (`/blog/__zidcms-empty__/` etc.) that render the noindex 404 page — a Next.js 16 constraint.
- Admin pending-changes and live badges depend on reading the live snapshot from GitHub; if that read fails, items are shown as pending.
- Platform quotas (Apps Script, Vercel Hobby, GitHub) apply and may change. Vercel Hobby: ≤ 100 deployments/day shared by code and publishes, one build at a time, non-commercial use only.
- Not yet validated against real Google/GitHub/Vercel services (see `docs/status/day-1.md`): HMAC on GAS, formula behaviour in Sheets, `drive.file` scope with DriveApp, Vercel commit statuses.

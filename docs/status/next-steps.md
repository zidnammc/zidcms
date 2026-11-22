## ZidCMS — handoff and next steps (2026-11-22, after the staging retirement)

### Where things stand

- **v0.1.0 is an early-stage pre-release.** P0 + P1 shipped; the project may be developed further. Evidence: `docs/status/day-2.md`, `docs/status/release-v0.1.0.md`; lessons and roadmap: `docs/status/retrospective.md`.
- Repo <https://github.com/zidnammc/zidcms>.
- **Prod is the only hosted environment** (branch `release`, content `apps/web/content/prod/`): admin <https://zidcms-prod-admin.vercel.app>, site <https://zidcms-prod-web.vercel.app>. Topology: ADR-0011, amended by ADR-0012.
- **Dev/staging was retired on 2026-11-22** (ADR-0012, owner decision): the dev Vercel projects and the dev Apps Script web-app deployment were deleted, `apps/web/content/dev/` was removed, and dev local config is archived as `.local/secrets/*.retired`. The dev spreadsheet remains in the owner's Drive (unreachable). `main` carries code only and creates no Vercel deployments, so the cross-environment cancelled builds that exhausted the Hobby limit on 2026-11-21 no longer occur.
- Passed on 2026-11-21 (history, still valid): CI on `main`; integration suite vs. the then-live dev Apps Script (16 pass, 2 skip); staging E2E demo; `pnpm check:deployed` on dev and prod; prod TC-GAS-01…08 and prod smoke + rollback; fresh-clone local dry run. The pending staging E2E re-run on the per-environment layout will not happen (superseded by ADR-0012).
- The backend benchmark ran up to 550 posts (`docs/benchmarks.md`). No CDN load test is allowed on Vercel Hobby (ADR-0010).

### Next steps

1. Done on 2026-11-22: `main` `d1e78c0` (CI 44980359791, `integration.yml` 44980459836, `e2e.yml` 44980463137 — all green) promoted to `release` as `d7f49a6`; both prod builds succeeded; `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm check:deployed` → all PASS (35-route 401 matrix, headers, sitemap, snapshot allowlist, 0 web functions); `smoke:deployed` → publish v5 (`d1590f4b`, 72 s), update v6 (`04a85560`, 74 s), rollback v7 (`212cde14`, 70 s, checksum = v5), unpublish v8 (`a71cfc31`, 65 s). Prod now runs the latest code; nothing is pending for the executor.
2. Before each promotion: CI plus `integration.yml` and `e2e.yml` (emulator stack) green on `main`. Real-service integration tests, the staging E2E and `pnpm build-switch` need a recreated dev environment (`docs/deployment.md` §1–2 with `ZIDCMS_ENV=dev`).

### How to resume

1. Read `AGENTS.md`, then this file and the retrospective.
2. Private plan: `.local/ZIDCMS_EXECUTION_PLAN.md` (no longer in the repo). Env file: `.local/secrets/prod.env` (never print values); retired dev files end in `.retired`.
3. Apps Script: prod uses `services/apps-script/.clasp.prod.json` (`clasp -P .clasp.prod.json …`; prod deploys need owner approval).
4. Changes land on `main` first. Promote with `main` → `release` (owner approval; `docs/deployment.md` §3), then run `check:deployed` / `smoke:deployed` with the prod env file (`ZIDCMS_ENV_FILE` is required). Never merge `release` into `main`.

### Open owner items

Owner decision (2026-11-22): the project is considered complete for v0.1.0 without further owner testing. The manual non-allowlisted Google sign-in, the Vercel usage screenshot and the fresh-account setup by another person are **waived** (not done; the automated evidence in `docs/status/day-2.md` stands).

Still needed for Google sign-in on the prod admin (configuration, not testing):

1. Add the prod admin redirect URI `https://zidcms-prod-admin.vercel.app/api/auth/callback/google` to the OAuth client.

Optional:

2. Decide whether to purge the execution plan from old Git history (destructive; not done).
3. Trash the "ZidCMS dev" spreadsheet in Drive and remove the dev admin redirect URI from the OAuth client.

### Reminders

- The GitHub PAT (used by prod; the retired dev environment shared it) expires 90 days after 2026-11-21. Renew it before **2027-02-19**, update `.local/secrets/prod.env` and run `pnpm exec tsx scripts/vercel-env-sync.ts prod`.
- Enable 2FA on the Vercel, Google and GitHub accounts.
- Keep a password-manager copy of `.local/secrets/*.env`.

### Roadmap

P2 backlog in recommended order (dual-secret HMAC rotation → cheaper health check → Revisions/AuditLog pruning → published-revision pointer → autosave → scheduled publishing → RSS → search): see `docs/status/retrospective.md`.

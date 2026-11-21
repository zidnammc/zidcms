## ZidCMS — handoff and next steps (2026-11-21, end of session 2)

### Where things stand

- **v0.1.0 is an early-stage pre-release.** P0 + P1 shipped; the project may be developed further. Evidence: `docs/status/day-2.md`, `docs/status/release-v0.1.0.md`; lessons and roadmap: `docs/status/retrospective.md`.
- Repo <https://github.com/zidnammc/zidcms>.
- **Dev/staging** (branch `main`, content `apps/web/content/dev/`): admin <https://zidcms-admin.vercel.app>, site <https://zidcms-web.vercel.app>.
- **Prod** (branch `release`, content `apps/web/content/prod/`): admin <https://zidcms-prod-admin.vercel.app>, site <https://zidcms-prod-web.vercel.app>. Topology: ADR-0011.
- Passed: CI on `main`; integration suite vs. the real dev Apps Script (16 pass, 2 skip); staging E2E demo; `pnpm check:deployed` on dev and prod; prod TC-GAS-01…08 and prod smoke + rollback; fresh-clone local dry run.
- The backend benchmark ran up to 550 posts (`docs/benchmarks.md`). No CDN load test is allowed on Vercel Hobby (ADR-0010).
- **The Vercel Hobby deployment limit (100 per 24 h, cancelled builds count) was reached on 2026-11-21 ~19:17 UTC.** Until it resets: the dev site still shows 100 bench posts (snapshot v16), the latest `main` is not promoted to `release` (prod runs `b75ffad` code, content v4), and the staging E2E has not been re-run on the per-environment layout. First thing next session: `ZIDCMS_ENV_FILE=.local/secrets/dev.env pnpm exec tsx tests/load/backend.ts republish` (and `cleanup` again if bench posts remain), `E2E_TARGET=staging pnpm test:e2e`, promote `main` → `release`, `ZIDCMS_ENV_FILE=.local/secrets/prod.env pnpm check:deployed`. Mind the budget in `docs/deployment.md` §2.

### How to resume

1. Read `AGENTS.md`, then this file and the retrospective.
2. Private plan: `.local/ZIDCMS_EXECUTION_PLAN.md` (no longer in the repo). Env files: `.local/secrets/dev.env`, `.local/secrets/prod.env` (never print values).
3. Apps Script: dev uses `services/apps-script/.clasp.json`, prod uses `services/apps-script/.clasp.prod.json` (`clasp -P .clasp.prod.json …`; prod deploys need owner approval).
4. Changes land on `main` first. Promote with `main` → `release` (owner approval; `docs/deployment.md` §3), then run `check:deployed` / `smoke:deployed` with the prod env file. Never merge `release` into `main`.

### Open owner items

1. Manual sign-in with a non-allowlisted Google account → expect "Akses ditolak".
2. Add the prod admin redirect URI to the OAuth client (until then, Google sign-in on the prod admin does not work).
3. Screenshot of this month's Vercel usage (without private IDs).
4. Fresh-account setup by another person following `docs/beginner-guide.md`.
5. Decide whether to purge the execution plan from old Git history (destructive; not done).

### Reminders

- The GitHub PAT used by dev and prod expires 90 days after 2026-11-21. Renew it before **2027-02-19**, update both env files and run `pnpm exec tsx scripts/vercel-env-sync.ts dev` and `… prod`.
- Enable 2FA on the Vercel, Google and GitHub accounts.
- Keep a password-manager copy of `.local/secrets/*.env`.

### Roadmap

P2 backlog in recommended order (dual-secret HMAC rotation → cheaper health check → Revisions/AuditLog pruning → published-revision pointer → autosave → scheduled publishing → RSS → search): see `docs/status/retrospective.md`.

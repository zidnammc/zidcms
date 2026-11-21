## ZidCMS — handoff and next steps (2026-11-21, end of session 1)

### Where things stand

- Day 0 complete for **dev** (`docs/status/day-0.md`). Day 1–4 scope implemented and unit/contract-tested (`docs/status/day-1.md`).
- Live dev stack: admin <https://zidcms-admin.vercel.app>, public site <https://zidcms-web.vercel.app>, repo <https://github.com/zidnammc/zidcms>. Owner published v1 successfully (PoC-2 pass).
- PoC-1 (HMAC RPC) and PoC-4 (Sheets round trip) pass against real Apps Script; PoC-3 (media) not yet run.
- Tests: core 73, apps-script 24, admin 72. CI green on `main`.

### Next steps (agreed order)

**Stage 1 — complete staging evidence**

- Owner: PoC-3 (upload an image in _Pustaka Media_, insert into a post, _Perbarui_, confirm it renders on the site); sign in with a non-allowlisted Google account and confirm "Akses ditolak".
- Executor: Playwright E2E for the demo scenario (TC-E2E-01) on the local stack + `e2e.yml` (`workflow_dispatch`); integration suite against the dev Apps Script (TC-CONC-01/02, TC-DATA, TC-GAS) + `integration.yml`; a web-project build-failure switch to demonstrate TC-PUB-07 on staging without breaking code.

**Stage 2 — acceptance run on staging** (plan §24.1, demo §24.3) with evidence in `docs/status/`.

**Stage 3 — benchmarks + fresh-account setup dry run** (ideally by another person following `docs/panduan-pemula.md`).

**Stage 4 — release:** prod resources (separate sheet/script/secrets/deployment, owner approval), prod rollback test, tag `v0.1.0`, release notes, retrospective.

### Open owner decisions

1. Benchmark ceiling (default: ≤ 100 concurrent users, ≤ 5 GB transfer/month).
2. Storing dev secrets as GitHub Actions environment secrets with a required reviewer (needed for `integration.yml`).
3. When to set up prod.
4. Final wording of the Poke acknowledgment in the README.

### Reminders

- Enable 2FA on the Vercel and Google accounts.
- The dev GitHub PAT expires 90 days after 2026-11-21; renew, update `.local/secrets/dev.env`, run `pnpm exec tsx scripts/vercel-env-sync.ts dev`.
- Keep a password-manager copy of `.local/secrets/dev.env`.

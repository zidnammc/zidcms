## ZidCMS — Day 0 preflight (2026-11-21)

Executed together with the owner after the local Day-1 work. Private values (URLs, IDs, secrets, e-mail addresses) are kept in the owner's gitignored `.local/secrets/` and are intentionally not recorded here.

| ID   | Item                              | Status     | Evidence                                                                                                                                                                                                                      |
| ---- | --------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-01 | Gates reviewed                    | done       | Defaults + owner decisions (UI language Indonesian, Devin commit identity)                                                                                                                                                    |
| O-02 | Public GitHub repo                | done       | <https://github.com/zidnammc/zidcms>; CI run 44912944041 green                                                                                                                                                                |
| O-03 | Apps Script API + clasp           | done       | clasp 3.4.1 logged in; Apps Script API enabled                                                                                                                                                                                |
| O-04 | Dev spreadsheet + Drive folder    | done (dev) | "ZidCMS dev" spreadsheet with container-bound script; `system.health`: schema_version 1, all 11 sheets, `media_folder_configured: true`. Prod pending.                                                                        |
| O-05 | Google OAuth client               | pending    |                                                                                                                                                                                                                               |
| O-06 | Vercel Hobby projects             | pending    |                                                                                                                                                                                                                               |
| O-07 | GitHub fine-grained PAT           | pending    |                                                                                                                                                                                                                               |
| O-08 | HMAC secrets                      | done (dev) | Generated locally into `.local/secrets/dev.env`; set in Script Properties via a one-time bootstrap function that was removed afterwards. **The first dev secret was exposed in a screenshot and was rotated before any use.** |
| O-09 | Executor environment              | done       | Node 26.13.1, pnpm 12.21.0, gh 2.102 (authenticated), clasp 3.4.1                                                                                                                                                             |
| O-10 | Secret hand-over                  | agreed     | Secrets are generated on the owner's machine and piped directly into Script Properties / Vercel; never pasted into chat                                                                                                       |
| O-11 | Secret scanning + push protection | done       | Enabled via API, plus Dependabot alerts and private vulnerability reporting                                                                                                                                                   |

### PoC results against real Google services

- **PoC-1 — PASS.** `ZIDCMS_ENV_FILE=.local/secrets/dev.env pnpm poc:gas`: TC-GAS-01…08 all pass. Latency: first call 11.1 s (cold start), then 1.3–1.6 s; 5.3 MB oversize body rejected in 8.8 s.
- **PoC-4 — PASS.** `pnpm poc:sheets`: `2026-01-01`, `001`, `TRUE`, `1e5`, `12:30`, `=IMPORTXML(...)`, `+1`, `-1`, `@SUM(A1)`, `'quoted`, `~tilde`, Unicode/emoji all round-trip unchanged; 0 invalid rows afterwards.
- **Finding:** `drive.file` is insufficient for `DriveApp.createFolder`; switched to the `drive` scope (ADR-0006).
- PoC-2 (GitHub → Vercel → verify) and PoC-3 (media) wait for O-05…O-07.

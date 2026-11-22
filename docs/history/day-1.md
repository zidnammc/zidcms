## ZidCMS: Day 1 status (2026-11-21)

**Blockers / approvals needed (top):**

1. Day-0 owner items are not done yet (owner confirmed: "not ready, work locally"). Blocked until then: PoC-1 live (O-03/O-04/O-08), PoC-2 (O-02/O-06/O-07), PoC-3 (O-04), PoC-4 live (O-04), real Google sign-in TC-AUTH-01/04 (O-05), any deployment (O-06), CI run URL (O-02).
2. Resolved today: commits use the Devin bot identity (owner decision; keeps the personal e-mail out of public history). `prototype/` deleted after porting (owner approval).

**Day-0 checklist:**

| ID                                           | Status                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| O-01 gates reviewed                          | defaults applied; UI language = Bahasa Indonesia (new owner decision)                                            |
| O-02 public repo + LICENSE/NOTICE/.gitignore | local repo initialised with Apache-2.0 `LICENSE`, `NOTICE`, `.gitignore`; GitHub repo not created                |
| O-03 Apps Script API + clasp                 | missing (clasp not installed on this machine)                                                                    |
| O-04 spreadsheets + Drive folders            | missing                                                                                                          |
| O-05 OAuth client                            | missing                                                                                                          |
| O-06 Vercel Hobby projects                   | missing                                                                                                          |
| O-07 GitHub PAT                              | missing                                                                                                          |
| O-08 HMAC secrets                            | local-only random secrets generated into gitignored `apps/admin/.env.local`; dev/prod secrets missing            |
| O-09 Executor environment                    | Node 26.13.1, pnpm 12.21.0 (installed globally with approval), git 2.56, gh 2.102 (not logged in); clasp missing |
| O-10 secret hand-over                        | not agreed yet; proposal: owner sets Vercel env + Script Properties directly                                     |
| O-11 secret scanning / push protection       | pending repo creation                                                                                            |

**Planned exit criteria:** D1-01…D1-04, ADR-001…008, PoC-1…4.
**Met?** Partially. All local work is done and was extended to a working local walking skeleton (Day-2 scope); live PoCs are blocked on Day 0.

**Completed (with evidence):**

- D1-01 monorepo scaffold (pnpm workspaces, TS strict, Biome, Vitest, `.env.example`, README): `pnpm lint` → "Checked 178 files … No fixes applied."
- D1-02 `.github/workflows/ci.yml` (actions pinned to SHAs), not yet run (no remote).
- D1-03 ADRs `docs/decisions/0001…0009` (0009 lists deviations from the original design and the prototype).
- D1-04 `@zidcms/core` RPC envelope + HMAC verification + shared test vectors (`rpc.vectors.json`).
- D2-01 core domain (schema, codec, validators, slug, status, snapshot, checksum, Markdown, live-state).
- D2-02 GAS dispatcher + all actions + GAS adapters + in-memory adapters + local emulator; bundle `dist/Code.js` 74.7 KiB.
- D2-03/D3 admin: Auth.js + allowlist, `requireAdmin`, full HTTP API, screens ported from the prototype in Bahasa Indonesia: login, dashboard, posts/pages list + editor (Markdown split preview, SEO counters, cover, taxonomy, revisions, conflict dialog, unsaved guard), preview, publish (pipeline, job history, snapshot history, rollback), settings, taxonomy, media library.
- D2-04/D4-01/D4-02 publish orchestrator: claims, CAS transitions, coalescing, idempotency, no-op detection, timeouts, retries, rollback; GitHub and local snapshot stores.
- D2-05/D3-05 web: home + pagination, post, page, category, tag, 404, sitemap, robots, metadata/OG/canonical; empty-snapshot build.
- Local walking skeleton: `pnpm smoke:local` → "SMOKE OK" (401/403 checks, create → publish v1 live → `zidcms-version.json` matches → VERSION_CONFLICT 409 → update v2 → no-op → rollback to v1 as v3 with identical checksum → 12 admin screens render 200).

**Tests run:**

- `pnpm test` → core 73 passed, apps-script 23 passed, admin 72 passed (168 total).
- `pnpm typecheck` → all 4 packages Done; `pnpm build` (without `.env.local`) → GAS bundle, web export, admin build OK.
- `pnpm check:web` → "53 static files, snapshot v0 … static export only" (TC-WEB-01/02).
- `pnpm scan:secrets` and `--repo` → "No secrets found."
- `pnpm poc:gas` **against the local emulator only** → TC-GAS-01…08 PASS. `pnpm poc:sheets` against the emulator → PASS. These are not evidence for real Apps Script/Sheets behaviour.

**Decisions:** ADR-0001…0009 accepted (Auth.js v5 beta pinned; no Zod; formula escape codec; step-claim lease + 3 extra job columns; static-export placeholder param; `system.summary` RPC).

**Risks changed:**

- Next.js 16 static export rejects empty `generateStaticParams` → mitigated with placeholder (ADR-0005).
- Auth.js v5 still beta → pinned; fallback next-auth 4.24.15.
- Playwright/k6 not installed yet (E2E and load tests open).

**Scope cuts applied:** none. P1 (pages, taxonomy, media, revisions read-only) implemented early because the prototype already defined them; they remain cuttable.

**Plan for tomorrow (once Day 0 is done):** create the GitHub repo and push; run CI; deploy dev GAS and run PoC-1/PoC-4 live; create Vercel projects and run PoC-2; PoC-3 with a real image; then demo steps 1–5 on staging (D2-06).

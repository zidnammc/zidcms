# Security

## Controls (plan §17.1) and where they live

| #   | Control          | Implementation                                                                                                                                                                                                                                  | Test                                                                                                                      |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | AuthN/AuthZ      | Auth.js Google + `email_verified` + `ADMIN_EMAILS`; `requireAdmin()` in every handler and page                                                                                                                                                  | `apps/admin/lib/security.test.ts` (TC-AUTH-02/03)                                                                         |
| 2   | GAS boundary     | HMAC envelope, ±300 s window, nonce cache, action allowlist, size limit, fail-closed secret                                                                                                                                                     | `packages/core/src/rpc.test.ts`, `services/apps-script/src/dispatcher.test.ts`, `scripts/poc/hmac-call.ts` (TC-GAS-01…08) |
| 3   | CSRF             | SameSite=Lax cookies + `Origin === ADMIN_URL` on every mutation (missing Origin rejected)                                                                                                                                                       | TC-AUTH-05                                                                                                                |
| 4   | XSS              | Markdown: raw HTML escaped as text, `rehype-sanitize` strict schema, `javascript:`/`data:`/`vbscript:` stripped, external images become links unless allowed; React escaping elsewhere; CSP on admin (`next.config.ts`) and web (`vercel.json`) | TC-SEC-01 corpus in `packages/core/src/snapshot.test.ts`                                                                  |
| 5   | Headers          | `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` (admin), `X-Robots-Tag: noindex, nofollow` (admin), HSTS by Vercel                                                                                                                        | TC-SEC-02 (manual on staging, pending)                                                                                    |
| 6   | Uploads          | Size cap (admin + GAS), magic bytes must equal the declared type, no SVG, sha256 recomputed in GAS, sanitized filenames, Drive never shared                                                                                                     | TC-SEC-03                                                                                                                 |
| 7   | Snapshot privacy | Allowlist builder (explicit field mapping), key-set test, publish fails if any value outside `authorName` contains an actor e-mail                                                                                                              | TC-SEC-06                                                                                                                 |
| 8   | Secrets          | Server-only env; no `NEXT_PUBLIC_` secrets; log redaction (`lib/log.ts`); `pnpm scan:secrets` (bundles) and `--repo` (tracked files incl. local `.env.local` values and the admin e-mail) in CI                                                 | TC-SEC-07                                                                                                                 |
| 9   | Supply chain     | Lockfile, exact versions ≥ 7 days old, pnpm 12 build-script allowlist (`esbuild` only), Actions pinned to SHAs, `pnpm audit` report in CI                                                                                                       | —                                                                                                                         |
| 10  | Least privilege  | GAS scopes `spreadsheets.currentonly` + `drive.file`; single-repo fine-grained PAT; separate dev/prod resources                                                                                                                                 | —                                                                                                                         |
| 11  | Audit            | Every mutation, coalesce, transition, and failed locked mutation appends to `AuditLog`                                                                                                                                                          | dispatcher tests                                                                                                          |

`dangerouslySetInnerHTML` is used only for `renderMarkdown()` output and for a static, constant theme-initialisation script in the admin root layout (no user input).

## Threat model status (plan §17.2)

| #   | Threat                      | Status                                                                |
| --- | --------------------------- | --------------------------------------------------------------------- |
| T1  | Spoofed write to GAS        | mitigated, tested (emulator); live PoC-1 pending                      |
| T2  | Replay                      | mitigated, tested                                                     |
| T3  | Tampered payload            | mitigated, tested                                                     |
| T4  | Non-admin access            | mitigated, unit-tested; live Google test pending O-05                 |
| T5  | CSRF                        | mitigated, tested                                                     |
| T6  | Stored XSS                  | mitigated, tested; CSP header check on staging pending                |
| T7  | Draft/PII leak              | mitigated, tested                                                     |
| T8  | Secret in bundle            | scan in CI                                                            |
| T9  | Malicious upload            | mitigated, tested                                                     |
| T10 | Formula injection           | escape codec, tested in memory; live PoC-4 pending                    |
| T11 | Defacement via leaked token | single-repo PAT, runbook R7                                           |
| T12 | GAS quota exhaustion        | accepted residual risk: URL is server-side only; rejections are cheap |
| T13 | Lost update                 | version check under lock, TC-CONC-01                                  |
| T14 | Duplicate publish           | idempotency key + coalescing, TC-PUB-04/05                            |

## Notes and accepted risks

- `GET /api/publish/:jobId` advances an existing job (plan §11). It requires a session and cannot start new work; a forged cross-site GET can at most advance a job the admin already requested.
- The local "dev login" is compiled in only for `next dev` with `ZIDCMS_DEV_LOGIN=true` and outside Vercel.
- Public repository: all published content and media remain in Git history forever (owner decision G2).
- Accidentally committed secret → rotate immediately (history rewrite alone is insufficient once public).

## Reporting

Please report vulnerabilities privately to the repository owner (GitHub private vulnerability reporting once enabled) rather than in public issues.

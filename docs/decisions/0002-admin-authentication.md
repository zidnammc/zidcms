# 0002 — Admin authentication

- **Status:** accepted (2026-11-21).

## Decision

- **Auth.js v5** (`next-auth@5.0.0-beta.32`, published 2026-07-20) with the Google provider. The stable `next-auth@4.24.15` also supports Next 16, but v5 is the App-Router-native line and uses the `AUTH_*` variable names in the plan. Risk: still a beta tag — pinned exactly, revisit at release.
- Sign-in allowed only when `email_verified === true` and the lower-cased address is in `ADMIN_EMAILS` (`apps/admin/lib/auth-policy.ts`, unit-tested). Basic scopes only: `openid email profile`.
- JWT session strategy, `maxAge` 7 days; Auth.js defaults give httpOnly, `SameSite=Lax`, `Secure` on HTTPS cookies.
- `requireAdmin()` is called in every route handler (`lib/http.ts#route`) and every dashboard page (`lib/data.ts#getAdmin`); the allowlist is re-read from the environment on every request. No middleware/proxy is used as a security boundary.
- Every mutation requires `Origin === ADMIN_URL` (missing Origin is rejected). Server Actions are used only for sign-in/sign-out; Next.js applies its own Origin check to them.
- All admin responses send `X-Robots-Tag: noindex, nofollow`, CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.

## Local development addition

- A Credentials provider "dev-login" exists **only** when `NODE_ENV === 'development'`, `VERCEL` is unset, and `ZIDCMS_DEV_LOGIN=true`; it still enforces the allowlist. Production builds (`next build` sets `NODE_ENV=production`) never register it. Covered by `lib/security.test.ts`.

## Evidence

- `apps/admin/lib/security.test.ts`: TC-AUTH-02 (policy), TC-AUTH-03 (all 25+ API handlers → 401 without session), TC-AUTH-05 (foreign/missing Origin → 403).
- TC-AUTH-01/04 (real Google sign-in/out) need the OAuth client (O-05) — pending.

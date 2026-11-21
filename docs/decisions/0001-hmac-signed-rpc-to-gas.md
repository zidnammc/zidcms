# 0001 — Admin ↔ Apps Script: HMAC-signed RPC to a GAS web app

- **Status:** accepted (2026-11-21). **PoC-1 passed against the real dev deployment on 2026-11-21** (TC-GAS-01…08; first call ~11 s cold start, then ~1.3–1.6 s per call).
- **Context:** Apps Script web apps deployed as _Execute as: Me_ / _Anyone_ are reachable by anyone with the URL. `doPost(e)` cannot read request headers, always answers HTTP 200, and replies via a 302 to `script.googleusercontent.com` **[V per plan]**.

## Decision

- Body `{ "e": "<envelope JSON string>", "s": "<hex HMAC-SHA256(secret, e)>" }`; the signature covers the exact string (no canonicalization).
- Verification order (cheapest first) is implemented once in `packages/core/src/rpc.ts#verifyRequest` and used by the GAS dispatcher: size ≤ 5 MB → JSON shape → signature (constant-time compare) → `v` + timestamp window ±300 s → nonce replay cache (TTL 600 s; nonce is only consumed after a valid signature) → action allowlist → actor e-mail.
- HMAC key = UTF-8 bytes of the shared secret on both sides (`createHmac` in Node, `Utilities.computeHmacSha256Signature(value, key, UTF_8)` in GAS). Shared test vectors: `packages/core/src/rpc.vectors.json`.
- GAS fails closed when `HMAC_SECRET` is missing or shorter than 32 characters.
- Rejections return a generic message (`Permintaan ditolak.`) plus the code; the reason is logged with `requestId` only.
- The admin client (`apps/admin/lib/gas-client.ts`) follows redirects, treats non-JSON/HTML responses as retryable `UPSTREAM_ERROR`, retries **reads only** (max 2, jittered backoff), 30 s timeout.

## Consequences

- The GAS URL is reachable by design; junk requests still consume executions (residual risk T12, documented).
- Fallback A (Apps Script API `scripts.run` with an owner refresh token) and Fallback B (service account, removes GAS) remain available; neither is implemented.

## Evidence so far

- `packages/core/src/rpc.test.ts` (TC-GAS-01…07 at protocol level) and `services/apps-script/src/dispatcher.test.ts` (TC-GAS-08, fail-closed secret).
- `scripts/poc/hmac-call.ts` passes all TC-GAS-01…08 against the local emulator and against the real Apps Script dev web app (`ZIDCMS_ENV_FILE=.local/secrets/dev.env pnpm poc:gas`).

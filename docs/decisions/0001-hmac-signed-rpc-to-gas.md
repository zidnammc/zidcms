# 0001 — Admin ↔ Apps Script: HMAC-signed RPC to a GAS web app

- **Status:** accepted (2026-11-21). Live validation pending PoC-1 against a real deployment (owner Day-0 items O-03/O-04/O-08).
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
- `scripts/poc/hmac-call.ts` passes all TC-GAS-01…08 against the local emulator; the same script is PoC-1 once a real URL exists.

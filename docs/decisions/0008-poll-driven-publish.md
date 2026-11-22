# 0008: Publish orchestration is poll-driven

- **Status:** accepted (2026-11-21).

## Decision

- No workers/cron. `GET /api/publish/:jobId` performs at most one idempotent step (`apps/admin/lib/publish/orchestrator.ts#advanceJob`).
- **Step claim (addition):** before a side effect the poller calls `publish.claimStep`, which sets `step_lease_until` (60 s; 240 s for `committing`) under the GAS lock. A concurrent poller sees `claimed: false` and just returns the job. State changes use compare-and-set (`publish.updateJob` with `from_state`), which also releases the claim.
- Job lease (`lease_expires_at`, 10 min) is extended on each claim/transition; expired jobs simply resume on the next poll.
- `publish.acquire`: same idempotency key → same job; an active job → `rerun_requested = TRUE` and the same job (`coalesced`); a rollback while a job is active → `PUBLISH_IN_PROGRESS`. When a job with `rerun_requested` reaches `live`, GAS creates the follow-up job atomically and returns it (`followUp`).
- `collecting` builds the snapshot and compares checksums with the live snapshot (no-op → `live` without a commit). Because a full snapshot cannot be stored in a 50k-character cell, `committing` rebuilds it from Sheets (or the rollback target commit) and records the possibly updated checksum.
- Timeouts: `deploying` 15 min (`DEPLOY_TIMEOUT`), `verifying` 3 min (`VERIFY_TIMEOUT`), measured from `state_entered_at`. Retryable errors (`GITHUB_ERROR`, `UPSTREAM_ERROR`, `LOCK_TIMEOUT`) release the claim and are retried up to 3 attempts per step.
- On failure the snapshot row (if committed) becomes `failed`; the previous live snapshot is untouched. On success the snapshot becomes `live` and the previous one `superseded`.
- **GET with a side effect:** advancing an already-requested job via GET is accepted; it requires an admin session and can only move a job the admin already started. Documented in `docs/security.md`.

## Schema additions to `PublishJobs`

`step_lease_until`, `deploy_detail` (Vercel sub-state / human-readable progress), `state_entered_at`.

## Evidence

`apps/admin/lib/publish/orchestrator.test.ts` runs complete jobs through the real dispatcher: TC-PUB-02/03/04/06/07/08/09/10, deploy timeout, transient-error retry. `pnpm smoke:local` exercises the same flow over HTTP.

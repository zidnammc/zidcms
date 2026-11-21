# Benchmarks

**Status: not yet measured.** No numbers in this file may be quoted until the runs below exist with raw output in `tests/load/results/`.

## Plan (from execution plan §21)

### Public site (owner approves levels first)

- Targets: `/`, one post, one page, `/zidcms-version.json`.
- 1, 10, 50, 100 virtual users, 60 s each, after warm-up. Higher levels only with approval.
- Record p50/p95/p99, RPS, error rate, `x-vercel-cache` distribution, bytes, tester location/network.
- Keep total load-test transfer ≤ 5 GB/month (5 % of the Hobby allotment); stop on any Vercel usage warning.
- Confirm zero function invocations for the web project in the Vercel dashboard.

### Admin / Apps Script (dev spreadsheet only)

- Single-call latency: `posts.list` at 50/200/500 rows, `posts.get`, `posts.update`.
- Write contention: 2/5/10 parallel writers → success rate, `LOCK_TIMEOUT` rate.
- Publish end-to-end at 10/100/500 items, broken down by job state.
- Snapshot size and build time vs. item count; first item count where an RPC exceeds 10 s.

## Local reference only (not a benchmark)

`pnpm smoke:local` on the developer laptop with the in-memory emulator completed each publish job in ~2–7 s (local file target, no Vercel build). This says nothing about production latency.

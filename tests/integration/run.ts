import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LIMITS } from '../../packages/core/src/index';
import { attempt, type Check, note, type Outcome, protocolChecks, runChecks } from '../../scripts/lib/gas-checks';
import { call, GAS_URL } from '../../scripts/lib/rpc';
import { ROUND_TRIP_SAMPLES } from '../../scripts/lib/samples';

interface Item {
  id: string;
  slug: string;
  title: string;
  version: number;
  excerpt: string;
  content_markdown: string;
}

interface Job {
  id: string;
  state: string;
  rerun_requested: boolean;
}

const host = new URL(GAS_URL).hostname;
const target = host === 'localhost' || host === '127.0.0.1' ? 'emulator' : 'apps-script';
const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const created: Item[] = [];

async function create(n: string, extra: Record<string, unknown> = {}): Promise<Item> {
  const item = await call<Item>('posts.create', {
    title: `IT ${stamp} ${n}`,
    slug: `it-${stamp}-${n}`,
    content_markdown: 'integration test',
    ...extra,
  });
  created.push(item);
  return item;
}

async function withLockRetry(action: string, payload: unknown, counter: { lockTimeouts: number }): Promise<Outcome> {
  for (let i = 0; ; i++) {
    const res = await attempt(action, payload);
    if (res.code !== 'LOCK_TIMEOUT' || i >= 3) return res;
    counter.lockTimeouts += 1;
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
}

const tally = (results: Outcome[]) =>
  results.reduce<Record<string, number>>((acc, r) => {
    const key = r.ok ? 'ok' : (r.code ?? 'unknown');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};

function dataChecks(): Check[] {
  return [
    {
      id: 'TC-DATA-01/02/03',
      name: 'type-coercion, formula-injection and Unicode round trip',
      run: async () => {
        let failed = 0;
        for (const [i, value] of ROUND_TRIP_SAMPLES.entries()) {
          const item = await create(`rt${i}`, { excerpt: value, content_markdown: value });
          const read = await call<Item>('posts.get', { id: item.id });
          const ok = read.excerpt === value && read.content_markdown === value;
          if (!ok) {
            failed += 1;
            note(`FAIL ${JSON.stringify(value)} → ${JSON.stringify(read.excerpt)}`);
          }
        }
        note(`${ROUND_TRIP_SAMPLES.length - failed}/${ROUND_TRIP_SAMPLES.length} values unchanged`);
        return failed === 0;
      },
    },
    {
      id: 'TC-DATA-04',
      name: `field limits enforced (body ${LIMITS.BODY} accepted, ${LIMITS.BODY + 1} rejected)`,
      run: async () => {
        const body = `${'é'.repeat(LIMITS.BODY - 1)}=`;
        const item = await create('limit', { content_markdown: body });
        const read = await call<Item>('posts.get', { id: item.id });
        const over = await attempt('posts.create', {
          title: `IT ${stamp} over`,
          slug: `it-${stamp}-over`,
          content_markdown: 'x'.repeat(LIMITS.BODY + 1),
        });
        const titleOver = await attempt('posts.update', {
          id: item.id,
          expected_version: 1,
          patch: { title: 't'.repeat(LIMITS.TITLE + 1) },
        });
        note(
          `${body.length} chars stored intact: ${read.content_markdown === body}; ${LIMITS.BODY + 1} chars → ${over.code}; title ${LIMITS.TITLE + 1} → ${titleOver.code}`,
        );
        return (
          read.content_markdown === body && over.code === 'VALIDATION_ERROR' && titleOver.code === 'VALIDATION_ERROR'
        );
      },
    },
    {
      id: 'TC-DATA-05',
      name: 'manually corrupted row reported and excluded',
      run: async () => {
        const health = await call<{ invalid_row_count: number; invalid_rows: Record<string, number> }>('system.health');
        note(
          `invalid_row_count=${health.invalid_row_count}; corruption needs a manual sheet edit (contract test dispatcher.test.ts covers detection; manual procedure in docs/operations.md)`,
        );
        return 'skip';
      },
    },
    {
      id: 'TC-DATA-06',
      name: 'setup idempotent (run twice, no duplicate sheets/columns)',
      run: async () => {
        const before = await call<{ row_counts: Record<string, number>; missing_sheets: string[] }>('system.health');
        const first = await attempt('system.setup', {});
        const second = await attempt('system.setup', {});
        const after = await call<{ row_counts: Record<string, number>; missing_sheets: string[] }>('system.health');
        const nothingAdded = (o: Outcome) => {
          const d = o.data as { created_sheets?: string[]; added_columns?: Record<string, string[]> };
          return (
            o.ok &&
            Array.isArray(d.created_sheets) &&
            d.created_sheets.length === 0 &&
            Object.keys(d.added_columns ?? {}).length === 0
          );
        };
        const sameSheets =
          JSON.stringify(Object.keys(before.row_counts).sort()) ===
          JSON.stringify(Object.keys(after.row_counts).sort());
        note(
          `setup #1 ${JSON.stringify(first.data).slice(0, 120)}; setup #2 ${JSON.stringify(second.data).slice(0, 120)}`,
        );
        if (!first.ok && first.code === 'FORBIDDEN') {
          note('setup disabled in this environment (prod) — expected');
          return sameSheets;
        }
        return nothingAdded(first) && nothingAdded(second) && sameSheets && after.missing_sheets.length === 0;
      },
    },
    {
      id: 'TC-DATA-07',
      name: 'soft delete hides from list, restore works',
      run: async () => {
        const item = await create('trash');
        const inList = async (status: string) =>
          (await call<{ items: Item[] }>('posts.list', { status, q: item.slug, limit: 50 })).items.some(
            (i) => i.id === item.id,
          );
        const del = await call<{ item: Item }>('posts.softDelete', { id: item.id, expected_version: 1 });
        const hidden = !(await inList('all')) && (await inList('trash'));
        const restored = await call<{ item: Item }>('posts.restore', {
          id: item.id,
          expected_version: del.item.version,
        });
        created[created.length - 1] = restored.item;
        const back = (await inList('all')) && !(await inList('trash'));
        note(`after delete hidden=${hidden}; after restore visible=${back} v${restored.item.version}`);
        return hidden && back;
      },
    },
  ];
}

function concurrencyChecks(): Check[] {
  return [
    {
      id: 'TC-CONC-01',
      name: '10 parallel updates at the same version → exactly 1 success, 9 VERSION_CONFLICT',
      run: async () => {
        const item = await create('conc1');
        const counter = { lockTimeouts: 0 };
        const results = await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            withLockRetry(
              'posts.update',
              { id: item.id, expected_version: 1, patch: { title: `IT ${stamp} w${i}` } },
              counter,
            ),
          ),
        );
        const final = await call<Item>('posts.get', { id: item.id });
        const revisions = await call<{ version: number }[]>('posts.revisions', { id: item.id });
        const counts = tally(results);
        note(
          `${JSON.stringify(counts)}; LOCK_TIMEOUT retried ${counter.lockTimeouts}x; final v${final.version}; revisions ${revisions.length}; latency p50 ${percentile(
            results.map((r) => r.ms),
            50,
          )} ms, max ${Math.max(...results.map((r) => r.ms))} ms`,
        );
        created[created.indexOf(item)] = final;
        return counts.ok === 1 && counts.VERSION_CONFLICT === 9 && final.version === 2 && revisions.length === 2;
      },
    },
    {
      id: 'TC-CONC-02',
      name: '5 parallel creates with the same slug → exactly 1 success',
      run: async () => {
        const slug = `it-${stamp}-same`;
        const counter = { lockTimeouts: 0 };
        const results = await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
            withLockRetry('posts.create', { title: `IT ${stamp} same ${i}`, slug, content_markdown: 'x' }, counter),
          ),
        );
        for (const r of results) if (r.ok) created.push(r.data as Item);
        const counts = tally(results);
        note(`${JSON.stringify(counts)}; LOCK_TIMEOUT retried ${counter.lockTimeouts}x`);
        return counts.ok === 1 && counts.SLUG_CONFLICT === 4;
      },
    },
    {
      id: 'TC-CONC-03',
      name: 'lock timeout surfaces LOCK_TIMEOUT',
      run: async () => {
        note('simulated in contract test dispatcher.test.ts (LockService cannot be held from outside)');
        return 'skip';
      },
    },
  ];
}

function publishChecks(): Check[] {
  return [
    {
      id: 'TC-PUB-04/05',
      name: 'parallel publish requests → one job (rerun_requested); same idempotency key → same job',
      run: async () => {
        const { active } = await call<{ active: Job | null }>('publish.listJobs', { limit: 1 });
        if (active) {
          note(`job ${active.id.slice(0, 8)} is active (${active.state}); skipped to avoid interfering`);
          return 'skip';
        }
        const keys = Array.from({ length: 5 }, (_, i) => `it-${stamp}-pub-${i}`);
        const results = await Promise.all(
          keys.map((k) => attempt('publish.acquire', { type: 'publish', idempotency_key: k })),
        );
        const jobs = results.map((r) => (r.data as { job: Job; coalesced: boolean; existing: boolean }) ?? null);
        const ids = new Set(jobs.map((j) => j?.job.id));
        const creators = jobs.flatMap((j, i) => (j && !j.coalesced && !j.existing ? [i] : []));
        const fresh = creators.length;
        const creatorKey = keys[creators[0] ?? 0];
        const again = await call<{ job: Job; existing: boolean }>('publish.acquire', {
          type: 'publish',
          idempotency_key: creatorKey,
        });
        const job = await call<Job>('publish.getJob', { id: jobs[0]?.job.id });
        note(
          `${JSON.stringify(tally(results))}; distinct jobs ${ids.size}; created ${fresh}; rerun_requested=${job.rerun_requested}; repeat key existing=${again.existing} same=${again.job.id === job.id}`,
        );
        if (job.state === 'queued') {
          await call('publish.updateJob', {
            id: job.id,
            from_state: 'queued',
            to_state: 'failed',
            fields: {
              error_code: 'TEST_CLEANUP',
              error_message: `integration test ${stamp}: job created only to test coalescing`,
            },
          });
          note(`job ${job.id.slice(0, 8)} closed as failed/TEST_CLEANUP`);
        }
        return (
          results.every((r) => r.ok) &&
          ids.size === 1 &&
          fresh === 1 &&
          job.rerun_requested &&
          again.existing &&
          again.job.id === job.id
        );
      },
    },
  ];
}

async function cleanup() {
  let removed = 0;
  for (const item of created) {
    const current = await attempt('posts.get', { id: item.id });
    const record = current.data as Item & { deleted_at: string | null };
    if (!current.ok || record.deleted_at) continue;
    const res = await attempt('posts.softDelete', { id: item.id, expected_version: record.version });
    if (res.ok) removed += 1;
  }
  console.log(`cleanup: ${removed} test posts moved to trash`);
}

async function main() {
  const started = new Date();
  console.log(`Integration suite against ${target} (${target === 'emulator' ? host : 'URL redacted'}) run ${stamp}`);
  const health = await call<{ environment: string; schema_version: number }>('system.health');
  if (health.environment === 'prod') {
    console.error('Refusing to run against ENVIRONMENT=prod (plan §18.1).');
    process.exit(2);
  }
  console.log(`environment=${health.environment} schema_version=${health.schema_version}`);
  const only = process.argv[2];
  const groups: [string, () => Promise<Check[]> | Check[]][] = [
    ['gas', protocolChecks],
    ['data', dataChecks],
    ['conc', concurrencyChecks],
    ['pub', publishChecks],
  ];
  const results = [];
  try {
    for (const [name, make] of groups) {
      if (only && only !== name) continue;
      console.log(`\n[${name}]`);
      results.push(...(await runChecks(await make())));
    }
  } finally {
    await cleanup().catch((err) => console.error('cleanup failed:', err));
  }
  const failed = results.filter((r) => r.result === 'FAIL');
  const summary = `${results.filter((r) => r.result === 'PASS').length} passed, ${failed.length} failed, ${results.filter((r) => r.result === 'SKIP').length} skipped`;
  console.log(`\nIntegration (${target}): ${summary}`);
  const dir = resolve(import.meta.dirname, 'results');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, `${started.toISOString().replace(/[:.]/g, '-')}-${target}.json`),
    `${JSON.stringify({ target, environment: health.environment, startedAt: started.toISOString(), summary, results }, null, 2)}\n`,
  );
  process.exit(failed.length ? 1 : 0);
}

void main();

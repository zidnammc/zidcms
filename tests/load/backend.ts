import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encode } from '@auth/core/jwt';
import { attempt, type Outcome } from '../../scripts/lib/gas-checks';
import { call } from '../../scripts/lib/rpc';

interface Summary {
  id: string;
  title: string;
  slug: string;
  status: string;
  version: number;
  deleted_at: string | null;
}

const PREFIX = 'Bench ';
const command = process.argv[2] ?? 'latency';
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? (process.argv[i + 1] as string) : fallback;
};
const resultsDir = resolve(import.meta.dirname, 'results');
const started = new Date();

const pct = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] as number)
    : 0;
};
const stats = (values: number[]) => ({
  n: values.length,
  p50: pct(values, 50),
  p95: pct(values, 95),
  max: pct(values, 100),
});

function save(data: Record<string, unknown>) {
  mkdirSync(resultsDir, { recursive: true });
  const file = resolve(resultsDir, `backend-${started.toISOString().replace(/[:.]/g, '-')}-${command}.json`);
  writeFileSync(
    file,
    `${JSON.stringify({ command, startedAt: started.toISOString(), finishedAt: new Date().toISOString(), ...data }, null, 2)}\n`,
  );
  console.log(`→ ${file}`);
}

async function pool<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return out;
}

async function allPosts(status = 'all'): Promise<Summary[]> {
  const items: Summary[] = [];
  let cursor: string | null = '0';
  while (cursor !== null) {
    const page: { items: Summary[]; nextCursor: string | null } = await call('posts.list', {
      status,
      limit: 50,
      cursor,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  }
  return items;
}

const benchPosts = async (status = 'all') => (await allPosts(status)).filter((p) => p.title.startsWith(PREFIX));

function body(n: number): string {
  const para =
    'Paragraf contoh untuk pengukuran kinerja ZidCMS. Teks ini netral dan hanya dipakai untuk mengisi baris spreadsheet dengan ukuran yang realistis. ';
  return [
    `## Bagian ${n}`,
    para.repeat(6),
    '### Daftar',
    '- satu\n- dua\n- tiga',
    para.repeat(6),
    `> Kutipan nomor ${n}.`,
  ].join('\n\n');
}

async function timed(action: string, payload: unknown): Promise<Outcome> {
  const res = await attempt(action, payload);
  if (!res.ok) console.log(`  ${action} → ${res.code}`);
  return res;
}

async function latency() {
  const samples = Number(arg('samples', '10'));
  const health = await call<{ row_counts: Record<string, number> }>('system.health');
  const rows = health.row_counts.Posts ?? 0;
  let target = (await benchPosts('draft'))[0];
  if (!target) {
    target = await call<Summary>('posts.create', {
      title: `${PREFIX}latency`,
      slug: `bench-latency-${Date.now().toString(36)}`,
      content_markdown: body(0),
    });
  }
  const result: Record<string, ReturnType<typeof stats> & { errors: number }> = {};
  const measure = async (name: string, action: string, payload: () => unknown) => {
    const ms: number[] = [];
    let errors = 0;
    for (let i = 0; i < samples; i++) {
      const res = await timed(action, payload());
      if (res.ok) ms.push(res.ms);
      else errors += 1;
    }
    result[name] = { ...stats(ms), errors };
    console.log(
      `  ${name}: p50 ${result[name].p50} ms, p95 ${result[name].p95} ms, max ${result[name].max} ms (${errors} errors)`,
    );
  };
  console.log(`Posts rows: ${rows}`);
  await measure('system.health', 'system.health', () => ({}));
  await measure('posts.list(limit 20)', 'posts.list', () => ({ limit: 20 }));
  await measure('posts.list(limit 50, q)', 'posts.list', () => ({ limit: 50, q: 'bench' }));
  await measure('posts.get', 'posts.get', () => ({ id: target.id }));
  let version = (await call<Summary>('posts.get', { id: target.id })).version;
  const updates: number[] = [];
  let updateErrors = 0;
  for (let i = 0; i < samples; i++) {
    const res = await timed('posts.update', {
      id: target.id,
      expected_version: version,
      patch: { excerpt: `latency ${i}` },
    });
    if (res.ok) {
      updates.push(res.ms);
      version = (res.data as { item: Summary }).item.version;
    } else updateErrors += 1;
  }
  result['posts.update'] = { ...stats(updates), errors: updateErrors };
  console.log(`  posts.update: p50 ${result['posts.update'].p50} ms, p95 ${result['posts.update'].p95} ms`);
  await measure('publish.readPublished', 'publish.readPublished', () => ({}));
  await measure('editor.context', 'editor.context', () => ({ kind: 'post', id: target.id }));
  save({ postsRows: health.row_counts, samples, result });
}

async function seed() {
  const to = Number(arg('to', '50'));
  const existing = await benchPosts();
  const missing = Math.max(0, to - existing.length);
  console.log(`bench posts: ${existing.length}; creating ${missing}`);
  const stamp = Date.now().toString(36);
  const t0 = Date.now();
  const res = await pool(
    Array.from({ length: missing }, (_, i) => existing.length + i + 1),
    Number(arg('concurrency', '3')),
    (n) =>
      timed('posts.create', {
        title: `${PREFIX}${String(n).padStart(4, '0')}`,
        slug: `bench-${String(n).padStart(4, '0')}-${stamp}`,
        excerpt: `Artikel pengukuran nomor ${n}.`,
        content_markdown: body(n),
      }),
  );
  const ms = res.filter((r) => r.ok).map((r) => r.ms);
  console.log(
    `created ${ms.length}/${missing} in ${Math.round((Date.now() - t0) / 1000)} s; create p50 ${pct(ms, 50)} ms, p95 ${pct(ms, 95)} ms`,
  );
  save({
    to,
    created: ms.length,
    errors: res.filter((r) => !r.ok).map((r) => r.code),
    createMs: stats(ms),
    wallSeconds: Math.round((Date.now() - t0) / 1000),
  });
}

async function contention() {
  const posts = (await benchPosts('draft')).slice(0, 10);
  if (posts.length < 10) throw new Error('seed at least 10 bench posts first');
  const levels = [];
  for (const writers of [2, 5, 10]) {
    const fresh = await Promise.all(posts.slice(0, writers).map((p) => call<Summary>('posts.get', { id: p.id })));
    const t0 = Date.now();
    const res = await Promise.all(
      fresh.map((p, i) =>
        attempt('posts.update', {
          id: p.id,
          expected_version: p.version,
          patch: { excerpt: `contention ${writers}/${i}` },
        }),
      ),
    );
    const ok = res.filter((r) => r.ok);
    const level = {
      writers,
      success: ok.length,
      lockTimeouts: res.filter((r) => r.code === 'LOCK_TIMEOUT').length,
      otherErrors: res.filter((r) => !r.ok && r.code !== 'LOCK_TIMEOUT').map((r) => r.code),
      latency: stats(res.map((r) => r.ms)),
      wallMs: Date.now() - t0,
    };
    console.log(
      `  ${writers} writers: ${level.success} ok, ${level.lockTimeouts} LOCK_TIMEOUT, p50 ${level.latency.p50} ms, max ${level.latency.max} ms`,
    );
    levels.push(level);
  }
  save({ levels });
}

async function adminSession() {
  const admin = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
  const email = (process.env.ADMIN_EMAILS ?? '').split(',')[0]?.trim() ?? '';
  const secret = process.env.AUTH_SECRET ?? '';
  if (!admin || !email || secret.length < 32) throw new Error('ADMIN_URL, ADMIN_EMAILS and AUTH_SECRET are required');
  const name = `${admin.startsWith('https:') ? '__Secure-' : ''}authjs.session-token`;
  const cookie = `${name}=${await encode({ token: { name: email, email, sub: email }, secret, salt: name, maxAge: 3600 })}`;
  return async <T>(method: string, path: string, data?: unknown): Promise<T> => {
    const res = await fetch(`${admin}${path}`, {
      method,
      headers: { cookie, origin: admin, ...(data ? { 'content-type': 'application/json' } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  };
}

async function setPublished(want: Set<string>, posts: Summary[]) {
  const changes = posts.filter((p) => (p.status === 'published') !== want.has(p.id));
  console.log(`changing status of ${changes.length} bench posts`);
  await pool(changes, 3, async (p) => {
    const current = await call<Summary>('posts.get', { id: p.id });
    await timed('posts.setStatus', {
      id: p.id,
      expected_version: current.version,
      to: want.has(p.id) ? 'published' : 'draft',
    });
  });
}

async function runPublish(api: Awaited<ReturnType<typeof adminSession>>, rollbackTo?: number) {
  const t0 = Date.now();
  const { job } = await api<{ job: { id: string } }>(
    'POST',
    rollbackTo ? '/api/publish/rollback' : '/api/publish',
    rollbackTo ? { idempotency_key: randomUUID(), target_version: rollbackTo } : { idempotency_key: randomUUID() },
  );
  const timeline: { state: string; atMs: number }[] = [];
  for (;;) {
    const { job: j } = await api<{
      job: {
        state: string;
        snapshot_version: number;
        git_commit_sha: string | null;
        error_code: string | null;
        deploy_detail: string;
      };
    }>('GET', `/api/publish/${job.id}`);
    if (timeline.at(-1)?.state !== j.state) {
      timeline.push({ state: j.state, atMs: Date.now() - t0 });
      console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)} s ${j.state} ${j.deploy_detail ?? ''}`);
    }
    if (j.state === 'live' || j.state === 'failed')
      return { jobId: job.id, final: j, timeline, totalMs: Date.now() - t0 };
    if (Date.now() - t0 > 20 * 60_000) throw new Error('publish did not finish in 20 min');
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function commitFacts(sha: string | null) {
  if (!sha) return null;
  const repo = process.env.GITHUB_REPO ?? '';
  const headers = {
    accept: 'application/vnd.github+json',
    ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
  const content = (await (
    await fetch(`https://api.github.com/repos/${repo}/contents/apps/web/content/dev/snapshot.json?ref=${sha}`, {
      headers,
    })
  ).json()) as { size?: number };
  const statuses = (await (
    await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/statuses?per_page=50`, { headers })
  ).json()) as { context: string; state: string; created_at: string }[];
  const web = statuses.filter((s) => s.context.includes(process.env.VERCEL_WEB_PROJECT ?? 'zidcms-web'));
  const first = web.map((s) => Date.parse(s.created_at)).sort()[0];
  const done = web.find((s) => s.state === 'success' || s.state === 'failure');
  return {
    snapshotBytes: content.size ?? null,
    vercelBuildSeconds: first && done ? Math.round((Date.parse(done.created_at) - first) / 1000) : null,
  };
}

async function publish() {
  const items = Number(arg('items', '10'));
  const api = await adminSession();
  const posts = await benchPosts();
  if (posts.length < items) throw new Error(`only ${posts.length} bench posts; seed first`);
  const sorted = [...posts].sort((a, b) => a.title.localeCompare(b.title));
  await setPublished(new Set(sorted.slice(0, items).map((p) => p.id)), sorted);
  const readMs: number[] = [];
  for (let i = 0; i < 3; i++) readMs.push((await timed('publish.readPublished', {})).ms);
  const run = await runPublish(api);
  const durations: Record<string, number> = {};
  run.timeline.forEach((t, i) => {
    durations[t.state] = (run.timeline[i + 1]?.atMs ?? run.totalMs) - t.atMs;
  });
  const facts = await commitFacts(run.final.git_commit_sha);
  console.log(
    `items ${items}: ${run.final.state} in ${Math.round(run.totalMs / 1000)} s; snapshot ${facts?.snapshotBytes ?? '?'} B; Vercel build ${facts?.vercelBuildSeconds ?? '?'} s`,
  );
  save({
    items,
    readPublishedMs: stats(readMs),
    jobId: run.jobId,
    final: run.final.state,
    error: run.final.error_code,
    snapshotVersion: run.final.snapshot_version,
    commit: run.final.git_commit_sha,
    totalSeconds: Math.round(run.totalMs / 1000),
    stateDurationsMs: durations,
    timeline: run.timeline,
    ...facts,
  });
}

async function cleanup() {
  const posts = await benchPosts();
  console.log(`unpublishing/trashing ${posts.length} bench posts`);
  await setPublished(new Set(), posts);
  await pool(posts, 3, async (p) => {
    const current = await call<Summary>('posts.get', { id: p.id });
    if (!current.deleted_at) await timed('posts.softDelete', { id: p.id, expected_version: current.version });
  });
  if (process.argv.includes('--publish')) {
    const run = await runPublish(await adminSession());
    console.log(`cleanup publish: ${run.final.state} v${run.final.snapshot_version}`);
  }
}

async function republish() {
  const run = await runPublish(await adminSession());
  console.log(`publish: ${run.final.state} v${run.final.snapshot_version} in ${Math.round(run.totalMs / 1000)} s`);
}

async function rollback() {
  const to = Number(arg('to', '0'));
  const run = await runPublish(await adminSession(), to);
  console.log(
    `rollback to v${to}: ${run.final.state} v${run.final.snapshot_version} commit ${run.final.git_commit_sha?.slice(0, 7)} ${run.final.error_code ?? ''}`,
  );
}

async function main() {
  const health = await call<{ environment: string }>('system.health');
  if (health.environment === 'prod') throw new Error('Refusing to benchmark ENVIRONMENT=prod (plan §18.1).');
  const commands: Record<string, () => Promise<void>> = {
    latency,
    seed,
    contention,
    publish,
    cleanup,
    republish,
    rollback,
  };
  const fn = commands[command];
  if (!fn) throw new Error(`unknown command ${command}; use ${Object.keys(commands).join('|')}`);
  await fn();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

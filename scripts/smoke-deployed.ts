import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminApi, type Job, waitForJob } from './lib/admin';

const root = resolve(import.meta.dirname, '..');
process.loadEnvFile(resolve(root, process.env.ZIDCMS_ENV_FILE ?? '.local/secrets/dev.env'));
const WEB = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
const stamp = Date.now().toString(36);
const evidence: Record<string, unknown> = { startedAt: new Date().toISOString(), web: new URL(WEB).host };

interface Item {
  id: string;
  slug: string;
  version: number;
}

const page = async (path: string) => {
  const res = await fetch(`${WEB}${path}?smoke=${Date.now()}`, { cache: 'no-store' });
  return { status: res.status, html: await res.text() };
};
const live = async () =>
  (await (await fetch(`${WEB}/zidcms-version.json?smoke=${Date.now()}`, { cache: 'no-store' })).json()) as {
    version: number;
    checksum: string;
  };

function assert(ok: boolean, message: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
  if (!ok) throw new Error(message);
}

async function main() {
  const api = await adminApi();
  const health = await api<{ admin: { environment: string; publishTarget: string }; gas: { environment?: string } }>(
    'GET',
    '/api/health',
  );
  evidence.health = {
    admin: health.admin.environment,
    target: health.admin.publishTarget,
    gas: health.gas.environment,
  };
  console.log(
    `admin ${health.admin.environment} (${health.admin.publishTarget}); GAS environment ${health.gas.environment}`,
  );
  assert(
    health.admin.environment.toLowerCase() === (health.gas.environment ?? '').toLowerCase(),
    'admin and GAS environments match',
  );
  const step = async (name: string, jobId: string) => {
    const run = await waitForJob(api, jobId, console.log);
    const version = await live();
    evidence[name] = {
      jobId,
      states: run.timeline.map((t) => t.state),
      final: run.job.state,
      snapshotVersion: run.job.snapshot_version,
      commit: run.job.git_commit_sha,
      seconds: Math.round(run.totalMs / 1000),
      live: version,
    };
    assert(
      run.job.state === 'live',
      `${name}: job ${jobId.slice(0, 8)} → ${run.job.state} ${run.job.error_code ?? ''}`,
    );
    return { job: run.job, version };
  };

  console.log('1. sacrificial post → publish');
  const created = await api<Item>('POST', '/api/posts', {
    title: `Uji rilis ${stamp}`,
    content_markdown: `Versi **pertama** artikel tumbal ${stamp}.`,
  });
  const published = await api<{ item: Item; publishJob: Job }>('POST', `/api/posts/${created.id}/status`, {
    expected_version: created.version,
    to: 'published',
  });
  const first = await step('publish', published.publishJob.id);
  assert(first.version.version === first.job.snapshot_version, `zidcms-version.json = v${first.version.version}`);
  assert((await page(`/blog/${created.slug}/`)).html.includes('pertama'), 'post page shows the first version');

  console.log('2. update → republish');
  const updated = await api<{ item: Item; publishJob: Job }>('PATCH', `/api/posts/${created.id}`, {
    expected_version: published.item.version,
    patch: { content_markdown: `Versi **kedua** artikel tumbal ${stamp}.` },
  });
  await step('update', updated.publishJob.id);
  assert((await page(`/blog/${created.slug}/`)).html.includes('kedua'), 'post page shows the second version');

  console.log(`3. rollback to v${first.job.snapshot_version}`);
  const rollback = await api<{ job: Job }>('POST', '/api/publish/rollback', {
    target_version: first.job.snapshot_version,
    idempotency_key: crypto.randomUUID(),
  });
  const rolled = await step('rollback', rollback.job.id);
  assert(rolled.version.checksum === first.version.checksum, 'rollback reproduces the first checksum as a new version');
  assert((await page(`/blog/${created.slug}/`)).html.includes('pertama'), 'post page shows the first version again');

  console.log('4. cleanup: unpublish, trash');
  const current = await api<Item>('GET', `/api/posts/${created.id}`);
  const unpublished = await api<{ item: Item; publishJob: Job }>('POST', `/api/posts/${created.id}/status`, {
    expected_version: current.version,
    to: 'draft',
  });
  await step('unpublish', unpublished.publishJob.id);
  assert((await page(`/blog/${created.slug}/`)).status === 404, 'post page is gone (404)');
  await api('DELETE', `/api/posts/${created.id}`, { expected_version: unpublished.item.version });

  evidence.finishedAt = new Date().toISOString();
  mkdirSync(resolve(root, 'tests/e2e/results'), { recursive: true });
  const file = resolve(root, `tests/e2e/results/smoke-${new URL(WEB).host}.json`);
  writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`SMOKE OK → ${file}`);
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

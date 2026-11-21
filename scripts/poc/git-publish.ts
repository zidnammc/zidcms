import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GitHubStore } from '../../apps/admin/lib/publish/github';
import { computeChecksum, emptySnapshot, versionFileOf } from '../../packages/core/src/index';

const envFile = resolve(import.meta.dirname, '../../apps/admin/.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const required = ['GITHUB_TOKEN', 'GITHUB_REPO', 'PUBLIC_SITE_URL'] as const;
for (const name of required) {
  if (!process.env[name]) {
    console.error(`PoC-2 needs ${required.join(', ')} (GITHUB_BRANCH optional, default main).`);
    process.exit(1);
  }
}

const store = new GitHubStore({
  token: process.env.GITHUB_TOKEN as string,
  repo: process.env.GITHUB_REPO as string,
  branch: process.env.GITHUB_BRANCH ?? 'main',
  contentRoot: process.env.CONTENT_ROOT ?? 'apps/web',
  statusContext: process.env.VERCEL_STATUS_CONTEXT ?? 'Vercel',
});
const site = (process.env.PUBLIC_SITE_URL as string).replace(/\/+$/, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const started = Date.now();
  const jobId = `poc2-${Date.now()}`;
  const base = emptySnapshot(site);
  const snapshot = { ...base, version: Number(process.argv[2] ?? 1), generatedAt: new Date().toISOString() };
  snapshot.site = { ...snapshot.site, description: `PoC-2 ${snapshot.generatedAt}` };
  snapshot.checksum = computeChecksum(snapshot);
  const sha = await store.commit({
    jobId,
    message: `content: poc-2 v${snapshot.version} (job ${jobId})`,
    snapshot,
    versionFile: versionFileOf(snapshot),
    media: [],
  });
  console.log(`commit ${sha} (${Date.now() - started} ms)`);
  console.log(`findCommitForJob → ${(await store.findCommitForJob(jobId)) === sha ? 'OK' : 'MISMATCH'}`);

  for (;;) {
    const status = await store.deployStatus(sha);
    console.log(`deploy: ${status.state} – ${status.detail} (${Math.round((Date.now() - started) / 1000)} s)`);
    if (status.state === 'success') break;
    if (status.state === 'failure') process.exit(1);
    if (Date.now() - started > 15 * 60_000) throw new Error('DEPLOY_TIMEOUT');
    await sleep(10_000);
  }
  for (;;) {
    const res = await fetch(`${site}/zidcms-version.json?ts=${Date.now()}`, { cache: 'no-store' });
    const live = res.ok ? await res.json() : null;
    console.log(`live: ${JSON.stringify(live)}`);
    if (live?.version === snapshot.version && live.checksum === snapshot.checksum) break;
    if (Date.now() - started > 18 * 60_000) throw new Error('VERIFY_TIMEOUT');
    await sleep(5_000);
  }
  console.log(`PoC-2 PASSED: commit ${sha} live at ${site} in ${Math.round((Date.now() - started) / 1000)} s`);
}

main().catch((err) => {
  console.error('PoC-2 FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

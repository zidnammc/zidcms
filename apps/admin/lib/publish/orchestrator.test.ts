import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { handleRpc } from '@zidcms/apps-script/src/dispatcher';
import { emptyState, memoryDeps } from '@zidcms/apps-script/src/memory';
import {
  type PublishJob,
  type RpcAction,
  type Snapshot,
  signEnvelope,
  type VersionFile,
  versionFileOf,
  ZidError,
} from '@zidcms/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { type AdvanceResult, advanceJob, type OrchestratorDeps } from './orchestrator';
import { type CommitInput, type DeployState, jobMarker, type SnapshotStore } from './store';

const SECRET = 'orchestrator-test-secret-0123456789abcdef';
let clock: number;
let gasDeps: ReturnType<typeof memoryDeps>;

async function call<T>(action: RpcAction, payload: unknown): Promise<T> {
  clock += 1;
  const body = signEnvelope(
    {
      v: 1,
      action,
      payload,
      ts: clock,
      nonce: randomBytes(16).toString('base64url'),
      actor: 'admin@example.com',
      requestId: randomUUID(),
    },
    (m) => createHmac('sha256', SECRET).update(m).digest('hex'),
  );
  const res = handleRpc(body, gasDeps);
  if (!res.ok) throw new ZidError(res.error.code, res.error.message, res.error.details);
  return res.data as T;
}

class FakeStore implements SnapshotStore {
  readonly kind = 'local' as const;
  commits = new Map<string, { input: CommitInput }>();
  deployed: VersionFile = { version: 0, checksum: 'sha256:empty', generatedAt: '' };
  nextDeploy: DeployState = 'success';
  failCommitTimes = 0;

  async commit(input: CommitInput) {
    if (this.failCommitTimes > 0) {
      this.failCommitTimes -= 1;
      throw new ZidError('GITHUB_ERROR', 'boom');
    }
    for (const m of input.media) await m.loadBase64();
    const sha = randomBytes(20).toString('hex');
    this.commits.set(sha, { input });
    return sha;
  }
  async findCommitForJob(jobId: string) {
    for (const [sha, c] of this.commits) if (c.input.message.includes(jobMarker(jobId))) return sha;
    return null;
  }
  async readSnapshot(sha: string): Promise<Snapshot> {
    const c = this.commits.get(sha);
    if (!c) throw new ZidError('NOT_FOUND', 'x');
    return c.input.snapshot;
  }
  async deployStatus(sha: string) {
    if (this.nextDeploy === 'success') {
      this.deployed = this.commits.get(sha)!.input.versionFile;
    }
    return { state: this.nextDeploy, detail: this.nextDeploy };
  }
}

let store: FakeStore;
let deps: OrchestratorDeps;

beforeEach(async () => {
  clock = Date.parse('2026-11-21T10:00:00.000Z');
  gasDeps = memoryDeps(emptyState({ HMAC_SECRET: SECRET, ENVIRONMENT: 'dev' }), { now: () => clock });
  await call('system.setup', {});
  store = new FakeStore();
  deps = {
    call,
    store,
    fetchVersion: async () => store.deployed,
    now: () => clock,
    siteUrl: 'https://site.example',
  };
});

async function publishPost(title: string, markdown = 'Isi') {
  const post = await call<{ id: string }>('posts.create', { title, content_markdown: markdown });
  await call('posts.setStatus', { id: post.id, expected_version: 1, to: 'published' });
  return post;
}

async function acquire(type: 'publish' | 'rollback' = 'publish', target?: number) {
  return (
    await call<{ job: PublishJob }>('publish.acquire', {
      type,
      idempotency_key: randomUUID(),
      ...(target ? { target_version: target } : {}),
    })
  ).job;
}

async function runToEnd(jobId: string, maxPolls = 20): Promise<AdvanceResult> {
  let result: AdvanceResult | null = null;
  for (let i = 0; i < maxPolls; i++) {
    result = await advanceJob(deps, jobId);
    if (result.job.state === 'live' || result.job.state === 'failed') return result;
    clock += 1_000;
  }
  throw new Error(`job stuck in ${result?.job.state}`);
}

describe('publish orchestrator', () => {
  it('TC-PUB-02 publish reaches live with matching version file', async () => {
    await publishPost('Halo');
    const job = await acquire();
    const { job: done } = await runToEnd(job.id);
    expect(done).toMatchObject({ state: 'live', snapshot_version: 1 });
    expect(store.deployed).toMatchObject({ version: 1, checksum: done.checksum });
    const snaps = await call<{ live: { version: number; status: string } }>('snapshots.list', {});
    expect(snaps.live).toMatchObject({ version: 1, status: 'live' });
  });

  it('TC-PUB-03/06 update produces a new version; unchanged content is a no-op', async () => {
    const post = await publishPost('Halo');
    await runToEnd((await acquire()).id);
    const noop = await runToEnd((await acquire()).id);
    expect(noop.job).toMatchObject({ state: 'live', snapshot_version: 1, git_commit_sha: null });
    expect(store.commits.size).toBe(1);
    await call('posts.update', { id: post.id, expected_version: 2, patch: { content_markdown: 'Isi baru' } });
    const second = await runToEnd((await acquire()).id);
    expect(second.job.snapshot_version).toBe(2);
    const snap = await store.readSnapshot(second.job.git_commit_sha!);
    expect(snap.posts[0]?.markdown).toBe('Isi baru');
  });

  it('TC-PUB-07 failed build keeps the previous version live', async () => {
    await publishPost('Halo');
    await runToEnd((await acquire()).id);
    await publishPost('Kedua');
    store.nextDeploy = 'failure';
    const failed = await runToEnd((await acquire()).id);
    expect(failed.job).toMatchObject({ state: 'failed', error_code: 'DEPLOY_FAILED' });
    expect(store.deployed.version).toBe(1);
    const snaps = await call<{ live: { version: number }; items: { version: number; status: string }[] }>(
      'snapshots.list',
      {},
    );
    expect(snaps.live.version).toBe(1);
    expect(snaps.items.find((s) => s.version === 2)?.status).toBe('failed');
  });

  it('deploy timeout after 15 minutes', async () => {
    await publishPost('Halo');
    store.nextDeploy = 'building';
    const job = await acquire();
    for (let i = 0; i < 4; i++) await advanceJob(deps, job.id);
    clock += 16 * 60 * 1000;
    const result = await advanceJob(deps, job.id);
    expect(result.job).toMatchObject({ state: 'failed', error_code: 'DEPLOY_TIMEOUT' });
  });

  it('TC-PUB-08 rollback creates a new version with the target content', async () => {
    const post = await publishPost('Halo', 'Versi satu');
    const v1 = await runToEnd((await acquire()).id);
    await call('posts.update', { id: post.id, expected_version: 2, patch: { content_markdown: 'Versi dua' } });
    await runToEnd((await acquire()).id);
    const rollback = await runToEnd((await acquire('rollback', 1)).id);
    expect(rollback.job).toMatchObject({ state: 'live', snapshot_version: 3, checksum: v1.job.checksum });
    const snap = await store.readSnapshot(rollback.job.git_commit_sha!);
    expect(snap).toMatchObject({ version: 3, basedOnVersion: 1 });
    expect(snap.posts[0]?.markdown).toBe('Versi satu');
    expect(versionFileOf(snap)).toEqual(store.deployed);
  });

  it('TC-PUB-09 a held step lease blocks other pollers until it expires', async () => {
    await publishPost('Halo');
    const job = await acquire();
    await call('publish.claimStep', { id: job.id, state: 'queued', lease_ms: 60_000 });
    expect((await advanceJob(deps, job.id)).job.state).toBe('queued');
    clock += 61_000;
    expect((await advanceJob(deps, job.id)).job.state).toBe('collecting');
    expect((await runToEnd(job.id)).job.state).toBe('live');
  });

  it('TC-PUB-04 coalesced request triggers a follow-up job', async () => {
    await publishPost('Halo');
    const job = await acquire();
    await advanceJob(deps, job.id);
    const coalesced = await call<{ coalesced: boolean }>('publish.acquire', {
      type: 'publish',
      idempotency_key: randomUUID(),
    });
    expect(coalesced.coalesced).toBe(true);
    const result = await runToEnd(job.id);
    expect(result.followUp).toMatchObject({ state: 'queued' });
  });

  it('TC-PUB-10 unknown media reference fails with a clear error', async () => {
    await publishPost('Rusak', '![x](zid-media:11111111-1111-4111-8111-111111111111)');
    const result = await runToEnd((await acquire()).id);
    expect(result.job.state).toBe('failed');
    expect(result.job.error_code).toBe('VALIDATION_ERROR');
    expect(result.job.error_message).toContain('media');
  });

  it('retries transient GitHub errors, then fails after 3 attempts', async () => {
    await publishPost('Halo');
    store.failCommitTimes = 1;
    expect((await runToEnd((await acquire()).id)).job.state).toBe('live');
    await publishPost('Lagi');
    store.failCommitTimes = 10;
    const failed = await runToEnd((await acquire()).id, 40);
    expect(failed.job).toMatchObject({ state: 'failed', error_code: 'GITHUB_ERROR' });
  });
});

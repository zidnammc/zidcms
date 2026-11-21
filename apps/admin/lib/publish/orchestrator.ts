import {
  buildSnapshot,
  LIMITS,
  type Media,
  mediaPath,
  type PublishedData,
  type PublishJob,
  type PublishJobState,
  type RpcAction,
  restampSnapshot,
  type Snapshot,
  type SnapshotRecord,
  snapshotItemCount,
  type VersionFile,
  versionFileOf,
  ZidError,
} from '@zidcms/core';
import { jobMarker, type MediaFile, type SnapshotStore } from './store';

export const DEPLOY_TIMEOUT_MS = 15 * 60 * 1000;
export const VERIFY_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_STEP_ATTEMPTS = 3;

export interface OrchestratorDeps {
  call: <T>(action: RpcAction, payload: unknown) => Promise<T>;
  store: SnapshotStore;
  fetchVersion: () => Promise<VersionFile | null>;
  now: () => number;
  siteUrl: string;
}

export interface AdvanceResult {
  job: PublishJob;
  followUp: PublishJob | null;
  warnings: string[];
}

interface SnapshotList {
  items: SnapshotRecord[];
  live: SnapshotRecord | null;
  latestVersion: number;
}

interface Assembled {
  snapshot: Snapshot;
  media: MediaFile[];
  warnings: string[];
  reuseMediaFromSha?: string;
  basedOnVersion: number | null;
}

class StepFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function assemble(deps: OrchestratorDeps, job: PublishJob, version: number): Promise<Assembled> {
  const generatedAt = new Date(deps.now()).toISOString();
  if (job.type === 'rollback') {
    const target = await deps.call<SnapshotRecord>('snapshots.get', { version: job.target_version });
    const source = await deps.store.readSnapshot(target.git_commit_sha);
    const snapshot = restampSnapshot(source, { version, basedOnVersion: target.version, generatedAt });
    const media = snapshot.media.map((m) => ({
      sha256: m.sha256,
      path: m.path,
      loadBase64: async () => {
        throw new ZidError('GITHUB_ERROR', `Media ${m.sha256} tidak ada di commit target.`);
      },
    }));
    return { snapshot, media, warnings: [], reuseMediaFromSha: target.git_commit_sha, basedOnVersion: target.version };
  }
  const data = await deps.call<PublishedData>('publish.readPublished', {});
  const result = buildSnapshot(data, { version, basedOnVersion: null, generatedAt, siteUrl: deps.siteUrl });
  if (!result.ok) throw new StepFailure('VALIDATION_ERROR', result.errors.join(' • '));
  const media = result.media.map((m: Media) => ({
    sha256: m.sha256,
    path: mediaPath(m),
    loadBase64: async () => (await deps.call<{ base64: string }>('media.getBytes', { id: m.id })).base64,
  }));
  return { snapshot: result.snapshot, media, warnings: result.warnings, basedOnVersion: null };
}

async function transition(
  deps: OrchestratorDeps,
  job: PublishJob,
  to: PublishJobState,
  fields: Record<string, unknown> = {},
): Promise<{ job: PublishJob; followUp: PublishJob | null }> {
  const res = await deps.call<{ updated: boolean; job: PublishJob; followUp: PublishJob | null }>('publish.updateJob', {
    id: job.id,
    from_state: job.state,
    to_state: to,
    fields,
  });
  return { job: res.job, followUp: res.followUp };
}

async function markSnapshot(deps: OrchestratorDeps, version: number | null, status: 'live' | 'failed') {
  if (!version) return;
  try {
    await deps.call('snapshots.setStatus', { version, status });
  } catch (err) {
    if (!(err instanceof ZidError && err.code === 'NOT_FOUND')) throw err;
  }
}

async function fail(deps: OrchestratorDeps, job: PublishJob, code: string, message: string) {
  await markSnapshot(deps, job.git_commit_sha ? job.snapshot_version : null, 'failed');
  return transition(deps, job, 'failed', { error_code: code, error_message: message.slice(0, LIMITS.JOB_ERROR) });
}

const elapsed = (deps: OrchestratorDeps, job: PublishJob) => deps.now() - Date.parse(job.state_entered_at);

async function step(deps: OrchestratorDeps, job: PublishJob): Promise<AdvanceResult> {
  const done = (r: { job: PublishJob; followUp: PublishJob | null }, warnings: string[] = []) => ({ ...r, warnings });
  switch (job.state) {
    case 'queued':
      return done(await transition(deps, job, 'collecting'));

    case 'collecting': {
      const snaps = await deps.call<SnapshotList>('snapshots.list', { limit: 1 });
      const version = snaps.latestVersion + 1;
      const { snapshot, warnings } = await assemble(deps, job, version);
      if (snaps.live && snaps.live.checksum === snapshot.checksum) {
        return done(
          await transition(deps, job, 'live', {
            checksum: snapshot.checksum,
            snapshot_version: snaps.live.version,
            deploy_detail: 'Tidak ada perubahan konten (no-op)',
          }),
          warnings,
        );
      }
      return done(
        await transition(deps, job, 'committing', { snapshot_version: version, checksum: snapshot.checksum }),
        warnings,
      );
    }

    case 'committing': {
      const version = job.snapshot_version as number;
      const assembled = await assemble(deps, job, version);
      const sha =
        (await deps.store.findCommitForJob(job.id)) ??
        (await deps.store.commit({
          jobId: job.id,
          message: `content: ${job.type === 'rollback' ? 'rollback' : 'publish'} v${version} ${jobMarker(job.id)}`,
          snapshot: assembled.snapshot,
          versionFile: versionFileOf(assembled.snapshot),
          media: assembled.media,
          reuseMediaFromSha: assembled.reuseMediaFromSha,
        }));
      await deps.call('snapshots.record', {
        version,
        checksum: assembled.snapshot.checksum,
        git_commit_sha: sha,
        item_count: snapshotItemCount(assembled.snapshot),
        media_count: assembled.snapshot.media.length,
        source_job_id: job.id,
        based_on_version: assembled.basedOnVersion,
      });
      return done(
        await transition(deps, job, 'deploying', {
          git_commit_sha: sha,
          checksum: assembled.snapshot.checksum,
          deploy_detail: 'Commit dibuat, menunggu build',
        }),
        assembled.warnings,
      );
    }

    case 'deploying': {
      const status = await deps.store.deployStatus(job.git_commit_sha as string);
      if (status.state === 'success')
        return done(await transition(deps, job, 'verifying', { deploy_detail: status.detail }));
      if (status.state === 'failure')
        return done(await fail(deps, job, 'DEPLOY_FAILED', `Build gagal: ${status.detail}`));
      if (elapsed(deps, job) > DEPLOY_TIMEOUT_MS) {
        return done(await fail(deps, job, 'DEPLOY_TIMEOUT', 'Build tidak selesai dalam 15 menit.'));
      }
      return done(await transition(deps, job, 'deploying', { deploy_detail: `${status.state}: ${status.detail}` }));
    }

    case 'verifying': {
      const live = await deps.fetchVersion().catch(() => null);
      if (live && live.version === job.snapshot_version && live.checksum === job.checksum) {
        await markSnapshot(deps, job.snapshot_version, 'live');
        return done(await transition(deps, job, 'live', { deploy_detail: 'zidcms-version.json cocok' }));
      }
      if (elapsed(deps, job) > VERIFY_TIMEOUT_MS) {
        return done(
          await fail(deps, job, 'VERIFY_TIMEOUT', 'Situs publik belum menayangkan versi baru setelah 3 menit.'),
        );
      }
      return done(
        await transition(deps, job, 'verifying', {
          deploy_detail: live ? `Situs masih v${live.version}` : 'zidcms-version.json belum dapat dibaca',
        }),
      );
    }

    default:
      return { job, followUp: null, warnings: [] };
  }
}

export async function advanceJob(deps: OrchestratorDeps, jobId: string): Promise<AdvanceResult> {
  const current = await deps.call<PublishJob>('publish.getJob', { id: jobId });
  if (current.state === 'live' || current.state === 'failed') return { job: current, followUp: null, warnings: [] };
  const claim = await deps.call<{ claimed: boolean; job: PublishJob }>('publish.claimStep', {
    id: jobId,
    state: current.state,
    lease_ms: current.state === 'committing' ? 240_000 : 60_000,
  });
  if (!claim.claimed) return { job: claim.job, followUp: null, warnings: [] };
  const job = claim.job;
  try {
    return await step(deps, job);
  } catch (err) {
    if (err instanceof StepFailure) return { ...(await fail(deps, job, err.code, err.message)), warnings: [] };
    const zid =
      err instanceof ZidError ? err : new ZidError('INTERNAL_ERROR', err instanceof Error ? err.message : 'unknown');
    if (zid.retryable && job.step_attempts < MAX_STEP_ATTEMPTS) {
      const released = await transition(deps, job, job.state, {
        deploy_detail: `Percobaan ${job.step_attempts} gagal (${zid.code}); akan dicoba lagi`,
      });
      return { ...released, warnings: [] };
    }
    return { ...(await fail(deps, job, zid.code, zid.message)), warnings: [] };
  }
}

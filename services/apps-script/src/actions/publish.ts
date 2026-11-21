import {
  isUuid,
  LIMITS,
  type PublishJob,
  type PublishJobState,
  type SnapshotRecord,
  type SnapshotStatus,
  ZidError,
} from '@zidcms/core';
import type { Ctx } from '../ports';
import { appendRecord, audit, type Entry, loadTable, type Table, writeEntry } from '../table';
import { publishedContent } from './content';
import { activeMedia } from './media';
import { readSettings } from './settings';
import { listTaxa } from './taxonomy';

const JOB_LEASE_MS = 10 * 60 * 1000;
const TERMINAL: PublishJobState[] = ['live', 'failed'];

const NEXT: Record<PublishJobState, PublishJobState[]> = {
  queued: ['collecting', 'failed'],
  collecting: ['committing', 'live', 'failed'],
  committing: ['deploying', 'failed'],
  deploying: ['verifying', 'failed'],
  verifying: ['live', 'failed'],
  live: [],
  failed: [],
};

const UPDATABLE_FIELDS = [
  'snapshot_version',
  'checksum',
  'git_commit_sha',
  'deploy_detail',
  'error_code',
  'error_message',
] as const;

function obj(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) throw new ZidError('BAD_REQUEST', 'Payload tidak valid.');
  return payload as Record<string, unknown>;
}

const iso = (ms: number) => new Date(ms).toISOString();

function jobs(ctx: Ctx): Table<PublishJob> {
  return loadTable<PublishJob>(ctx.sheets, 'PublishJobs');
}

function findJob(table: Table<PublishJob>, id: unknown): Entry<PublishJob> {
  if (!isUuid(id)) throw new ZidError('BAD_REQUEST', 'ID job tidak valid.');
  const entry = table.entries.find((e) => e.record.id === id);
  if (!entry) throw new ZidError('NOT_FOUND', 'Job publikasi tidak ditemukan.');
  return entry;
}

export function isActive(job: PublishJob): boolean {
  return !TERMINAL.includes(job.state);
}

function newJob(ctx: Ctx, type: PublishJob['type'], key: string, target: number | null): PublishJob {
  return {
    id: ctx.runtime.uuid(),
    type,
    idempotency_key: key,
    requested_by: ctx.actor,
    state: 'queued',
    target_version: target,
    snapshot_version: null,
    checksum: null,
    rerun_requested: false,
    lease_expires_at: iso(ctx.runtime.now() + JOB_LEASE_MS),
    step_lease_until: null,
    step_attempts: 0,
    git_commit_sha: null,
    deploy_detail: '',
    state_entered_at: ctx.nowIso,
    created_at: ctx.nowIso,
    updated_at: ctx.nowIso,
    finished_at: null,
    error_code: null,
    error_message: null,
  };
}

function snapshots(ctx: Ctx): Table<SnapshotRecord> {
  return loadTable<SnapshotRecord>(ctx.sheets, 'Snapshots');
}

export const publishActions = {
  'publish.acquire': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = obj(payload);
      const type = p.type === 'rollback' ? 'rollback' : p.type === 'publish' ? 'publish' : null;
      if (!type) throw new ZidError('BAD_REQUEST', 'type harus "publish" atau "rollback".');
      const key = typeof p.idempotency_key === 'string' ? p.idempotency_key.trim() : '';
      if (key.length < 8 || key.length > 100) throw new ZidError('BAD_REQUEST', 'idempotency_key tidak valid.');
      const table = jobs(ctx);
      const same = table.entries.find((e) => e.record.idempotency_key === key);
      if (same) return { job: same.record, coalesced: false, existing: true };
      const active = table.entries.find((e) => isActive(e.record));
      if (active) {
        if (type === 'rollback') {
          throw new ZidError('PUBLISH_IN_PROGRESS', 'Masih ada job publikasi yang berjalan.', {
            job_id: active.record.id,
          });
        }
        if (!active.record.rerun_requested) {
          const next = { ...active.record, rerun_requested: true, updated_at: ctx.nowIso };
          writeEntry(ctx.sheets, table, active, next);
          audit(ctx, 'publish.coalesce', 'publish', next.id);
          return { job: next, coalesced: true, existing: false };
        }
        return { job: active.record, coalesced: true, existing: false };
      }
      let target: number | null = null;
      if (type === 'rollback') {
        target = typeof p.target_version === 'number' ? p.target_version : Number.NaN;
        const snap = snapshots(ctx).entries.find((e) => e.record.version === target)?.record;
        if (!snap || !['live', 'superseded'].includes(snap.status)) {
          throw new ZidError('VALIDATION_ERROR', 'Versi target rollback tidak tersedia.');
        }
      }
      const job = newJob(ctx, type, key, target);
      appendRecord(ctx.sheets, table, job);
      audit(ctx, `publish.${type}`, 'publish', job.id, 'ok', target ? `target v${target}` : '');
      return { job, coalesced: false, existing: false };
    },
  },

  'publish.getJob': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      return findJob(jobs(ctx), obj(payload).id).record;
    },
  },

  'publish.listJobs': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      const limit = Math.min(Math.max(Number(obj(payload ?? {}).limit ?? 20) || 20, 1), LIMITS.LIST_MAX);
      const all = jobs(ctx).entries.map((e) => e.record);
      return {
        items: all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit),
        active: all.find(isActive) ?? null,
      };
    },
  },

  'publish.claimStep': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = obj(payload);
      const table = jobs(ctx);
      const entry = findJob(table, p.id);
      const job = entry.record;
      const leaseMs = Math.min(Math.max(Number(p.lease_ms) || 60_000, 5_000), 290_000);
      const now = ctx.runtime.now();
      if (job.state !== p.state || !isActive(job)) return { claimed: false, job };
      if (job.step_lease_until && Date.parse(job.step_lease_until) > now) return { claimed: false, job };
      const next: PublishJob = {
        ...job,
        step_lease_until: iso(now + leaseMs),
        step_attempts: job.step_attempts + 1,
        lease_expires_at: iso(now + JOB_LEASE_MS),
        updated_at: ctx.nowIso,
      };
      writeEntry(ctx.sheets, table, entry, next);
      return { claimed: true, job: next };
    },
  },

  'publish.updateJob': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = obj(payload);
      const table = jobs(ctx);
      const entry = findJob(table, p.id);
      const job = entry.record;
      const from = p.from_state as PublishJobState;
      const to = p.to_state as PublishJobState;
      if (job.state !== from) return { updated: false, job, followUp: null };
      if (from !== to && !NEXT[from]?.includes(to)) {
        throw new ZidError('INVALID_TRANSITION', `Transisi job ${from} → ${to} tidak diizinkan.`);
      }
      const fields = (p.fields ?? {}) as Record<string, unknown>;
      const next: PublishJob = { ...job, updated_at: ctx.nowIso, step_lease_until: null };
      for (const key of UPDATABLE_FIELDS) {
        if (!(key in fields)) continue;
        const value = fields[key];
        if (key === 'snapshot_version') next.snapshot_version = typeof value === 'number' ? value : null;
        else if (key === 'error_message')
          next.error_message = value == null ? null : String(value).slice(0, LIMITS.JOB_ERROR);
        else if (key === 'deploy_detail') next.deploy_detail = String(value ?? '').slice(0, 200);
        else (next as unknown as Record<string, unknown>)[key] = value == null ? null : String(value);
      }
      if (from !== to) {
        next.state = to;
        next.state_entered_at = ctx.nowIso;
        next.step_attempts = 0;
        next.lease_expires_at = iso(ctx.runtime.now() + JOB_LEASE_MS);
        if (TERMINAL.includes(to)) next.finished_at = ctx.nowIso;
      }
      writeEntry(ctx.sheets, table, entry, next);
      let followUp: PublishJob | null = null;
      if (from !== to) {
        audit(
          ctx,
          'publish.transition',
          'publish',
          job.id,
          to === 'failed' ? (next.error_code ?? 'failed') : 'ok',
          `${from}→${to}`,
        );
        if (to === 'live' && job.rerun_requested) {
          followUp = newJob(ctx, 'publish', `${job.id}:rerun`, null);
          appendRecord(ctx.sheets, table, followUp);
          audit(ctx, 'publish.rerun', 'publish', followUp.id, 'ok', `after ${job.id}`);
        }
      }
      return { updated: true, job: next, followUp };
    },
  },

  'publish.readPublished': {
    lock: false,
    run(ctx: Ctx) {
      const { posts, pages } = publishedContent(ctx);
      return {
        posts,
        pages,
        categories: listTaxa(ctx, 'category'),
        tags: listTaxa(ctx, 'tag'),
        media: activeMedia(ctx),
        settings: readSettings(ctx),
      };
    },
  },
};

const SNAPSHOT_STATUSES: SnapshotStatus[] = ['committed', 'live', 'failed', 'superseded'];

export const snapshotActions = {
  'snapshots.record': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = obj(payload);
      const version = p.version;
      if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
        throw new ZidError('BAD_REQUEST', 'Versi snapshot tidak valid.');
      }
      const table = snapshots(ctx);
      const existing = table.entries.find((e) => e.record.version === version);
      if (existing) {
        if (existing.record.source_job_id === p.source_job_id) return existing.record;
        throw new ZidError('VERSION_CONFLICT', `Snapshot v${version} sudah ada.`, {
          current_version: Math.max(...table.entries.map((e) => e.record.version)),
        });
      }
      const record: SnapshotRecord = {
        version,
        checksum: String(p.checksum ?? ''),
        git_commit_sha: String(p.git_commit_sha ?? ''),
        item_count: Number(p.item_count ?? 0),
        media_count: Number(p.media_count ?? 0),
        status: 'committed',
        source_job_id: String(p.source_job_id ?? ''),
        based_on_version: typeof p.based_on_version === 'number' ? p.based_on_version : null,
        created_at: ctx.nowIso,
        created_by: ctx.actor,
      };
      appendRecord(ctx.sheets, table, record);
      audit(ctx, 'snapshots.record', 'publish', String(version), 'ok', record.git_commit_sha.slice(0, 12));
      return record;
    },
  },

  'snapshots.list': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      const limit = Math.min(Math.max(Number(obj(payload ?? {}).limit ?? 20) || 20, 1), LIMITS.LIST_MAX);
      const all = snapshots(ctx)
        .entries.map((e) => e.record)
        .sort((a, b) => b.version - a.version);
      return {
        items: all.slice(0, limit),
        live: all.find((s) => s.status === 'live') ?? null,
        latestVersion: all[0]?.version ?? 0,
      };
    },
  },

  'snapshots.get': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      const version = obj(payload).version;
      const record = snapshots(ctx).entries.find((e) => e.record.version === version)?.record;
      if (!record) throw new ZidError('NOT_FOUND', 'Snapshot tidak ditemukan.');
      return record;
    },
  },

  'snapshots.setStatus': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = obj(payload);
      const status = p.status as SnapshotStatus;
      if (!SNAPSHOT_STATUSES.includes(status)) throw new ZidError('BAD_REQUEST', 'Status snapshot tidak valid.');
      const table = snapshots(ctx);
      const entry = table.entries.find((e) => e.record.version === p.version);
      if (!entry) throw new ZidError('NOT_FOUND', 'Snapshot tidak ditemukan.');
      if (status === 'live') {
        for (const other of table.entries) {
          if (other !== entry && other.record.status === 'live') {
            writeEntry(ctx.sheets, table, other, { ...other.record, status: 'superseded' });
          }
        }
      }
      const next = { ...entry.record, status };
      writeEntry(ctx.sheets, table, entry, next);
      audit(ctx, 'snapshots.setStatus', 'publish', String(next.version), 'ok', status);
      return next;
    },
  },
};

import {
  type ContentStatus,
  computeLiveState,
  type PublishJob,
  type Snapshot,
  type SnapshotRecord,
} from '@zidcms/core';
import { cache } from 'react';
import { requireAdminPage } from './auth';
import { gas } from './gas-client';
import { log } from './log';
import { snapshotStore } from './publish';

export interface BriefItem {
  id: string;
  status: ContentStatus;
  updated_at: string;
  deleted_at: string | null;
}

export interface StatusCounts {
  all: number;
  draft: number;
  published: number;
  archived: number;
  trash: number;
}

export interface Summary {
  environment: string;
  posts: { counts: StatusCounts; items: BriefItem[]; invalid: number };
  pages: { counts: StatusCounts; items: BriefItem[]; invalid: number };
  mediaCount: number;
  activeJob: PublishJob | null;
  lastJob: PublishJob | null;
  live: SnapshotRecord | null;
  latestVersion: number;
  settingsUpdatedAt: string | null;
  taxonomyUpdatedAt: string | null;
  invalidRowCount: number;
}

export interface PlainLiveIndex {
  version: number;
  isRollback: boolean;
  items: Record<string, string>;
}

export const getAdmin = cache(requireAdminPage);

export const getSummary = cache(async (): Promise<Summary> => {
  const admin = await getAdmin();
  return gas<Summary>('system.summary', {}, { actor: admin.email });
});

const snapshotCache = new Map<string, Snapshot>();

export async function readLiveSnapshot(live: SnapshotRecord | null): Promise<Snapshot | null> {
  if (!live?.git_commit_sha) return null;
  const hit = snapshotCache.get(live.git_commit_sha);
  if (hit) return hit;
  try {
    const snapshot = await snapshotStore().readSnapshot(live.git_commit_sha);
    snapshotCache.set(live.git_commit_sha, snapshot);
    return snapshot;
  } catch (err) {
    log('warn', 'live_snapshot_unavailable', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export const getLiveSnapshot = cache(async (): Promise<Snapshot | null> => readLiveSnapshot((await getSummary()).live));

export function plainLiveIndex(snapshot: Snapshot | null): PlainLiveIndex | null {
  if (!snapshot) return null;
  const items: Record<string, string> = {};
  for (const p of [...snapshot.posts, ...snapshot.pages]) items[p.id] = p.updatedAt;
  return { version: snapshot.version, isRollback: snapshot.basedOnVersion !== null, items };
}

export async function getLiveIndex(): Promise<PlainLiveIndex | null> {
  return plainLiveIndex(await getLiveSnapshot());
}

export function toLiveIndex(plain: PlainLiveIndex | null) {
  return plain ? { ...plain, items: new Map(Object.entries(plain.items)) } : null;
}

export async function hasPendingChanges(): Promise<boolean> {
  const summary = await getSummary();
  const index = toLiveIndex(await getLiveIndex());
  const liveAt = summary.live?.created_at ?? '';
  const items = [...summary.posts.items, ...summary.pages.items];
  if (
    items.some((i) =>
      ['pending_publish', 'live_pending_update', 'removal_pending'].includes(computeLiveState(i, index)),
    )
  ) {
    return true;
  }
  if (!summary.live) return items.some((i) => i.status === 'published' && !i.deleted_at);
  return Boolean(
    (summary.settingsUpdatedAt && summary.settingsUpdatedAt > liveAt) ||
      (summary.taxonomyUpdatedAt && summary.taxonomyUpdatedAt > liveAt),
  );
}

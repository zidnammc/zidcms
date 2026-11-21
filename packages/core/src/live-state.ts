import type { ContentStatus } from './schema/types';
import type { Snapshot } from './snapshot';

export type LiveState =
  | 'live'
  | 'live_pending_update'
  | 'pending_publish'
  | 'not_live'
  | 'removal_pending'
  | 'rollback_mismatch';

export interface LiveIndex {
  version: number;
  isRollback: boolean;
  items: Map<string, string>;
}

export function liveIndexOf(snapshot: Snapshot | null): LiveIndex | null {
  if (!snapshot) return null;
  const items = new Map<string, string>();
  for (const p of snapshot.posts) items.set(p.id, p.updatedAt);
  for (const p of snapshot.pages) items.set(p.id, p.updatedAt);
  return { version: snapshot.version, isRollback: snapshot.basedOnVersion !== null, items };
}

export function computeLiveState(
  item: { id: string; status: ContentStatus; updated_at: string; deleted_at: string | null },
  index: LiveIndex | null,
): LiveState {
  const liveUpdatedAt = index?.items.get(item.id);
  const mismatch = index?.isRollback ?? false;
  const wantsLive = item.deleted_at === null && item.status === 'published';
  if (!wantsLive) {
    if (liveUpdatedAt === undefined) return 'not_live';
    return mismatch ? 'rollback_mismatch' : 'removal_pending';
  }
  if (liveUpdatedAt === undefined) return mismatch ? 'rollback_mismatch' : 'pending_publish';
  if (item.updated_at > liveUpdatedAt) return mismatch ? 'rollback_mismatch' : 'live_pending_update';
  return 'live';
}

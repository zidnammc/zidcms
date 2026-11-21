import type { ContentStatus } from './schema/types';

export type TransitionPlan = { ok: true; startsPublish: boolean; setPublishedAt: boolean } | { ok: false };

const TABLE: Record<ContentStatus, Partial<Record<ContentStatus, boolean>>> = {
  draft: { published: true, archived: false },
  published: { published: true, draft: true, archived: true },
  archived: { draft: false },
};

export function planTransition(from: ContentStatus, to: ContentStatus): TransitionPlan {
  const startsPublish = TABLE[from][to];
  if (startsPublish === undefined) return { ok: false };
  return { ok: true, startsPublish, setPublishedAt: to === 'published' };
}

export function deleteStartsPublish(status: ContentStatus): boolean {
  return status === 'published';
}

export const CONTENT_STATUSES: readonly ContentStatus[] = ['draft', 'published', 'archived'];

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === 'string' && (CONTENT_STATUSES as readonly string[]).includes(value);
}

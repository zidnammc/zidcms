import type { Snapshot, VersionFile } from '@zidcms/core';

export interface MediaFile {
  sha256: string;
  path: string;
  loadBase64: () => Promise<string>;
}

export interface CommitInput {
  jobId: string;
  message: string;
  snapshot: Snapshot;
  versionFile: VersionFile;
  media: MediaFile[];
  reuseMediaFromSha?: string;
}

export type DeployState = 'pending' | 'building' | 'success' | 'failure';

export interface SnapshotStore {
  readonly kind: 'github' | 'local';
  commit(input: CommitInput): Promise<string>;
  findCommitForJob(jobId: string): Promise<string | null>;
  readSnapshot(sha: string): Promise<Snapshot>;
  deployStatus(sha: string): Promise<{ state: DeployState; detail: string }>;
}

export function jobMarker(jobId: string): string {
  return `(job ${jobId})`;
}

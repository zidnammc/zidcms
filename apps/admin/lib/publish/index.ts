import { resolve } from 'node:path';
import type { RpcAction, VersionFile } from '@zidcms/core';
import { env } from '../env';
import { gas } from '../gas-client';
import { GitHubStore } from './github';
import { LocalStore } from './local';
import type { OrchestratorDeps } from './orchestrator';
import type { SnapshotStore } from './store';

let cachedStore: SnapshotStore | null = null;

export function snapshotStore(): SnapshotStore {
  if (cachedStore) return cachedStore;
  cachedStore =
    env.publishTarget() === 'local'
      ? new LocalStore(process.env.LOCAL_REPO_ROOT ?? resolve(process.cwd(), '../..'))
      : new GitHubStore({
          token: env.githubToken(),
          repo: env.githubRepo(),
          branch: env.githubBranch(),
          contentRoot: env.contentRoot(),
          statusContext: env.vercelStatusContext(),
        });
  return cachedStore;
}

export async function fetchLiveVersion(): Promise<VersionFile | null> {
  const res = await fetch(`${env.publicSiteUrl()}/zidcms-version.json?ts=${Date.now()}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as VersionFile;
}

export function orchestratorDeps(actor: string, requestId: string): OrchestratorDeps {
  return {
    call: <T>(action: RpcAction, payload: unknown) => gas<T>(action, payload, { actor, requestId }),
    store: snapshotStore(),
    fetchVersion: fetchLiveVersion,
    now: () => Date.now(),
    siteUrl: env.publicSiteUrl(),
  };
}

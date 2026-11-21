import { type Snapshot, ZidError } from '@zidcms/core';
import { type CommitInput, type DeployState, jobMarker, type SnapshotStore } from './store';

export interface GitHubConfig {
  token: string;
  repo: string;
  branch: string;
  contentRoot: string;
  statusContext: string;
  fetch?: typeof fetch;
}

interface TreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha?: string | null;
  content?: string;
}

export class GitHubStore implements SnapshotStore {
  readonly kind = 'github' as const;
  private readonly api: string;

  constructor(private readonly config: GitHubConfig) {
    this.api = `https://api.github.com/repos/${config.repo}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    accept = 'application/vnd.github+json',
  ): Promise<T> {
    const res = await (this.config.fetch ?? fetch)(`${this.api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.config.token}`,
        accept,
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new ZidError(
        res.status === 404 ? 'NOT_FOUND' : 'GITHUB_ERROR',
        `GitHub API ${method} ${path.split('?')[0]} → ${res.status}`,
        {
          status: res.status,
        },
      );
    }
    if (accept.includes('raw')) return (await res.text()) as T;
    return (await res.json()) as T;
  }

  private paths() {
    const root = this.config.contentRoot;
    return {
      snapshot: `${root}/content/snapshot.json`,
      version: `${root}/public/zidcms-version.json`,
      mediaDir: `${root}/public/media/`,
    };
  }

  private async mediaTree(commitSha: string): Promise<Map<string, string>> {
    const commit = await this.request<{ tree: { sha: string } }>('GET', `/git/commits/${commitSha}`);
    const tree = await this.request<{ tree: { path: string; sha: string; type: string }[]; truncated: boolean }>(
      'GET',
      `/git/trees/${commit.tree.sha}?recursive=1`,
    );
    if (tree.truncated) throw new ZidError('GITHUB_ERROR', 'Tree repositori terlalu besar untuk dibaca sekaligus.');
    const { mediaDir } = this.paths();
    return new Map(
      tree.tree.filter((e) => e.type === 'blob' && e.path.startsWith(mediaDir)).map((e) => [e.path, e.sha]),
    );
  }

  async commit(input: CommitInput): Promise<string> {
    const { snapshot, version, mediaDir } = this.paths();
    const reuse = input.reuseMediaFromSha ? await this.mediaTree(input.reuseMediaFromSha) : new Map<string, string>();
    const uploaded = new Map<string, string>();
    for (let attempt = 1; ; attempt++) {
      const ref = await this.request<{ object: { sha: string } }>('GET', `/git/ref/heads/${this.config.branch}`);
      const base = ref.object.sha;
      const baseCommit = await this.request<{ tree: { sha: string } }>('GET', `/git/commits/${base}`);
      const existing = await this.mediaTree(base);
      const wanted = new Set(input.media.map((m) => `${mediaDir}${m.path.replace(/^\/media\//, '')}`));
      const entries: TreeEntry[] = [
        { path: snapshot, mode: '100644', type: 'blob', content: `${JSON.stringify(input.snapshot, null, 2)}\n` },
        { path: version, mode: '100644', type: 'blob', content: `${JSON.stringify(input.versionFile)}\n` },
      ];
      for (const media of input.media) {
        const path = `${mediaDir}${media.path.replace(/^\/media\//, '')}`;
        if (existing.has(path)) continue;
        let sha = reuse.get(path) ?? uploaded.get(path);
        if (!sha) {
          const blob = await this.request<{ sha: string }>('POST', '/git/blobs', {
            content: await media.loadBase64(),
            encoding: 'base64',
          });
          sha = blob.sha;
          uploaded.set(path, sha);
        }
        entries.push({ path, mode: '100644', type: 'blob', sha });
      }
      for (const path of existing.keys()) {
        if (!wanted.has(path) && !path.endsWith('/.gitkeep'))
          entries.push({ path, mode: '100644', type: 'blob', sha: null });
      }
      const tree = await this.request<{ sha: string }>('POST', '/git/trees', {
        base_tree: baseCommit.tree.sha,
        tree: entries,
      });
      const commit = await this.request<{ sha: string }>('POST', '/git/commits', {
        message: input.message,
        tree: tree.sha,
        parents: [base],
      });
      try {
        await this.request('PATCH', `/git/refs/heads/${this.config.branch}`, { sha: commit.sha, force: false });
        return commit.sha;
      } catch (err) {
        const status = (err as ZidError).details?.status;
        if (status !== 422 || attempt >= 3) throw err;
      }
    }
  }

  async findCommitForJob(jobId: string): Promise<string | null> {
    const commits = await this.request<{ sha: string; commit: { message: string } }[]>(
      'GET',
      `/commits?sha=${encodeURIComponent(this.config.branch)}&per_page=20`,
    );
    return commits.find((c) => c.commit.message.includes(jobMarker(jobId)))?.sha ?? null;
  }

  async readSnapshot(sha: string): Promise<Snapshot> {
    const raw = await this.request<string>(
      'GET',
      `/contents/${this.paths().snapshot}?ref=${sha}`,
      undefined,
      'application/vnd.github.raw+json',
    );
    return JSON.parse(raw) as Snapshot;
  }

  async deployStatus(sha: string): Promise<{ state: DeployState; detail: string }> {
    const combined = await this.request<{ statuses: { context: string; state: string; description: string | null }[] }>(
      'GET',
      `/commits/${sha}/status`,
    );
    const needle = this.config.statusContext.toLowerCase();
    const status = combined.statuses.find((s) => s.context.toLowerCase().includes(needle));
    if (!status) return { state: 'pending', detail: 'Menunggu Vercel memulai build' };
    const detail = (status.description ?? status.context).slice(0, 200);
    if (status.state === 'success') return { state: 'success', detail };
    if (status.state === 'failure' || status.state === 'error') return { state: 'failure', detail };
    return { state: 'building', detail };
  }
}

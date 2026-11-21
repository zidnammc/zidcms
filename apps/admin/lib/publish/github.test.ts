import { describe, expect, it } from 'vitest';
import { GitHubStore } from './github';

type Handler = (method: string, path: string, body: unknown) => { status: number; body: unknown };

function store(handler: Handler, statusContext = 'zidcms-web') {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.github.com/repos/o/r', '');
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: String(init.method), path, body });
    const res = handler(String(init.method), path, body);
    const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    return new Response(text, { status: res.status });
  }) as typeof fetch;
  return {
    calls,
    store: new GitHubStore({
      token: 't',
      repo: 'o/r',
      branch: 'main',
      contentRoot: 'apps/web/content/dev',
      statusContext,
      fetch: fakeFetch,
    }),
  };
}

describe('GitHubStore per-environment content layout', () => {
  it('commits snapshot, version file and media under the environment content root', async () => {
    const { store: s, calls } = store((method, path) => {
      if (path === '/git/ref/heads/main') return { status: 200, body: { object: { sha: 'base' } } };
      if (path === '/git/commits/base') return { status: 200, body: { tree: { sha: 'tree0' } } };
      if (path.startsWith('/git/trees/tree0')) return { status: 200, body: { tree: [], truncated: false } };
      if (path === '/git/blobs') return { status: 201, body: { sha: 'blob1' } };
      if (path === '/git/trees' && method === 'POST') return { status: 201, body: { sha: 'tree1' } };
      if (path === '/git/commits' && method === 'POST') return { status: 201, body: { sha: 'c1' } };
      if (path === '/git/refs/heads/main') return { status: 200, body: {} };
      return { status: 404, body: {} };
    });
    const sha = await s.commit({
      jobId: 'j',
      message: 'content: publish v1 (job j)',
      snapshot: { version: 1 } as never,
      versionFile: { version: 1, checksum: 'sha256:x', generatedAt: 'now' },
      media: [{ sha256: 'ab', path: '/media/ab.png', loadBase64: async () => 'AA==' }],
    });
    expect(sha).toBe('c1');
    const tree = calls.find((c) => c.path === '/git/trees' && c.method === 'POST')?.body as {
      tree: { path: string }[];
    };
    expect(tree.tree.map((e) => e.path)).toEqual([
      'apps/web/content/dev/snapshot.json',
      'apps/web/content/dev/zidcms-version.json',
      'apps/web/content/dev/media/ab.png',
    ]);
  });

  it('reads snapshots of commits made before the layout change', async () => {
    const { store: s, calls } = store((_m, path) => {
      if (path.startsWith('/contents/apps/web/content/dev/snapshot.json')) return { status: 404, body: {} };
      if (path.startsWith('/contents/apps/web/content/snapshot.json')) return { status: 200, body: '{"version":3}' };
      return { status: 404, body: {} };
    });
    expect(await s.readSnapshot('old')).toEqual({ version: 3 });
    expect(calls.map((c) => c.path)).toEqual([
      '/contents/apps/web/content/dev/snapshot.json?ref=old',
      '/contents/apps/web/content/snapshot.json?ref=old',
    ]);
  });

  it('matches the Vercel status of exactly this project', async () => {
    const statuses = [
      { context: 'Vercel – zidcms-prod-web', state: 'failure', description: 'prod' },
      { context: 'Vercel – zidcms-web-preview', state: 'failure', description: 'other' },
      { context: 'Vercel – zidcms-web', state: 'success', description: 'dev ok' },
    ];
    const { store: s } = store(() => ({ status: 200, body: { statuses } }));
    expect(await s.deployStatus('c1')).toEqual({ state: 'success', detail: 'dev ok' });
  });
});

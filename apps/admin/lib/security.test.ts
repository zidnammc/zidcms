import { randomUUID } from 'node:crypto';
import { handleRpc } from '@zidcms/apps-script/src/dispatcher';
import { emptyState, memoryDeps } from '@zidcms/apps-script/src/memory';
import { ZidError } from '@zidcms/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowSignIn } from './auth-policy';
import { gas } from './gas-client';
import { redact } from './log';

vi.mock('@/lib/auth', () => ({
  requireAdmin: async () => {
    throw new ZidError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
  },
  handlers: { GET: async () => new Response(null), POST: async () => new Response(null) },
}));

const ADMIN_URL = 'https://admin.example.com';

beforeEach(() => {
  vi.stubEnv('ADMIN_URL', ADMIN_URL);
  vi.stubEnv('ADMIN_EMAILS', 'Admin@Example.com, second@example.com');
});
afterEach(() => vi.unstubAllEnvs());

describe('TC-AUTH-02 sign-in policy', () => {
  it('allows only verified, allowlisted Google accounts', () => {
    expect(allowSignIn({ provider: 'google', email: 'admin@example.com', emailVerified: true })).toBe(true);
    expect(allowSignIn({ provider: 'google', email: 'ADMIN@example.com', emailVerified: true })).toBe(true);
    expect(allowSignIn({ provider: 'google', email: 'admin@example.com', emailVerified: false })).toBe(false);
    expect(allowSignIn({ provider: 'google', email: 'intruder@example.com', emailVerified: true })).toBe(false);
    expect(allowSignIn({ provider: 'github', email: 'admin@example.com', emailVerified: true })).toBe(false);
  });

  it('dev login is disabled outside `next dev` with ZIDCMS_DEV_LOGIN=true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZIDCMS_DEV_LOGIN', 'true');
    expect(allowSignIn({ provider: 'dev-login', email: 'admin@example.com' })).toBe(false);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL', '1');
    expect(allowSignIn({ provider: 'dev-login', email: 'admin@example.com' })).toBe(false);
  });
});

const routes = import.meta.glob<Record<string, unknown>>('../app/api/**/route.ts', { eager: true });
const METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const;
const params = Promise.resolve({ id: randomUUID(), jobId: randomUUID(), kind: 'posts' });

const handlers = Object.entries(routes)
  .filter(([file]) => !file.includes('[...nextauth]'))
  .flatMap(([file, mod]) =>
    METHODS.filter((m) => typeof mod[m] === 'function').map((m) => ({
      name: `${m} ${file.replace('../app', '').replace('/route.ts', '')}`,
      method: m,
      fn: mod[m] as (req: Request, ctx: { params: Promise<unknown> }) => Promise<Response>,
    })),
  );

describe('TC-AUTH-03 every API route requires an admin session', () => {
  it('discovers the route matrix', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(25);
  });

  it.each(handlers)('$name → 401 without session', async ({ method, fn }) => {
    const res = await fn(
      new Request(`${ADMIN_URL}/api/x`, {
        method,
        headers: { origin: ADMIN_URL, 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : '{}',
      }),
      { params },
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(JSON.stringify(body)).not.toMatch(/at \w+ \(|\.ts:\d+/);
  });
});

describe('TC-AUTH-05 mutations with a foreign or missing Origin → 403', () => {
  const mutations = handlers.filter((h) => h.method !== 'GET');
  it.each(mutations)('$name', async ({ method, fn }) => {
    for (const headers of [{ origin: 'https://evil.example' }, {}] as Record<string, string>[]) {
      const res = await fn(new Request(`${ADMIN_URL}/api/x`, { method, headers, body: '{}' }), { params });
      expect(res.status).toBe(403);
    }
  });
});

describe('gas-client', () => {
  const secret = 'client-test-secret-0123456789abcdefghij';
  const deps = memoryDeps(emptyState({ HMAC_SECRET: secret, ENVIRONMENT: 'dev' }));

  const emulator = (async (_url: string, init: RequestInit) =>
    new Response(JSON.stringify(handleRpc(String(init.body), deps)), {
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  it('signs requests that the GAS dispatcher accepts', async () => {
    await gas('system.setup', {}, { actor: 'admin@example.com' }, { url: 'x', secret, fetch: emulator });
    const health = await gas<{ environment: string }>(
      'system.health',
      {},
      { actor: 'admin@example.com' },
      { url: 'x', secret, fetch: emulator },
    );
    expect(health.environment).toBe('dev');
  });

  it('maps GAS errors and rejects with the wrong secret', async () => {
    await expect(
      gas(
        'system.health',
        {},
        { actor: 'admin@example.com' },
        { url: 'x', secret: `${secret}-wrong`, fetch: emulator },
      ),
    ).rejects.toMatchObject({ code: 'SIGNATURE_INVALID' });
  });

  it('treats HTML error pages as retryable UPSTREAM_ERROR and retries reads only', async () => {
    let calls = 0;
    const html = (async () => {
      calls += 1;
      return new Response('<html>Google error</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }) as unknown as typeof fetch;
    await expect(
      gas('posts.list', {}, { actor: 'a@example.com' }, { url: 'x', secret, fetch: html }),
    ).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
    expect(calls).toBe(3);
    calls = 0;
    await expect(
      gas('posts.create', {}, { actor: 'a@example.com' }, { url: 'x', secret, fetch: html }),
    ).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
    expect(calls).toBe(1);
  });
});

describe('log redaction', () => {
  it('redacts secret-like keys and email local parts', () => {
    const out = JSON.stringify(
      redact({ token: 'abc', nested: { GAS_HMAC_SECRET: 'x' }, actor: 'owner.real@gmail.com' }),
    );
    expect(out).not.toContain('abc');
    expect(out).not.toContain('owner.real@');
    expect(out).toContain('o***@gmail.com');
  });
});

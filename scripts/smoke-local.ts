const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:3000';
const WEB = process.env.PUBLIC_SITE_URL ?? 'http://localhost:3001';
const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@example.com';

const jar = new Map<string, string>();

function storeCookies(res: Response) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const idx = pair!.indexOf('=');
    jar.set(pair!.slice(0, idx), pair!.slice(idx + 1));
  }
}

const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function http(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(`${ADMIN}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      cookie: cookieHeader(),
      origin: ADMIN,
      ...(body && !(body instanceof URLSearchParams) ? { 'content-type': 'application/json' } : {}),
      ...extra,
    },
    body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
  });
  storeCookies(res);
  return res;
}

async function json<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await http(method, path, body);
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data as T;
}

async function login() {
  const csrf = await json<{ csrfToken: string }>('GET', '/api/auth/csrf');
  const res = await http(
    'POST',
    '/api/auth/callback/dev-login',
    new URLSearchParams({ csrfToken: csrf.csrfToken, email: EMAIL, callbackUrl: `${ADMIN}/` }),
    { 'content-type': 'application/x-www-form-urlencoded' },
  );
  if (![...jar.keys()].some((k) => k.includes('session-token'))) throw new Error(`login failed (${res.status})`);
}

async function publishAndWait(jobId: string) {
  const started = Date.now();
  for (;;) {
    const { job, followUp } = await json('GET', `/api/publish/${jobId}`);
    if (job.state === 'live' || job.state === 'failed') {
      console.log(`  job ${job.id.slice(0, 8)} → ${job.state} v${job.snapshot_version} in ${Date.now() - started} ms`);
      if (job.state === 'failed') throw new Error(`${job.error_code}: ${job.error_message}`);
      return { job, followUp };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function liveVersion() {
  return (await fetch(`${WEB}/zidcms-version.json?ts=${Date.now()}`, { cache: 'no-store' })).json();
}

async function main() {
  console.log('1. unauthenticated API → 401');
  const anon = await fetch(`${ADMIN}/api/posts`);
  console.log(`  GET /api/posts → ${anon.status}`);
  if (anon.status !== 401) throw new Error('expected 401');
  const foreign = await fetch(`${ADMIN}/api/posts`, {
    method: 'POST',
    headers: { origin: 'https://evil.example' },
    body: '{}',
  });
  console.log(`  POST /api/posts (foreign Origin) → ${foreign.status}`);
  if (foreign.status !== 403) throw new Error('expected 403');

  console.log('2. dev login');
  await login();

  console.log('3. create draft');
  const title = `Smoke ${new Date().toISOString()}`;
  const post = await json('POST', '/api/posts', { title, content_markdown: '# Halo\n\nIsi **pertama**.' });
  console.log(`  ${post.id} slug=${post.slug} v${post.version}`);

  console.log('4. publish');
  const pub = await json('POST', `/api/posts/${post.id}/status`, { expected_version: post.version, to: 'published' });
  const { job } = await publishAndWait(pub.publishJob.id);
  const v1 = await liveVersion();
  console.log(`  zidcms-version.json: ${JSON.stringify(v1)}`);
  if (v1.version !== job.snapshot_version) throw new Error('version mismatch');
  const html = await (await fetch(`${WEB}/blog/${post.slug}/`)).text();
  console.log(`  /blog/${post.slug}/ contains title: ${html.includes(title)}`);

  console.log('5. stale version → VERSION_CONFLICT');
  const conflict = await http('PATCH', `/api/posts/${post.id}`, { expected_version: 1, patch: { title: 'x' } });
  console.log(`  → ${conflict.status} ${(await conflict.json()).error.code}`);

  console.log('6. update (republish)');
  const upd = await json('PATCH', `/api/posts/${post.id}`, {
    expected_version: pub.item.version,
    patch: { content_markdown: '# Halo\n\nIsi **kedua**.' },
  });
  const second = await publishAndWait(upd.publishJob.id);

  console.log('7. no-op publish');
  const noop = await json('POST', '/api/publish', { idempotency_key: crypto.randomUUID() });
  const noopResult = await publishAndWait(noop.job.id);
  console.log(`  no-op detail: ${noopResult.job.deploy_detail}`);

  console.log(`8. rollback to v${job.snapshot_version}`);
  const rb = await json('POST', '/api/publish/rollback', {
    target_version: job.snapshot_version,
    idempotency_key: crypto.randomUUID(),
  });
  const rolled = await publishAndWait(rb.job.id);
  const v3 = await liveVersion();
  console.log(`  live: v${v3.version} (checksum equals v${job.snapshot_version}: ${v3.checksum === v1.checksum})`);
  if (rolled.job.snapshot_version <= second.job.snapshot_version) throw new Error('rollback must create a new version');

  console.log('9. admin screens render');
  for (const path of [
    '/',
    '/posts',
    '/posts?status=trash',
    '/posts/new',
    `/posts/${post.id}`,
    '/pages',
    '/pages/new',
    '/taxonomy',
    '/media',
    '/publish',
    '/settings',
    `/preview/posts/${post.id}`,
  ]) {
    const res = await http('GET', path);
    const body = await res.text();
    const ok = res.status === 200 && !body.includes('Application error');
    console.log(`  ${ok ? 'ok ' : 'ERR'} ${res.status} ${path}`);
    if (!ok) throw new Error(`screen ${path} failed`);
  }

  console.log('SMOKE OK');
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err.message);
  process.exit(1);
});

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Snapshot } from '../packages/core/src/index';

const root = resolve(import.meta.dirname, '..');
const envFile = resolve(root, process.env.ZIDCMS_ENV_FILE ?? '.local/secrets/dev.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const ADMIN = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
const WEB = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
const ENV = (process.env.ZIDCMS_ENV ?? 'dev').toLowerCase() === 'prod' ? 'prod' : 'dev';
const BRANCH = process.env.GITHUB_BRANCH ?? (ENV === 'prod' ? 'release' : 'main');
if (!ADMIN.startsWith('https://') || !WEB.startsWith('https://')) {
  console.error('ADMIN_URL and PUBLIC_SITE_URL (https) are required (ZIDCMS_ENV_FILE).');
  process.exit(1);
}

let failed = 0;
const check = (id: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`);
  if (!ok) failed += 1;
};

function routes(): { method: string; path: string }[] {
  const base = resolve(root, 'apps/admin/app/api');
  const out: { method: string; path: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === 'route.ts') {
        const path = `/api/${relative(base, dir).replace(/\\/g, '/')}`;
        if (path.startsWith('/api/auth')) continue;
        const source = readFileSync(full, 'utf8');
        for (const m of source.matchAll(/export const (GET|POST|PATCH|PUT|DELETE)\b/g)) {
          out.push({ method: m[1] as string, path: path.replace(/\[[^\]]+\]/g, randomUUID()) });
        }
      }
    }
  };
  walk(base);
  return out;
}

async function adminChecks() {
  const matrix = routes();
  const bad: string[] = [];
  for (const r of matrix) {
    const res = await fetch(`${ADMIN}${r.path}`, {
      method: r.method,
      headers: { origin: ADMIN, 'content-type': 'application/json' },
      body: r.method === 'GET' ? undefined : '{}',
      redirect: 'manual',
    });
    const text = await res.text();
    if (res.status !== 401 || /at \w+ \(|\.ts:\d+/.test(text))
      bad.push(`${r.method} ${r.path.replace(/[0-9a-f-]{36}/g, ':id')} → ${res.status}`);
  }
  check(
    'TC-AUTH-03',
    bad.length === 0,
    `${matrix.length} deployed routes without session → 401, no stack traces ${bad.join('; ')}`,
  );
  const foreign = await fetch(`${ADMIN}/api/posts`, {
    method: 'POST',
    headers: { origin: 'https://evil.example' },
    body: '{}',
  });
  check('TC-AUTH-05', foreign.status === 403, `POST /api/posts with foreign Origin → ${foreign.status}`);
  const login = await fetch(`${ADMIN}/login`);
  const h = login.headers;
  check(
    'TC-SEC-02 (admin)',
    login.status === 200 &&
      (h.get('x-frame-options') ?? '').toUpperCase() === 'DENY' &&
      (h.get('x-robots-tag') ?? '').includes('noindex') &&
      Boolean(h.get('content-security-policy')) &&
      Boolean(h.get('strict-transport-security')),
    `/login ${login.status}; X-Frame-Options=${h.get('x-frame-options')}; X-Robots-Tag=${h.get('x-robots-tag')}; CSP ${h.get('content-security-policy') ? 'set' : 'missing'}; HSTS ${h.get('strict-transport-security') ? 'set' : 'missing'}`,
  );
}

async function webChecks() {
  const home = await fetch(`${WEB}/`);
  const h = home.headers;
  check(
    'TC-SEC-02 (web)',
    home.status === 200 &&
      (h.get('content-security-policy') ?? '').includes("object-src 'none'") &&
      h.get('x-content-type-options') === 'nosniff' &&
      Boolean(h.get('referrer-policy')) &&
      Boolean(h.get('strict-transport-security')),
    `/ ${home.status}; CSP ${h.get('content-security-policy') ? 'set' : 'missing'}; nosniff=${h.get('x-content-type-options')}; Referrer-Policy=${h.get('referrer-policy')}; HSTS ${h.get('strict-transport-security') ? 'set' : 'missing'}`,
  );
  const version = (await (await fetch(`${WEB}/zidcms-version.json?c=${Date.now()}`)).json()) as {
    version: number;
    checksum: string;
  };
  spawnSync('git', ['fetch', '-q', 'origin', BRANCH], { cwd: root });
  const shown = spawnSync('git', ['show', `origin/${BRANCH}:apps/web/content/${ENV}/snapshot.json`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const snapshot = JSON.parse(shown.stdout) as Snapshot;
  const sameVersion = snapshot.version === version.version && snapshot.checksum === version.checksum;
  check(
    'live = repo snapshot',
    sameVersion,
    `live v${version.version}, origin/${BRANCH}:apps/web/content/${ENV}/snapshot.json v${snapshot.version}`,
  );

  const missing = await fetch(`${WEB}/blog/does-not-exist-${randomUUID().slice(0, 8)}/`);
  const missingHtml = await missing.text();
  check('TC-WEB-05', missing.status === 404 && missingHtml.includes('404'), `unknown slug → ${missing.status}`);

  const robots = await (await fetch(`${WEB}/robots.txt`)).text();
  check('robots.txt', robots.includes(`Sitemap: ${WEB}/sitemap.xml`), robots.replace(/\s+/g, ' ').trim());

  const xml = await (await fetch(`${WEB}/sitemap.xml`)).text();
  const listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] as string).sort();
  const pages = Math.max(1, Math.ceil(snapshot.posts.length / Math.max(1, snapshot.site.postsPerPage || 10)));
  const expected = [
    `${WEB}/`,
    ...Array.from({ length: pages - 1 }, (_, i) => `${WEB}/page/${i + 2}/`),
    ...snapshot.posts.map((p) => `${WEB}/blog/${p.slug}/`),
    ...snapshot.pages.map((p) => `${WEB}/${p.slug}/`),
    ...snapshot.categories.map((c) => `${WEB}/category/${c.slug}/`),
    ...snapshot.tags.map((t) => `${WEB}/tag/${t.slug}/`),
  ].sort();
  check(
    'TC-WEB-04',
    sameVersion && JSON.stringify(listed) === JSON.stringify(expected),
    `sitemap lists ${listed.length} URLs, snapshot expects ${expected.length}`,
  );

  const post = snapshot.posts[0];
  if (post) {
    const html = await (await fetch(`${WEB}/blog/${post.slug}/`)).text();
    const meta = (re: RegExp) => re.exec(html)?.[1] ?? null;
    const canonical = meta(/<link rel="canonical" href="([^"]+)"/);
    const ogTitle = meta(/<meta property="og:title" content="([^"]+)"/);
    const ogUrl = meta(/<meta property="og:url" content="([^"]+)"/);
    const ogType = meta(/<meta property="og:type" content="([^"]+)"/);
    const description = meta(/<meta name="description" content="([^"]+)"/);
    check(
      'TC-WEB-03',
      canonical === `${WEB}/blog/${post.slug}/` &&
        ogUrl === canonical &&
        Boolean(ogTitle) &&
        ogType === 'article' &&
        Boolean(description),
      `canonical=${canonical} og:url=${ogUrl} og:type=${ogType} og:title ${ogTitle ? 'set' : 'missing'} description ${description ? 'set' : 'missing'}`,
    );
  } else check('TC-WEB-03', true, 'skipped: no published post in the live snapshot');

  const json = JSON.stringify(snapshot);
  check(
    'TC-SEC-06',
    !/created_by|updated_by|drive_file_id|requested_by/.test(json) && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(json),
    'live snapshot has no actor fields, Drive ids or e-mail addresses',
  );
}

async function main() {
  console.log(`Deployed checks: admin ${new URL(ADMIN).host}, web ${new URL(WEB).host}`);
  await adminChecks();
  await webChecks();
  console.log(failed ? `${failed} check(s) FAILED` : 'All deployed checks passed');
  process.exit(failed ? 1 : 0);
}

void main();

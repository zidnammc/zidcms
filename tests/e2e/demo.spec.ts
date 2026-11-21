import { createHash } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import {
  ADMIN,
  INTRUDER_EMAIL,
  type JobTrace,
  LOCAL_ADMIN_EMAIL,
  liveVersion,
  mintSessionCookie,
  publicPage,
  setBuildFailure,
  stagingAdminEmail,
  target,
  uniquePng,
  type VersionFile,
  WEB,
  waitForJob,
  writeEvidence,
} from './env';

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const title = `E2E ${stamp} artikel demo`;
const evidence: Record<string, unknown> = { target, stamp, startedAt: new Date().toISOString() };

async function devLogin(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/Dev login/).fill(email);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}

async function jobFrom(page: Page, trigger: () => Promise<unknown>, match: (url: string, method: string) => boolean) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => match(r.url(), r.request().method()) && r.status() < 300, { timeout: 120_000 }),
    trigger(),
  ]);
  const body = (await response.json()) as { publishJob?: { id: string } | null; job?: { id: string } };
  const id = body.publishJob?.id ?? body.job?.id;
  if (!id) throw new Error(`no publish job in ${response.url()}`);
  return id;
}

async function expectAbsent(path: string) {
  const { status, html } = await publicPage(path);
  if (target === 'staging') expect(status, path).toBe(404);
  else expect(status, `${path} (next dev answers unknown static params with 500)`).not.toBe(200);
  expect(html).not.toContain(title);
}

function record(name: string, trace: JobTrace, version?: VersionFile) {
  evidence[name] = {
    jobId: trace.job.id,
    type: trace.job.type,
    states: trace.states,
    final: trace.job.state,
    snapshotVersion: trace.job.snapshot_version,
    commit: trace.job.git_commit_sha,
    error: trace.job.error_code ? `${trace.job.error_code}: ${trace.job.error_message}` : null,
    seconds: Math.round(trace.ms / 1000),
    liveVersionFile: version ?? null,
  };
}

test.describe.configure({ mode: 'serial' });

test('TC-E2E-01 demo scenario (plan §24.3) incl. PoC-3 media and TC-PUB-07/08/11', async ({
  page,
  browser,
  context,
}) => {
  const png = uniquePng();
  const filename = `e2e-${stamp}.png`;
  let postId = '';
  let slug = '';
  let mediaUrl = '';
  let mediaId = '';
  let first: VersionFile | null = null;

  await test.step('1. non-allowlisted account is rejected, admin signs in', async () => {
    if (target === 'local') {
      await devLogin(page, INTRUDER_EMAIL);
      await expect(page.getByRole('alert').filter({ hasText: 'Akses ditolak' })).toBeVisible();
      await devLogin(page, LOCAL_ADMIN_EMAIL);
    } else {
      const intruder = await browser.newContext();
      await mintSessionCookie(intruder, INTRUDER_EMAIL);
      const p = await intruder.newPage();
      await p.goto(`${ADMIN}/`);
      await expect(p).toHaveURL(/\/login\?error=AccessDenied/);
      await expect(p.getByRole('alert').filter({ hasText: 'Akses ditolak' })).toBeVisible();
      expect((await intruder.request.get(`${ADMIN}/api/posts`)).status()).toBe(403);
      await intruder.close();
      await mintSessionCookie(context, stagingAdminEmail());
      await page.goto('/');
    }
    await expect(page).toHaveURL(`${ADMIN}/`);
    await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible();
  });

  await test.step('2. create a draft with an uploaded image (PoC-3) and save it', async () => {
    await page.goto('/posts/new');
    await page.locator('#title').fill(title);
    await page.getByLabel('Konten Markdown').fill('# Halo\n\nIsi **pertama** dari uji E2E.\n');
    await page.getByRole('button', { name: 'Sisipkan media' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Sisipkan gambar ke konten');
    const [upload] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/media') && r.request().method() === 'POST', {
        timeout: 120_000,
      }),
      page.locator('input[type=file]').setInputFiles({ name: filename, mimeType: 'image/png', buffer: png.buffer }),
    ]);
    expect(upload.status()).toBeLessThan(300);
    const media = ((await upload.json()) as { item: { id: string; sha256: string } }).item;
    expect(media.sha256).toBe(png.sha256);
    mediaId = media.id;
    await dialog.getByRole('button').filter({ hasText: filename }).click();
    await expect(page.getByLabel('Konten Markdown')).toHaveValue(new RegExp(`zid-media:${media.id}`));
    const [created] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/posts') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Simpan draf' }).click(),
    ]);
    const item = (await created.json()) as { id: string; slug: string };
    postId = item.id;
    slug = item.slug;
    await expect(page).toHaveURL(new RegExp(`/posts/${postId}`));
    await expect(page.getByRole('heading', { name: 'Edit artikel' })).toBeVisible();
    evidence.post = { id: postId, slug, mediaId: media.id, mediaSha256: png.sha256 };
    const anon = await fetch(`${ADMIN}/api/media/${media.id}/preview`, { redirect: 'manual' });
    expect(anon.status).toBe(401);
  });

  await test.step('3. preview works; the draft is absent from the public site', async () => {
    const preview = await context.newPage();
    await preview.goto(`/preview/posts/${postId}`);
    await expect(preview.getByRole('heading', { name: 'Halo' })).toBeVisible();
    await expect(preview.locator(`img[src="/api/media/${mediaId}/preview"]`)).toHaveCount(1);
    await preview.close();
    await expectAbsent(`/blog/${slug}/`);
    const snap = await publicPage('/');
    expect(snap.html).not.toContain(title);
  });

  await test.step('4. publish and watch the job reach live', async () => {
    await page.goto(`/posts/${postId}`);
    const jobId = await jobFrom(
      page,
      () => page.getByRole('button', { name: 'Terbitkan' }).click(),
      (url, method) => url.endsWith(`/api/posts/${postId}/status`) && method === 'POST',
    );
    const trace = await waitForJob(page.request, jobId);
    expect(trace.job.state, trace.job.error_message ?? '').toBe('live');
    first = await liveVersion();
    record('publish', trace, first);
    expect(first.version).toBe(trace.job.snapshot_version);
    expect(first.checksum).toBe(trace.job.checksum);
    await page.goto('/publish');
    await expect(page.getByText(trace.job.id.slice(0, 8)).first()).toBeVisible();
  });

  await test.step('5. public URL shows the post and image; only the site origin is contacted (TC-WEB-06)', async () => {
    const hosts = new Set<string>();
    const reader = await browser.newContext();
    const p = await reader.newPage();
    p.on('request', (r) => {
      if (!r.url().startsWith('data:')) hosts.add(new URL(r.url()).host);
    });
    const res = await p.goto(`${WEB}/blog/${slug}/`);
    expect(res?.status()).toBe(200);
    await expect(p.getByRole('heading', { name: title })).toBeVisible();
    const src = await p.locator(`img[src^="/media/${png.sha256}"]`).first().getAttribute('src');
    expect(src).toBeTruthy();
    mediaUrl = `${WEB}${src}`;
    const bytes = Buffer.from(await (await fetch(mediaUrl)).arrayBuffer());
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(png.sha256);
    await p.waitForLoadState('networkidle');
    await reader.close();
    evidence.publicRequestHosts = [...hosts];
    evidence.media = { url: mediaUrl.replace(WEB, '<site>'), sha256Match: true };
    expect([...hosts]).toEqual([new URL(WEB).host]);
  });

  await test.step('6. edit, click Perbarui, new content is live', async () => {
    await page.goto(`/posts/${postId}`);
    const editor = page.getByLabel('Konten Markdown');
    await editor.fill((await editor.inputValue()).replace('Isi **pertama**', 'Isi **kedua**'));
    const jobId = await jobFrom(
      page,
      () => page.getByRole('button', { name: 'Perbarui' }).click(),
      (url, method) => url.endsWith(`/api/posts/${postId}`) && method === 'PATCH',
    );
    const trace = await waitForJob(page.request, jobId);
    expect(trace.job.state, trace.job.error_message ?? '').toBe('live');
    const version = await liveVersion();
    record('update', trace, version);
    expect(version.version).toBe(trace.job.snapshot_version);
    expect((await publicPage(`/blog/${slug}/`)).html).toContain('kedua');
  });

  await test.step('7a. failed build leaves the previous version live (TC-PUB-07)', async () => {
    const before = await liveVersion();
    setBuildFailure(true);
    try {
      await page.goto(`/posts/${postId}`);
      const editor = page.getByLabel('Konten Markdown');
      await editor.fill((await editor.inputValue()).replace('Isi **kedua**', 'Isi **ketiga** (build gagal)'));
      const jobId = await jobFrom(
        page,
        () => page.getByRole('button', { name: 'Perbarui' }).click(),
        (url, method) => url.endsWith(`/api/posts/${postId}`) && method === 'PATCH',
      );
      const trace = await waitForJob(page.request, jobId);
      record('failedBuild', trace, await liveVersion());
      expect(trace.job.state).toBe('failed');
      expect(trace.job.error_code).toBe('DEPLOY_FAILED');
    } finally {
      setBuildFailure(false);
    }
    expect(await liveVersion()).toEqual(before);
    const html = (await publicPage(`/blog/${slug}/`)).html;
    expect(html).toContain('kedua');
    expect(html).not.toContain('ketiga');
    await page.goto('/publish');
    await expect(page.getByText('DEPLOY_FAILED').first()).toBeVisible();
  });

  await test.step('7b. roll back to the first published version (TC-PUB-08)', async () => {
    const targetVersion = (first as VersionFile).version;
    await page.goto('/publish');
    const row = page
      .locator('tbody tr')
      .filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^v${targetVersion}(\\D|$)`) }) });
    await row.getByRole('button', { name: 'Rollback' }).click();
    const jobId = await jobFrom(
      page,
      () => page.getByRole('button', { name: 'Ya, rollback' }).click(),
      (url, method) => url.endsWith('/api/publish/rollback') && method === 'POST',
    );
    const trace = await waitForJob(page.request, jobId);
    expect(trace.job.state, trace.job.error_message ?? '').toBe('live');
    const version = await liveVersion();
    record('rollback', trace, version);
    expect(version.version).toBeGreaterThan(targetVersion);
    expect(version.checksum).toBe((first as VersionFile).checksum);
    const html = (await publicPage(`/blog/${slug}/`)).html;
    expect(html).toContain('pertama');
    const img = await fetch(mediaUrl);
    expect(img.status).toBe(200);
  });

  await test.step('cleanup: trash the post; it and its exclusive media leave the site (TC-PUB-11)', async () => {
    const current = (await (await page.request.get(`${ADMIN}/api/posts/${postId}`)).json()) as { version: number };
    const res = await page.request.delete(`${ADMIN}/api/posts/${postId}`, {
      headers: { origin: ADMIN, 'content-type': 'application/json' },
      data: { expected_version: current.version },
    });
    expect(res.status()).toBeLessThan(300);
    const { publishJob } = (await res.json()) as { publishJob: { id: string } | null };
    expect(publishJob).not.toBeNull();
    const trace = await waitForJob(page.request, (publishJob as { id: string }).id);
    expect(trace.job.state, trace.job.error_message ?? '').toBe('live');
    record('cleanup', trace, await liveVersion());
    await expectAbsent(`/blog/${slug}/`);
    expect((await fetch(`${mediaUrl}?e2e=${Date.now()}`)).status).toBe(404);
  });

  await test.step('sign out clears the session (TC-AUTH-04)', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get(`${ADMIN}/api/posts`)).status()).toBe(401);
  });

  evidence.finishedAt = new Date().toISOString();
  writeEvidence(evidence);
});

test.afterAll(() => {
  if (!evidence.finishedAt) writeEvidence({ ...evidence, incomplete: true });
  setBuildFailure(false);
});

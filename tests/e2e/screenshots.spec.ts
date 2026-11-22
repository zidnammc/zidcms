import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN, LOCAL_ADMIN_EMAIL, target, WEB, waitForJob } from './env';

const dir = resolve(import.meta.dirname, '../../docs/screenshots');

test.skip(target !== 'local' || process.env.SCREENSHOTS !== '1', 'set SCREENSHOTS=1 on the local stack');

test('capture README screenshots', async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.appendChild(style);
    });
  });
  await page.setViewportSize({ width: 1366, height: 820 });
  await page.goto('/login');
  await page.screenshot({ path: `${dir}/admin-login.png` });
  await page.getByLabel(/Dev login/).fill(LOCAL_ADMIN_EMAIL);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(`${ADMIN}/`);

  const { job } = (await (
    await page.request.post(`${ADMIN}/api/publish`, {
      headers: { origin: ADMIN, 'content-type': 'application/json' },
      data: { idempotency_key: crypto.randomUUID() },
    })
  ).json()) as { job: { id: string } };
  expect((await waitForJob(page.request, job.id)).job.state).toBe('live');

  await page.goto('/');
  await expect(page.getByText(/Sinkron dengan snapshot/).first()).toBeVisible();
  await page.screenshot({ path: `${dir}/admin-dashboard.png` });

  await page.goto('/posts');
  await page
    .getByRole('link', { name: /Menulis dengan Markdown/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Edit artikel' })).toBeVisible();
  await page.screenshot({ path: `${dir}/admin-editor.png` });

  await page.goto('/publish');
  await expect(page.getByText('Riwayat snapshot')).toBeVisible();
  await page.screenshot({ path: `${dir}/admin-publish.png` });

  await page.goto(`${WEB}/`);
  await expect(page.getByText('Selamat datang di ZidCMS').first()).toBeVisible();
  await page.screenshot({ path: `${dir}/site-home.png` });
  await page.goto(`${WEB}/blog/menulis-dengan-markdown/`);
  await page.screenshot({ path: `${dir}/site-post.png`, fullPage: false });
});

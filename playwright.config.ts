import { defineConfig } from '@playwright/test';
import { ADMIN, target } from './tests/e2e/env';

const local = target === 'local';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: local ? 10 * 60_000 : 75 * 60_000,
  expect: { timeout: local ? 20_000 : 60_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: ADMIN,
    locale: 'id-ID',
    actionTimeout: 60_000,
    navigationTimeout: 120_000,
    trace: local ? 'retain-on-failure' : 'off',
    screenshot: local ? 'only-on-failure' : 'off',
    video: 'off',
  },
  webServer: local
    ? [
        { command: 'pnpm dev:gas', url: 'http://localhost:8787/', reuseExistingServer: true },
        { command: 'pnpm dev:admin', url: 'http://localhost:3000/login', reuseExistingServer: true, timeout: 180_000 },
        { command: 'pnpm dev:web', url: 'http://localhost:3001/', reuseExistingServer: true, timeout: 180_000 },
      ]
    : undefined,
});

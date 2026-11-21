import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, '../apps/admin/.env.local');
if (existsSync(path) && !process.argv.includes('--force')) {
  console.log('apps/admin/.env.local already exists (use --force to overwrite).');
  process.exit(0);
}
const secret = () => randomBytes(32).toString('base64');
writeFileSync(
  path,
  [
    `AUTH_SECRET=${secret()}`,
    'AUTH_GOOGLE_ID=local-dev-placeholder',
    'AUTH_GOOGLE_SECRET=local-dev-placeholder',
    'ADMIN_EMAILS=admin@example.com',
    'ADMIN_URL=http://localhost:3000',
    'ZIDCMS_ENV=dev',
    'ZIDCMS_DEV_LOGIN=true',
    'GAS_WEBAPP_URL=http://localhost:8787/exec',
    `GAS_HMAC_SECRET=${secret()}`,
    'PUBLISH_TARGET=local',
    'PUBLIC_SITE_URL=http://localhost:3001',
    '',
  ].join('\n'),
);
console.log('Wrote apps/admin/.env.local for the local stack (dev login as admin@example.com).');

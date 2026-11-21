import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = process.argv[2] ?? 'dev';
const dir = resolve(import.meta.dirname, '../.local/secrets');
const target = resolve(dir, `${env}.env`);
mkdirSync(dir, { recursive: true });

if (existsSync(target)) {
  console.log(`.local/secrets/${env}.env already exists; not overwriting.`);
  process.exit(0);
}

const log = resolve(dir, `clasp-create-${env}.log`);
const text = existsSync(log) ? readFileSync(log, 'utf8') : '';
const sheet = /https:\/\/drive\.google\.com\/open\?id=[A-Za-z0-9_-]+/.exec(text)?.[0] ?? '';
const editor = /https:\/\/script\.google\.com\/d\/[A-Za-z0-9_-]+\/edit/.exec(text)?.[0] ?? '';
const secret = () => randomBytes(32).toString('base64');

writeFileSync(
  target,
  [
    `# ZidCMS ${env} — PRIVATE. Never commit, paste in chat, or screenshot.`,
    '# HMAC_SECRET → Apps Script Script Property HMAC_SECRET and Vercel (admin) GAS_HMAC_SECRET',
    `HMAC_SECRET=${secret()}`,
    '# AUTH_SECRET → Vercel (admin) AUTH_SECRET',
    `AUTH_SECRET=${secret()}`,
    `SPREADSHEET_URL=${sheet}`,
    `SCRIPT_EDITOR_URL=${editor}`,
    '# Filled later:',
    'GAS_WEBAPP_URL=',
    'GITHUB_TOKEN=',
    '',
  ].join('\n'),
);
console.log(`Wrote .local/secrets/${env}.env (values hidden).`);

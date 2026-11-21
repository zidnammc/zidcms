import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const PATTERNS: [string, RegExp][] = [
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Google OAuth client secret', /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/],
  ['Apps Script exec URL', /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec/],
  [
    'Secret env assignment',
    /\b(AUTH_SECRET|GAS_HMAC_SECRET|GITHUB_TOKEN|AUTH_GOOGLE_SECRET)\s*=\s*['"]?[A-Za-z0-9+/=_-]{16,}/,
  ],
];

const SECRET_ENV = [
  'AUTH_SECRET',
  'AUTH_GOOGLE_SECRET',
  'GAS_HMAC_SECRET',
  'GITHUB_TOKEN',
  'GAS_WEBAPP_URL',
  'AUTH_GOOGLE_ID',
];

function localSecrets(): { name: string; value: string }[] {
  const values: { name: string; value: string }[] = [];
  for (const file of ['apps/admin/.env.local', 'apps/admin/.env.production.local']) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!m) continue;
      const [, name, value] = m as unknown as [string, string, string];
      if (
        SECRET_ENV.includes(name) &&
        value.length >= 12 &&
        !value.includes('placeholder') &&
        !value.includes('localhost')
      ) {
        values.push({ name, value });
      }
      if (name === 'ADMIN_EMAILS') {
        for (const email of value
          .split(',')
          .map((e) => e.trim())
          .filter((e) => e && !e.endsWith('@example.com'))) {
          values.push({ name: 'ADMIN_EMAILS', value: email });
        }
      }
    }
  }
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (value && value.length >= 12) values.push({ name, value });
  }
  return values;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|mjs|cjs|html|json|txt|css|map|xml)$/.test(entry)) out.push(full);
  }
  return out;
}

const mode = process.argv.includes('--repo') ? 'repo' : 'bundles';
const files =
  mode === 'repo'
    ? execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
        .map((f) => resolve(root, f))
        .filter((f) => existsSync(f) && statSync(f).size < 5_000_000)
    : [
        ...walk(resolve(root, 'apps/admin/.next/static')),
        ...walk(resolve(root, 'apps/web/out')),
        ...walk(resolve(root, 'services/apps-script/dist')),
      ];

if (mode === 'bundles' && files.length === 0) {
  console.error('No build output found. Run `pnpm build` first.');
  process.exit(1);
}

const secrets = localSecrets();
const findings: string[] = [];
for (const file of files) {
  if (file.endsWith('verify-bundle-secrets.ts')) continue;
  const text = readFileSync(file, 'utf8');
  for (const [label, pattern] of PATTERNS) {
    const match = text.match(pattern);
    if (match && !match[0].includes('placeholder')) findings.push(`${relative(root, file)}: ${label}`);
  }
  for (const { name, value } of secrets) {
    if (text.includes(value)) findings.push(`${relative(root, file)}: value of ${name}`);
  }
}

console.log(
  `Scanned ${files.length} files (${mode}); checked ${PATTERNS.length} patterns and ${secrets.length} local secret values.`,
);
if (findings.length) {
  console.error(`FOUND ${findings.length} potential secret(s):\n${findings.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('No secrets found.');

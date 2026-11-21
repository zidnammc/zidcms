import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = process.argv.find((a) => a === 'dev' || a === 'prod') ?? 'dev';
const root = resolve(import.meta.dirname, '..');
const file = resolve(root, `.local/secrets/${env}.env`);
if (!existsSync(file)) throw new Error(`Missing .local/secrets/${env}.env`);

const values: Record<string, string> = {};
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m?.[2]) values[m[1] as string] = m[2].trim();
}

const adminProject = values.VERCEL_ADMIN_PROJECT ?? 'zidcms-admin';
const webProject = values.VERCEL_WEB_PROJECT ?? 'zidcms-web';
const adminUrl = values.ADMIN_URL ?? `https://${adminProject}.vercel.app`;
const siteUrl = values.PUBLIC_SITE_URL ?? `https://${webProject}.vercel.app`;

type Var = { name: string; value: string | undefined; secret: boolean };
const admin: Var[] = [
  { name: 'AUTH_SECRET', value: values.AUTH_SECRET, secret: true },
  { name: 'GAS_HMAC_SECRET', value: values.HMAC_SECRET, secret: true },
  { name: 'GAS_WEBAPP_URL', value: values.GAS_WEBAPP_URL, secret: true },
  { name: 'AUTH_GOOGLE_ID', value: values.AUTH_GOOGLE_ID, secret: true },
  { name: 'AUTH_GOOGLE_SECRET', value: values.AUTH_GOOGLE_SECRET, secret: true },
  { name: 'ADMIN_EMAILS', value: values.ADMIN_EMAILS, secret: true },
  { name: 'GITHUB_TOKEN', value: values.GITHUB_TOKEN, secret: true },
  { name: 'ADMIN_URL', value: adminUrl, secret: false },
  { name: 'PUBLIC_SITE_URL', value: siteUrl, secret: false },
  { name: 'ZIDCMS_ENV', value: env, secret: false },
  { name: 'PUBLISH_TARGET', value: 'github', secret: false },
  { name: 'GITHUB_REPO', value: values.GITHUB_REPO, secret: false },
  { name: 'GITHUB_BRANCH', value: values.GITHUB_BRANCH ?? 'main', secret: false },
  { name: 'CONTENT_ROOT', value: 'apps/web', secret: false },
  { name: 'VERCEL_STATUS_CONTEXT', value: webProject, secret: false },
];
const web: Var[] = [{ name: 'SITE_URL', value: siteUrl, secret: false }];

function sync(project: string, vars: Var[]) {
  for (const v of vars) {
    if (!v.value) {
      console.log(`  - ${project} ${v.name}: skipped (empty in .local/secrets/${env}.env)`);
      continue;
    }
    const result = spawnSync(
      'vercel',
      [
        'env',
        'add',
        v.name,
        '--environment',
        'production',
        '--project',
        project,
        '--force',
        '--yes',
        v.secret ? '--sensitive' : '--no-sensitive',
      ],
      { input: v.value, encoding: 'utf8', shell: process.platform === 'win32', cwd: root },
    );
    const ok = result.status === 0;
    console.log(
      `  ${ok ? '✓' : '✗'} ${project} ${v.name}${ok ? '' : ` (exit ${result.status}: ${(result.stderr || '').split('\n').find((l) => /error/i.test(l)) ?? 'see vercel output'})`}`,
    );
  }
}

console.log(`Syncing ${env} variables to Vercel (values are never printed):`);
sync(webProject, web);
sync(adminProject, admin);

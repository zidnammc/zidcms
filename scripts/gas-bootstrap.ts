import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = process.argv.find((a) => a === 'dev' || a === 'prod') ?? 'dev';
const cleanup = process.argv.includes('--cleanup');
const root = resolve(import.meta.dirname, '..');
const gasDir = resolve(root, 'services/apps-script');
const bootstrapFile = resolve(gasDir, 'dist/Bootstrap.js');
const secretsFile = resolve(root, `.local/secrets/${env}.env`);
const project = env === 'prod' ? ['-P', '.clasp.prod.json'] : [];

const push = () =>
  execSync(['clasp', ...project, 'push', '--force'].map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' '), {
    cwd: gasDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

if (cleanup) {
  if (existsSync(bootstrapFile)) rmSync(bootstrapFile);
  push();
  console.log('Bootstrap.js removed from the Apps Script project.');
  process.exit(0);
}

if (!existsSync(secretsFile))
  throw new Error(`Missing .local/secrets/${env}.env — run scripts/init-dev-secrets.ts first.`);
const secret = /^HMAC_SECRET=([A-Za-z0-9+/=]{40,})$/m.exec(readFileSync(secretsFile, 'utf8'))?.[1];
if (!secret) throw new Error('HMAC_SECRET not found in the secrets file.');

writeFileSync(
  bootstrapFile,
  [
    '// JANGAN screenshot atau salin file ini: berisi kunci rahasia. File ini dihapus otomatis setelah dijalankan.',
    '// Pilih fungsi "bootstrap" di dropdown atas, lalu klik Jalankan / Run.',
    'function bootstrap() {',
    '  zidcmsApplyProperties_();',
    '  return setup();',
    '}',
    ...Array.from({ length: 120 }, () => ''),
    'function zidcmsApplyProperties_() {',
    `  PropertiesService.getScriptProperties().setProperties({ HMAC_SECRET: '${secret}', ENVIRONMENT: '${env}' });`,
    "  console.log('Script properties set (HMAC_SECRET, ENVIRONMENT).');",
    '}',
    '',
  ].join('\n'),
);
push();
console.log(
  'Bootstrap.js pushed. Run `bootstrap` once in the Apps Script editor, then run this script with --cleanup.',
);

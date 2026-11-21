import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const mode = process.argv[2];
if (mode !== 'on' && mode !== 'off') {
  console.error('Usage: pnpm build-switch on|off   (sets/removes ZIDCMS_FAIL_BUILD=1 on the dev web project)');
  process.exit(1);
}
const project = process.env.VERCEL_WEB_PROJECT ?? 'zidcms-web';
const args =
  mode === 'on'
    ? ['env', 'add', 'ZIDCMS_FAIL_BUILD', 'production', '--project', project, '--force', '--yes', '--no-sensitive']
    : [
        'env',
        'rm',
        'ZIDCMS_FAIL_BUILD',
        '--environment',
        'production',
        '--project',
        project,
        '--confirm-name',
        'ZIDCMS_FAIL_BUILD',
      ];
const result = spawnSync('vercel', args, {
  input: mode === 'on' ? '1' : undefined,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  cwd: resolve(import.meta.dirname, '..'),
});
const removedAlready = mode === 'off' && /not found|does not exist/i.test(`${result.stderr}${result.stdout}`);
if (result.status !== 0 && !removedAlready) {
  console.error(`vercel ${args.slice(0, 2).join(' ')} failed (exit ${result.status})`);
  process.exit(1);
}
console.log(
  mode === 'on'
    ? `ZIDCMS_FAIL_BUILD=1 set on ${project}: the next web build fails on purpose (TC-PUB-07).`
    : `ZIDCMS_FAIL_BUILD removed from ${project}: builds are normal again.`,
);

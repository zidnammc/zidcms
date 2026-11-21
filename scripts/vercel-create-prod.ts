import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, '.local/secrets/prod.env');
const values: Record<string, string> = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m?.[2]) values[m[1] as string] = m[2].trim();
  }
}
const repo = values.GITHUB_REPO ?? process.env.GITHUB_REPO ?? '';
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('GITHUB_REPO (owner/repo) missing in .local/secrets/prod.env');

function api(method: string, path: string, body: unknown): { ok: boolean; out: string } {
  const result = spawnSync('vercel', ['api', path, '-X', method, '--input', '-', '--raw'], {
    input: JSON.stringify(body),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    cwd: root,
  });
  return { ok: result.status === 0, out: `${result.stdout}${result.stderr}` };
}

for (const [name, rootDirectory] of [
  [values.VERCEL_ADMIN_PROJECT ?? 'zidcms-prod-admin', 'apps/admin'],
  [values.VERCEL_WEB_PROJECT ?? 'zidcms-prod-web', 'apps/web'],
] as const) {
  const created = api('POST', '/v11/projects', {
    name,
    framework: 'nextjs',
    rootDirectory,
    gitRepository: { type: 'github', repo },
  });
  const exists = /already exists|conflict/i.test(created.out);
  console.log(`${created.ok ? '✓ created' : exists ? '• exists ' : '✗ failed '} ${name} (root ${rootDirectory})`);
  if (!created.ok && !exists) {
    console.log(`  ${created.out.match(/"message"\s*:\s*"([^"]+)"/)?.[1] ?? 'see vercel output'}`);
    continue;
  }
  const branch = api('PATCH', `/v9/projects/${name}/branch`, { branch: 'release' });
  console.log(
    `${branch.ok ? '✓' : '✗'} ${name} production branch → release${branch.ok ? '' : ' (set it in Project → Settings → Git)'}`,
  );
}

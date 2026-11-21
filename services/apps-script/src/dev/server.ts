import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS, handleRpc } from '../dispatcher';
import { emptyState, type MemoryState, memoryDeps } from '../memory';
import type { Ctx } from '../ports';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const envFile = resolve(root, 'apps/admin/.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const secret = process.env.GAS_HMAC_SECRET ?? '';
if (secret.length < 32) {
  console.error('GAS_HMAC_SECRET (>= 32 chars) wajib diset di apps/admin/.env.local');
  process.exit(1);
}

const port = Number(process.env.GAS_DEV_PORT ?? 8787);
const statePath = resolve(root, '.local/gas-dev/state.json');
mkdirSync(dirname(statePath), { recursive: true });

const state: MemoryState = existsSync(statePath)
  ? (JSON.parse(readFileSync(statePath, 'utf8')) as MemoryState)
  : emptyState();
state.props.HMAC_SECRET = secret;
state.props.ENVIRONMENT = 'dev';

const latencyMs = Number(process.env.GAS_DEV_LATENCY_MS ?? 0);
const deps = memoryDeps(state, {
  log: (entry) => console.log(JSON.stringify({ at: new Date().toISOString(), ...entry })),
});

const persist = () => writeFileSync(statePath, JSON.stringify(state));

if (!state.sheets.Posts) {
  const ctx: Ctx = {
    ...deps,
    actor: 'dev-setup@localhost.invalid',
    requestId: randomUUID(),
    environment: 'dev',
    nowIso: new Date().toISOString(),
  };
  console.log('setup', JSON.stringify(ACTIONS['system.setup']?.run(ctx, {})));
  persist();
}

const results = new Map<string, string>();

createServer((req, res) => {
  if (req.method === 'GET' && req.url?.startsWith('/exec-result/')) {
    const id = req.url.slice('/exec-result/'.length);
    const body = results.get(id);
    results.delete(id);
    res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
    res.end(body ?? '{}');
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body>ZidCMS GAS dev emulator</body></html>');
    return;
  }
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    setTimeout(() => {
      const response = handleRpc(raw, deps);
      persist();
      const id = randomUUID();
      results.set(id, JSON.stringify(response));
      res.writeHead(302, { location: `/exec-result/${id}` });
      res.end();
    }, latencyMs);
  });
}).listen(port, () => {
  console.log(`GAS dev emulator: http://localhost:${port}/exec (state: ${statePath})`);
});

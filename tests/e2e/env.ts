import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { encode } from '@auth/core/jwt';
import type { APIRequestContext, BrowserContext } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');

export const target: 'local' | 'staging' = process.env.E2E_TARGET === 'staging' ? 'staging' : 'local';

if (target === 'staging') {
  const file = resolve(root, process.env.ZIDCMS_ENV_FILE ?? '.local/secrets/dev.env');
  if (!existsSync(file)) throw new Error('E2E_TARGET=staging needs ZIDCMS_ENV_FILE (default .local/secrets/dev.env)');
  process.loadEnvFile(file);
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const ADMIN = trimSlash(target === 'staging' ? (process.env.ADMIN_URL ?? '') : 'http://localhost:3000');
export const WEB = trimSlash(target === 'staging' ? (process.env.PUBLIC_SITE_URL ?? '') : 'http://localhost:3001');
export const LOCAL_ADMIN_EMAIL = 'admin@example.com';
export const INTRUDER_EMAIL = 'intruder@example.com';

export const PUBLISH_TIMEOUT_MS = target === 'staging' ? 12 * 60_000 : 90_000;
const POLL_MS = target === 'staging' ? 4_000 : 1_000;

export async function mintSessionCookie(context: BrowserContext, email: string): Promise<void> {
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < 32) throw new Error('AUTH_SECRET missing in the staging env file');
  const url = new URL(ADMIN);
  const secure = url.protocol === 'https:';
  const name = `${secure ? '__Secure-' : ''}authjs.session-token`;
  const value = await encode({ token: { name: email, email, sub: email }, secret, salt: name, maxAge: 2 * 60 * 60 });
  await context.addCookies([{ name, value, domain: url.hostname, path: '/', httpOnly: true, secure, sameSite: 'Lax' }]);
}

export function stagingAdminEmail(): string {
  const email = (process.env.ADMIN_EMAILS ?? '').split(',')[0]?.trim();
  if (!email) throw new Error('ADMIN_EMAILS missing in the staging env file');
  return email;
}

export interface Job {
  id: string;
  type: string;
  state: string;
  snapshot_version: number | null;
  checksum: string | null;
  git_commit_sha: string | null;
  error_code: string | null;
  error_message: string | null;
  deploy_detail: string;
}

export interface JobTrace {
  job: Job;
  states: string[];
  ms: number;
}

export async function waitForJob(request: APIRequestContext, jobId: string): Promise<JobTrace> {
  const started = Date.now();
  const states: string[] = [];
  for (;;) {
    const res = await request.get(`${ADMIN}/api/publish/${jobId}`);
    if (res.ok()) {
      const { job } = (await res.json()) as { job: Job };
      if (states.at(-1) !== job.state) states.push(job.state);
      if (job.state === 'live' || job.state === 'failed') return { job, states, ms: Date.now() - started };
    } else if (res.status() !== 503 && res.status() !== 502) {
      throw new Error(`poll ${jobId} → HTTP ${res.status()} ${(await res.text()).slice(0, 200)}`);
    }
    if (Date.now() - started > PUBLISH_TIMEOUT_MS)
      throw new Error(`job ${jobId} not terminal after ${states.join(' → ')}`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export interface VersionFile {
  version: number;
  checksum: string;
  generatedAt: string;
}

export async function liveVersion(): Promise<VersionFile> {
  const res = await fetch(`${WEB}/zidcms-version.json?e2e=${Date.now()}`, { cache: 'no-store' });
  return (await res.json()) as VersionFile;
}

export async function publicPage(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${WEB}${path}${path.includes('?') ? '&' : '?'}e2e=${Date.now()}`, { cache: 'no-store' });
  return { status: res.status, html: await res.text() };
}

export function setBuildFailure(on: boolean): void {
  if (target === 'local') {
    const flag = resolve(root, '.local/publish/deploy-fail');
    mkdirSync(resolve(root, '.local/publish'), { recursive: true });
    if (on) writeFileSync(flag, 'e2e\n');
    else rmSync(flag, { force: true });
    return;
  }
  const result = spawnSync('pnpm', ['build-switch', on ? 'on' : 'off'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`build-switch ${on ? 'on' : 'off'} failed: ${result.stderr.slice(-300)}`);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function uniquePng(size = 32): { buffer: Buffer; sha256: string } {
  const [r, g, b] = [0, 0, 0].map(() => Math.floor(Math.random() * 256)) as [number, number, number];
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).map((_, i) => [r, g, b][i % 3] as number)]);
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return { buffer, sha256: createHash('sha256').update(buffer).digest('hex') };
}

export function writeEvidence(data: unknown): string {
  const dir = resolve(root, 'tests/e2e/results');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `e2e-evidence-${target}.json`);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

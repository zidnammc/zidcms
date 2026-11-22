import { encode } from '@auth/core/jwt';

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

export type AdminApi = <T>(method: string, path: string, data?: unknown) => Promise<T>;

export async function adminApi(): Promise<AdminApi> {
  const admin = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');
  const email = (process.env.ADMIN_EMAILS ?? '').split(',')[0]?.trim() ?? '';
  const secret = process.env.AUTH_SECRET ?? '';
  if (!admin || !email || secret.length < 32) throw new Error('ADMIN_URL, ADMIN_EMAILS and AUTH_SECRET are required');
  const name = `${admin.startsWith('https:') ? '__Secure-' : ''}authjs.session-token`;
  const cookie = `${name}=${await encode({ token: { name: email, email, sub: email }, secret, salt: name, maxAge: 3600 })}`;
  return async <T>(method: string, path: string, data?: unknown): Promise<T> => {
    const res = await fetch(`${admin}${path}`, {
      method,
      headers: { cookie, origin: admin, ...(data ? { 'content-type': 'application/json' } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  };
}

export async function waitForJob(
  api: AdminApi,
  jobId: string,
  log: (line: string) => void = () => {},
  timeoutMs = 20 * 60_000,
): Promise<{ job: Job; timeline: { state: string; atMs: number }[]; totalMs: number }> {
  const t0 = Date.now();
  const timeline: { state: string; atMs: number }[] = [];
  for (;;) {
    const { job } = await api<{ job: Job }>('GET', `/api/publish/${jobId}`);
    if (timeline.at(-1)?.state !== job.state) {
      timeline.push({ state: job.state, atMs: Date.now() - t0 });
      log(`  ${((Date.now() - t0) / 1000).toFixed(1)} s ${job.state} ${job.deploy_detail ?? ''}`);
    }
    if (job.state === 'live' || job.state === 'failed') return { job, timeline, totalMs: Date.now() - t0 };
    if (Date.now() - t0 > timeoutMs) throw new Error(`job ${jobId} did not finish`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

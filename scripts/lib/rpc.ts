import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { type RpcEnvelope, type RpcResponse, signEnvelope } from '../../packages/core/src/index';

const envFile = resolve(import.meta.dirname, '../../apps/admin/.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const GAS_URL = process.env.GAS_WEBAPP_URL ?? '';
export const SECRET = process.env.GAS_HMAC_SECRET ?? '';
export const ACTOR = process.env.SCRIPT_ACTOR ?? 'script@example.com';

if (!GAS_URL || SECRET.length < 32) {
  console.error('Set GAS_WEBAPP_URL and GAS_HMAC_SECRET (>= 32 chars) in apps/admin/.env.local or the environment.');
  process.exit(1);
}

export function envelope(action: string, payload: unknown, overrides: Partial<RpcEnvelope> = {}): RpcEnvelope {
  return {
    v: 1,
    action,
    payload,
    ts: Date.now(),
    nonce: randomBytes(16).toString('base64url'),
    actor: ACTOR,
    requestId: randomUUID(),
    ...overrides,
  };
}

export const sign = (message: string, secret = SECRET) =>
  createHmac('sha256', Buffer.from(secret, 'utf8')).update(message, 'utf8').digest('hex');

export async function post(
  body: string,
): Promise<{ status: number; ms: number; json: RpcResponse | null; text: string }> {
  const started = Date.now();
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    redirect: 'follow',
  });
  const text = await res.text();
  let json: RpcResponse | null = null;
  try {
    json = JSON.parse(text) as RpcResponse;
  } catch {}
  return { status: res.status, ms: Date.now() - started, json, text };
}

export async function call<T = unknown>(action: string, payload: unknown = {}): Promise<T> {
  const res = await post(signEnvelope(envelope(action, payload), (m) => sign(m)));
  if (!res.json) throw new Error(`Non-JSON response (${res.status}): ${res.text.slice(0, 200)}`);
  if (!res.json.ok) throw new Error(`${action} → ${res.json.error.code}: ${res.json.error.message}`);
  return res.json.data as T;
}

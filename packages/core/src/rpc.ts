import { ERROR_HTTP, type ErrorCode } from './errors';
import { LIMITS } from './limits';
import { isEmail } from './validate';

export const RPC_ACTIONS = [
  'system.health',
  'system.setup',
  'system.summary',
  'posts.list',
  'posts.get',
  'posts.create',
  'posts.update',
  'posts.setStatus',
  'posts.softDelete',
  'posts.restore',
  'posts.revisions',
  'pages.list',
  'pages.get',
  'pages.create',
  'pages.update',
  'pages.setStatus',
  'pages.softDelete',
  'pages.restore',
  'pages.revisions',
  'taxonomy.list',
  'taxonomy.create',
  'taxonomy.update',
  'taxonomy.softDelete',
  'media.upload',
  'media.list',
  'media.update',
  'media.getBytes',
  'settings.get',
  'settings.update',
  'publish.acquire',
  'publish.getJob',
  'publish.listJobs',
  'publish.updateJob',
  'publish.claimStep',
  'publish.readPublished',
  'snapshots.record',
  'snapshots.list',
  'snapshots.get',
  'snapshots.setStatus',
  'audit.list',
  'editor.context',
] as const;

export type RpcAction = (typeof RPC_ACTIONS)[number];

export interface RpcEnvelope {
  v: 1;
  action: string;
  payload: unknown;
  ts: number;
  nonce: string;
  actor: string;
  requestId: string;
}

export interface RpcRequestBody {
  e: string;
  s: string;
}

export interface RpcErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export type RpcResponse<T = unknown> =
  | { ok: true; data: T; requestId: string; ms: number }
  | { ok: false; error: RpcErrorBody; requestId: string };

export type HmacHex = (message: string) => string;

export function signEnvelope(envelope: RpcEnvelope, hmacHex: HmacHex): string {
  const e = JSON.stringify(envelope);
  const body: RpcRequestBody = { e, s: hmacHex(e) };
  return JSON.stringify(body);
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifyDeps {
  hmacHex: HmacHex;
  now: () => number;
  nonceSeen: (nonce: string) => boolean;
  rememberNonce: (nonce: string) => void;
  isActionEnabled: (action: string) => boolean;
}

export type VerifyResult =
  | { ok: true; envelope: RpcEnvelope }
  | { ok: false; code: ErrorCode; reason: string; requestId: string };

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function verifyRequest(raw: string, deps: VerifyDeps): VerifyResult {
  const reject = (code: ErrorCode, reason: string, requestId = ''): VerifyResult => ({
    ok: false,
    code,
    reason,
    requestId,
  });
  if (raw.length > LIMITS.RPC_BODY_BYTES) return reject('PAYLOAD_TOO_LARGE', 'body too large');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reject('BAD_REQUEST', 'body is not JSON');
  }
  const { e, s } = (body ?? {}) as Partial<RpcRequestBody>;
  if (typeof e !== 'string' || typeof s !== 'string') return reject('BAD_REQUEST', 'missing e/s');
  if (!/^[0-9a-f]{64}$/.test(s) || !timingSafeEqualHex(deps.hmacHex(e), s)) {
    return reject('SIGNATURE_INVALID', 'signature mismatch');
  }
  let envelope: RpcEnvelope;
  try {
    envelope = JSON.parse(e) as RpcEnvelope;
  } catch {
    return reject('BAD_REQUEST', 'envelope is not JSON');
  }
  const requestId = typeof envelope.requestId === 'string' ? envelope.requestId.slice(0, 64) : '';
  if (envelope.v !== 1 || typeof envelope.ts !== 'number') {
    return reject('BAD_REQUEST', 'bad envelope version', requestId);
  }
  if (Math.abs(deps.now() - envelope.ts) > LIMITS.RPC_WINDOW_MS) {
    return reject('REQUEST_EXPIRED', 'timestamp outside window', requestId);
  }
  if (typeof envelope.nonce !== 'string' || !NONCE_PATTERN.test(envelope.nonce)) {
    return reject('BAD_REQUEST', 'bad nonce', requestId);
  }
  if (deps.nonceSeen(envelope.nonce)) return reject('REPLAY_DETECTED', 'nonce reused', requestId);
  deps.rememberNonce(envelope.nonce);
  if (typeof envelope.action !== 'string' || !deps.isActionEnabled(envelope.action)) {
    return reject('UNKNOWN_ACTION', 'action not allowed', requestId);
  }
  if (!isEmail(envelope.actor)) return reject('BAD_REQUEST', 'bad actor', requestId);
  return { ok: true, envelope };
}

export function isRpcAction(action: string): action is RpcAction {
  return (RPC_ACTIONS as readonly string[]).includes(action);
}

export function rpcError(code: ErrorCode, message: string, details?: Record<string, unknown>): RpcErrorBody {
  return { code, message, ...(details ? { details } : {}), retryable: ERROR_HTTP[code].retryable };
}

import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { isErrorCode, type RpcAction, type RpcEnvelope, type RpcResponse, signEnvelope, ZidError } from '@zidcms/core';
import { env } from './env';
import { log } from './log';

const READ_ACTIONS = new Set<RpcAction>([
  'system.health',
  'system.summary',
  'posts.list',
  'posts.get',
  'posts.revisions',
  'pages.list',
  'pages.get',
  'pages.revisions',
  'taxonomy.list',
  'media.list',
  'media.getBytes',
  'settings.get',
  'publish.getJob',
  'publish.listJobs',
  'publish.readPublished',
  'snapshots.list',
  'snapshots.get',
  'audit.list',
]);

export interface CallContext {
  actor: string;
  requestId?: string;
}

export interface GasTransport {
  url: string;
  secret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

function transport(): GasTransport {
  return { url: env.gasUrl(), secret: env.gasSecret() };
}

async function once<T>(action: RpcAction, payload: unknown, ctx: CallContext, t: GasTransport): Promise<T> {
  const envelope: RpcEnvelope = {
    v: 1,
    action,
    payload,
    ts: Date.now(),
    nonce: randomBytes(16).toString('base64url'),
    actor: ctx.actor,
    requestId: ctx.requestId ?? randomUUID(),
  };
  const body = signEnvelope(envelope, (m) =>
    createHmac('sha256', Buffer.from(t.secret, 'utf8')).update(m, 'utf8').digest('hex'),
  );
  let response: Response;
  try {
    response = await (t.fetch ?? fetch)(t.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(t.timeoutMs ?? 30_000),
    });
  } catch (err) {
    throw new ZidError('UPSTREAM_ERROR', 'Apps Script tidak dapat dihubungi.', {
      cause: err instanceof Error ? err.name : 'unknown',
    });
  }
  const text = await response.text();
  let parsed: RpcResponse<T>;
  try {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    parsed = JSON.parse(text) as RpcResponse<T>;
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.ok !== 'boolean') throw new Error('shape');
  } catch {
    throw new ZidError('UPSTREAM_ERROR', 'Respons Apps Script tidak valid.', { status: response.status });
  }
  if (parsed.ok) return parsed.data;
  const code = isErrorCode(parsed.error.code) ? parsed.error.code : 'UPSTREAM_ERROR';
  if (['SIGNATURE_INVALID', 'REQUEST_EXPIRED', 'REPLAY_DETECTED', 'UNKNOWN_ACTION'].includes(code)) {
    log('error', 'gas_security_rejection', { action, code, requestId: envelope.requestId });
  }
  throw new ZidError(code, parsed.error.message, parsed.error.details);
}

export async function gas<T = unknown>(
  action: RpcAction,
  payload: unknown,
  ctx: CallContext,
  t: GasTransport = transport(),
): Promise<T> {
  const retries = READ_ACTIONS.has(action) ? 2 : 0;
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await once<T>(action, payload, ctx, t);
      log('debug', 'gas_call', { action, ms: Date.now() - started, attempt, requestId: ctx.requestId });
      return result;
    } catch (err) {
      const retryable = err instanceof ZidError && err.retryable;
      if (!retryable || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt + Math.random() * 250));
    }
  }
}

import { type RpcResponse, rpcError, verifyRequest, ZidError } from '@zidcms/core';
import { contentActions } from './actions/content';
import { editorActions } from './actions/editor';
import { mediaActions } from './actions/media';
import { publishActions, snapshotActions } from './actions/publish';
import { settingsActions } from './actions/settings';
import { systemActions } from './actions/system';
import { taxonomyActions } from './actions/taxonomy';
import type { Ctx, GasDeps } from './ports';
import { audit } from './table';

export interface ActionDef {
  lock: boolean;
  run(ctx: Ctx, payload: unknown): unknown;
}

export const ACTIONS: Record<string, ActionDef> = {
  ...systemActions,
  ...contentActions('post'),
  ...contentActions('page'),
  ...taxonomyActions,
  ...editorActions,
  ...mediaActions,
  ...settingsActions,
  ...publishActions,
  ...snapshotActions,
};

const MIN_SECRET_LENGTH = 32;

export function handleRpc(raw: string, deps: GasDeps): RpcResponse {
  const started = deps.runtime.now();
  const secret = deps.props.get('HMAC_SECRET') ?? '';
  const environment = deps.props.get('ENVIRONMENT') ?? 'dev';
  if (secret.length < MIN_SECRET_LENGTH) {
    deps.runtime.log({ level: 'error', msg: 'hmac_secret_missing_or_short' });
    return { ok: false, error: rpcError('SIGNATURE_INVALID', 'Permintaan ditolak.'), requestId: '' };
  }
  const verified = verifyRequest(raw, {
    hmacHex: (m) => deps.runtime.hmacHex(secret, m),
    now: () => deps.runtime.now(),
    nonceSeen: (n) => deps.nonces.seen(n),
    rememberNonce: (n) => deps.nonces.remember(n, 600),
    isActionEnabled: (action) => Object.hasOwn(ACTIONS, action),
  });
  if (!verified.ok) {
    deps.runtime.log({
      level: 'warn',
      msg: 'rpc_rejected',
      code: verified.code,
      reason: verified.reason,
      requestId: verified.requestId,
    });
    return { ok: false, error: rpcError(verified.code, 'Permintaan ditolak.'), requestId: verified.requestId };
  }
  const { envelope } = verified;
  const action = ACTIONS[envelope.action] as ActionDef;
  const ctx: Ctx = {
    ...deps,
    actor: envelope.actor.toLowerCase(),
    requestId: envelope.requestId,
    environment,
    nowIso: new Date(started).toISOString(),
  };
  try {
    const data = action.lock
      ? deps.lock.withLock(() => {
          ctx.nowIso = new Date(deps.runtime.now()).toISOString();
          return action.run(ctx, envelope.payload);
        })
      : action.run(ctx, envelope.payload);
    return { ok: true, data, requestId: envelope.requestId, ms: deps.runtime.now() - started };
  } catch (err) {
    const zid = err instanceof ZidError ? err : null;
    const code = zid?.code ?? 'INTERNAL_ERROR';
    deps.runtime.log({
      level: zid ? 'info' : 'error',
      msg: 'rpc_failed',
      action: envelope.action,
      code,
      requestId: envelope.requestId,
      ...(zid ? {} : { error: err instanceof Error ? err.message.slice(0, 300) : 'unknown' }),
    });
    if (action.lock && code !== 'LOCK_TIMEOUT') {
      safeAudit(ctx, envelope.action, idOf(envelope.payload), code);
    }
    return {
      ok: false,
      error: rpcError(code, zid?.message ?? 'Terjadi kesalahan internal pada Apps Script.', zid?.details),
      requestId: envelope.requestId,
    };
  }
}

function idOf(payload: unknown): string {
  const id = (payload as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id.slice(0, 64) : '';
}

function safeAudit(ctx: Ctx, action: string, entityId: string, code: string): void {
  try {
    audit(ctx, action, action.split('.')[0] ?? 'system', entityId, code);
  } catch (err) {
    ctx.runtime.log({ level: 'warn', msg: 'audit_failed', action, error: String(err).slice(0, 200) });
  }
}

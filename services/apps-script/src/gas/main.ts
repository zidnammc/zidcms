import { ACTIONS, handleRpc } from '../dispatcher';
import type { Ctx } from '../ports';
import { gasDeps } from './adapters';

function json(body: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return json(handleRpc(e?.postData?.contents ?? '', gasDeps()));
}

export function doGet(): GoogleAppsScript.Content.TextOutput {
  return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Gunakan POST.', retryable: false }, requestId: '' });
}

export function setup(): unknown {
  const deps = gasDeps();
  const ctx: Ctx = {
    ...deps,
    actor: 'script-editor@localhost.invalid',
    requestId: deps.runtime.uuid(),
    environment: deps.props.get('ENVIRONMENT') ?? 'dev',
    nowIso: new Date().toISOString(),
  };
  const result = deps.lock.withLock(() => ACTIONS['system.setup']!.run(ctx, {}));
  console.log(JSON.stringify(result));
  return result;
}

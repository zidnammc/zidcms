import { type RpcResponse, signEnvelope } from '../../packages/core/src/index';
import { call, envelope, post, sign } from './rpc';

export type CheckResult = boolean | 'skip';

export interface Check {
  id: string;
  name: string;
  run: () => Promise<CheckResult>;
}

export interface Outcome {
  ok: boolean;
  code: string | null;
  data: unknown;
  ms: number;
}

export async function attempt(action: string, payload: unknown = {}): Promise<Outcome> {
  const res = await post(signEnvelope(envelope(action, payload), (m) => sign(m)));
  const json = res.json as RpcResponse | null;
  if (!json) return { ok: false, code: `HTTP_${res.status}`, data: res.text.slice(0, 200), ms: res.ms };
  return json.ok
    ? { ok: true, code: null, data: json.data, ms: res.ms }
    : { ok: false, code: json.error.code, data: json.error, ms: res.ms };
}

export const note = (text: string) => console.log(`    → ${text}`);

const rejected = (code: string) => async (body: string) => {
  const res = await post(body);
  const ok = res.json?.ok === false && res.json.error.code === code;
  note(`HTTP ${res.status} ${res.ms} ms ${res.json ? JSON.stringify(res.json).slice(0, 140) : res.text.slice(0, 80)}`);
  return ok;
};

export async function protocolChecks(): Promise<Check[]> {
  const before = await call<{ row_counts: Record<string, number> }>('system.health');
  const replayBody = signEnvelope(envelope('system.health', {}), (m) => sign(m));
  const tampered = (() => {
    const body = JSON.parse(signEnvelope(envelope('system.health', {}), (m) => sign(m))) as { e: string; s: string };
    return JSON.stringify({ e: body.e.replace('system.health', 'posts.create'), s: body.s });
  })();

  return [
    {
      id: 'TC-GAS-01',
      name: 'valid signed call succeeds',
      run: async () => {
        const res = await post(signEnvelope(envelope('system.health', {}), (m) => sign(m)));
        note(
          `HTTP ${res.status} ${res.ms} ms env=${(res.json as { data?: { environment?: string } })?.data?.environment}`,
        );
        return res.json?.ok === true;
      },
    },
    {
      id: 'TC-GAS-02',
      name: 'missing / invalid signature rejected',
      run: async () =>
        (await rejected('BAD_REQUEST')(JSON.stringify({ e: JSON.stringify(envelope('system.health', {})) }))) &&
        (await rejected('SIGNATURE_INVALID')(
          signEnvelope(envelope('system.health', {}), (m) => sign(m, 'wrong-secret-wrong-secret-wrong-secret')),
        )),
    },
    { id: 'TC-GAS-03', name: 'tampered envelope rejected', run: () => rejected('SIGNATURE_INVALID')(tampered) },
    {
      id: 'TC-GAS-04',
      name: 'expired timestamp rejected',
      run: () =>
        rejected('REQUEST_EXPIRED')(
          signEnvelope(envelope('system.health', {}, { ts: Date.now() - 400_000 }), (m) => sign(m)),
        ),
    },
    {
      id: 'TC-GAS-05',
      name: 'replayed nonce rejected',
      run: async () => (await post(replayBody)).json?.ok === true && rejected('REPLAY_DETECTED')(replayBody),
    },
    {
      id: 'TC-GAS-06',
      name: 'unknown action rejected',
      run: () => rejected('UNKNOWN_ACTION')(signEnvelope(envelope('system.dropEverything', {}), (m) => sign(m))),
    },
    {
      id: 'TC-GAS-07',
      name: 'oversize body rejected',
      run: () =>
        rejected('PAYLOAD_TOO_LARGE')(
          signEnvelope(envelope('system.health', { pad: 'x'.repeat(5_300_000) }), (m) => sign(m)),
        ),
    },
    {
      id: 'TC-GAS-08',
      name: 'sheet unchanged after rejected requests',
      run: async () => {
        const after = await call<{ row_counts: Record<string, number> }>('system.health');
        const strip = (c: Record<string, number>) => JSON.stringify({ ...c, AuditLog: 0 });
        return strip(after.row_counts) === strip(before.row_counts);
      },
    },
  ];
}

export async function runChecks(checks: Check[]): Promise<{ id: string; name: string; result: string; ms: number }[]> {
  const results: { id: string; name: string; result: string; ms: number }[] = [];
  for (const check of checks) {
    console.log(`  ${check.id} ${check.name}`);
    const started = Date.now();
    const outcome = await check.run().catch((err: unknown) => {
      note(`error ${err instanceof Error ? err.message : err}`);
      return false as const;
    });
    const result = outcome === 'skip' ? 'SKIP' : outcome ? 'PASS' : 'FAIL';
    console.log(`    ${result}`);
    results.push({ id: check.id, name: check.name, result, ms: Date.now() - started });
  }
  return results;
}

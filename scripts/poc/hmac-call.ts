import { signEnvelope } from '../../packages/core/src/index';
import { call, envelope, GAS_URL, post, sign } from '../lib/rpc';

type Check = { id: string; name: string; run: () => Promise<boolean> };

const rejected = (code: string) => async (body: string) => {
  const res = await post(body);
  const ok = res.json?.ok === false && res.json.error.code === code;
  console.log(
    `    → HTTP ${res.status} ${res.ms} ms ${res.json ? JSON.stringify(res.json).slice(0, 140) : res.text.slice(0, 80)}`,
  );
  return ok;
};

async function main() {
  const host = new URL(GAS_URL).host;
  console.log(`PoC-1 against ${host} (URL path redacted)`);
  const action = process.argv[2];
  if (action) {
    console.log(JSON.stringify(await call(action, JSON.parse(process.argv[3] ?? '{}')), null, 2));
    return;
  }

  const before = await call<{ row_counts: Record<string, number> }>('system.health');
  const replayBody = signEnvelope(envelope('system.health', {}), (m) => sign(m));
  const tampered = (() => {
    const body = JSON.parse(signEnvelope(envelope('system.health', {}), (m) => sign(m))) as { e: string; s: string };
    return JSON.stringify({ e: body.e.replace('system.health', 'posts.create'), s: body.s });
  })();

  const checks: Check[] = [
    {
      id: 'TC-GAS-01',
      name: 'valid signed call succeeds',
      run: async () => {
        const res = await post(signEnvelope(envelope('system.health', {}), (m) => sign(m)));
        console.log(
          `    → HTTP ${res.status} ${res.ms} ms env=${(res.json as { data?: { environment?: string } })?.data?.environment}`,
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

  let failed = 0;
  for (const check of checks) {
    console.log(`  ${check.id} ${check.name}`);
    const ok = await check.run().catch((err: unknown) => {
      console.log(`    → error ${err instanceof Error ? err.message : err}`);
      return false;
    });
    console.log(`    ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) failed += 1;
  }
  console.log(failed ? `PoC-1: ${failed} check(s) FAILED` : 'PoC-1: all checks PASSED');
  process.exit(failed ? 1 : 0);
}

void main();

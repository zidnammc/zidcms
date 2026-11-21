import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type RpcEnvelope, signEnvelope, type VerifyDeps, verifyRequest } from './rpc';
import vectors from './rpc.vectors.json';

const SECRET = vectors.secret;
const hmacHex = (m: string) => createHmac('sha256', Buffer.from(SECRET, 'utf8')).update(m, 'utf8').digest('hex');
const NOW = 1_763_720_130_123;

function deps(overrides: Partial<VerifyDeps> = {}): VerifyDeps & { nonces: Set<string> } {
  const nonces = new Set<string>();
  return {
    nonces,
    hmacHex,
    now: () => NOW,
    nonceSeen: (n) => nonces.has(n),
    rememberNonce: (n) => nonces.add(n),
    isActionEnabled: (a) => a === 'system.health' || a === 'posts.create',
    ...overrides,
  };
}

function envelope(overrides: Partial<RpcEnvelope> = {}): RpcEnvelope {
  return {
    v: 1,
    action: 'system.health',
    payload: {},
    ts: NOW,
    nonce: 'b64url-nonce-0123456789',
    actor: 'admin@example.com',
    requestId: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  };
}

describe('HMAC test vectors (shared with GAS)', () => {
  it.each(vectors.vectors)('signature matches vector %#', ({ e, s }) => {
    expect(hmacHex(e)).toBe(s);
  });
});

describe('verifyRequest', () => {
  it('TC-GAS-01 accepts a valid signed call', () => {
    const result = verifyRequest(signEnvelope(envelope(), hmacHex), deps());
    expect(result.ok).toBe(true);
  });

  it('TC-GAS-02 rejects missing and invalid signatures', () => {
    const e = JSON.stringify(envelope());
    expect(verifyRequest(JSON.stringify({ e }), deps())).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    expect(verifyRequest(JSON.stringify({ e, s: '0'.repeat(64) }), deps())).toMatchObject({
      ok: false,
      code: 'SIGNATURE_INVALID',
    });
    const wrongKey = createHmac('sha256', 'other').update(e).digest('hex');
    expect(verifyRequest(JSON.stringify({ e, s: wrongKey }), deps())).toMatchObject({
      code: 'SIGNATURE_INVALID',
    });
  });

  it('TC-GAS-03 rejects a tampered envelope', () => {
    const body = JSON.parse(signEnvelope(envelope(), hmacHex)) as { e: string; s: string };
    body.e = body.e.replace('system.health', 'posts.create');
    expect(verifyRequest(JSON.stringify(body), deps())).toMatchObject({ code: 'SIGNATURE_INVALID' });
  });

  it('TC-GAS-04 rejects an expired timestamp', () => {
    const raw = signEnvelope(envelope({ ts: NOW - 300_001 }), hmacHex);
    expect(verifyRequest(raw, deps())).toMatchObject({ code: 'REQUEST_EXPIRED' });
    const future = signEnvelope(envelope({ ts: NOW + 300_001 }), hmacHex);
    expect(verifyRequest(future, deps())).toMatchObject({ code: 'REQUEST_EXPIRED' });
  });

  it('TC-GAS-05 rejects a replayed nonce', () => {
    const d = deps();
    const raw = signEnvelope(envelope(), hmacHex);
    expect(verifyRequest(raw, d).ok).toBe(true);
    expect(verifyRequest(raw, d)).toMatchObject({ code: 'REPLAY_DETECTED' });
  });

  it('TC-GAS-06 rejects unknown actions', () => {
    const raw = signEnvelope(envelope({ action: 'system.dropEverything' }), hmacHex);
    expect(verifyRequest(raw, deps())).toMatchObject({ code: 'UNKNOWN_ACTION' });
  });

  it('TC-GAS-07 rejects an oversize body', () => {
    const raw = signEnvelope(envelope({ payload: { x: 'a'.repeat(5 * 1024 * 1024) } }), hmacHex);
    expect(verifyRequest(raw, deps())).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('rejects non-JSON bodies and invalid actors', () => {
    expect(verifyRequest('<html>', deps())).toMatchObject({ code: 'BAD_REQUEST' });
    const raw = signEnvelope(envelope({ actor: 'not-an-email' }), hmacHex);
    expect(verifyRequest(raw, deps())).toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('does not consume the nonce when the signature is invalid', () => {
    const d = deps();
    const e = JSON.stringify(envelope());
    verifyRequest(JSON.stringify({ e, s: 'f'.repeat(64) }), d);
    expect(d.nonces.size).toBe(0);
  });
});

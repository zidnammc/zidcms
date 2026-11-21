import { call } from '../lib/rpc';
import { ROUND_TRIP_SAMPLES as SAMPLES } from '../lib/samples';

async function main() {
  let failed = 0;
  const stamp = Date.now().toString(36);
  for (const [i, value] of SAMPLES.entries()) {
    const created = await call<{ id: string }>('posts.create', {
      title: `PoC-4 ${stamp} ${i}`,
      slug: `poc4-${stamp}-${i}`,
      excerpt: value,
      content_markdown: value,
    });
    const read = await call<{ id: string; version: number; excerpt: string; content_markdown: string }>('posts.get', {
      id: created.id,
    });
    const ok = read.excerpt === value && read.content_markdown === value;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(value)} → ${JSON.stringify(read.excerpt)}`);
    if (!ok) failed += 1;
    await call('posts.softDelete', { id: created.id, expected_version: read.version });
  }
  const health = await call<{ invalid_row_count: number }>('system.health');
  console.log(`invalid rows after test: ${health.invalid_row_count}`);
  console.log(failed ? `PoC-4: ${failed} FAILED` : 'PoC-4: all values round-tripped unchanged (TC-DATA-01/02/03)');
  process.exit(failed ? 1 : 0);
}

void main();

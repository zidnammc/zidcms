import { protocolChecks, runChecks } from '../lib/gas-checks';
import { call, GAS_URL } from '../lib/rpc';

async function main() {
  console.log(`PoC-1 against ${new URL(GAS_URL).host} (URL path redacted)`);
  const action = process.argv[2];
  if (action) {
    console.log(JSON.stringify(await call(action, JSON.parse(process.argv[3] ?? '{}')), null, 2));
    return;
  }
  const failed = (await runChecks(await protocolChecks())).filter((r) => r.result === 'FAIL').length;
  console.log(failed ? `PoC-1: ${failed} check(s) FAILED` : 'PoC-1: all checks PASSED');
  process.exit(failed ? 1 : 0);
}

void main();

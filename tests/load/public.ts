import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Agent, request } from 'node:https';
import { cpus, platform, release } from 'node:os';
import { resolve } from 'node:path';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? (process.argv[i + 1] as string) : fallback;
};

const SITE = arg('site', process.env.PUBLIC_SITE_URL ?? 'https://zidcms-web.vercel.app').replace(/\/+$/, '');
const LEVELS = arg('vus', '1,10,50,100')
  .split(',')
  .map(Number)
  .filter((n) => n > 0 && n <= 100);
const DURATION_S = Number(arg('duration', '60'));
const WARMUP_S = Number(arg('warmup', '10'));
const MONTHLY_BUDGET = Number(arg('budget-gb', '5')) * 1024 ** 3;
const RUN_BUDGET = Number(arg('run-budget-gb', '2')) * 1024 ** 3;
const NETWORK = arg('network', 'unspecified');
const resultsDir = resolve(import.meta.dirname, 'results');

interface Sample {
  path: string;
  ms: number;
  status: number;
  cache: string;
  bytes: number;
}

function monthBytesUsed(): number {
  if (!existsSync(resultsDir)) return 0;
  const month = new Date().toISOString().slice(0, 7);
  let total = 0;
  for (const file of readdirSync(resultsDir)) {
    if (!file.startsWith(`public-${month}`) || !file.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(resolve(resultsDir, file), 'utf8')) as { totalBytes?: number };
    total += data.totalBytes ?? 0;
  }
  return total;
}

function get(agent: Agent, path: string): Promise<Sample> {
  const started = performance.now();
  return new Promise((done) => {
    const req = request(
      `${SITE}${path}`,
      { agent, headers: { 'accept-encoding': 'br, gzip', 'user-agent': 'zidcms-benchmark/0.1 (+plan §21)' } },
      (res) => {
        let bytes = 0;
        res.on('data', (c: Buffer) => {
          bytes += c.length;
        });
        res.on('end', () =>
          done({
            path,
            ms: performance.now() - started,
            status: res.statusCode ?? 0,
            cache: String(res.headers['x-vercel-cache'] ?? 'none'),
            bytes,
          }),
        );
      },
    );
    req.setTimeout(30_000, () => req.destroy(new Error('timeout')));
    req.on('error', () => done({ path, ms: performance.now() - started, status: 0, cache: 'error', bytes: 0 }));
    req.end();
  });
}

const pct = (sorted: number[], p: number) =>
  sorted.length ? (sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] as number) : 0;

function summarize(samples: Sample[], seconds: number) {
  const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
  const count = (key: (s: Sample) => string) =>
    samples.reduce<Record<string, number>>((acc, s) => {
      acc[key(s)] = (acc[key(s)] ?? 0) + 1;
      return acc;
    }, {});
  const errors = samples.filter((s) => s.status < 200 || s.status >= 400).length;
  return {
    requests: samples.length,
    rps: Math.round((samples.length / seconds) * 10) / 10,
    p50: Math.round(pct(ms, 50)),
    p95: Math.round(pct(ms, 95)),
    p99: Math.round(pct(ms, 99)),
    max: Math.round(ms.at(-1) ?? 0),
    errorRate: samples.length ? Math.round((errors / samples.length) * 10000) / 100 : 0,
    status: count((s) => String(s.status)),
    cache: count((s) => s.cache),
    bytes: samples.reduce((a, s) => a + s.bytes, 0),
    perPath: Object.fromEntries(
      [...new Set(samples.map((s) => s.path))].map((p) => {
        const sub = samples
          .filter((s) => s.path === p)
          .map((s) => s.ms)
          .sort((a, b) => a - b);
        return [p, { requests: sub.length, p50: Math.round(pct(sub, 50)), p95: Math.round(pct(sub, 95)) }];
      }),
    ),
  };
}

async function phase(vus: number, seconds: number, paths: string[], budgetLeft: () => number) {
  const agent = new Agent({ keepAlive: true, maxSockets: vus });
  const samples: Sample[] = [];
  const deadline = Date.now() + seconds * 1000;
  let stoppedForBudget = false;
  await Promise.all(
    Array.from({ length: vus }, async (_, v) => {
      let i = v;
      while (Date.now() < deadline) {
        if (budgetLeft() - samples.reduce((a, s) => a + s.bytes, 0) <= 0) {
          stoppedForBudget = true;
          return;
        }
        samples.push(await get(agent, paths[i % paths.length] as string));
        i += 1;
      }
    }),
  );
  agent.destroy();
  return { samples, stoppedForBudget };
}

async function discoverPaths(): Promise<string[]> {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] as string).pathname);
  const post = locs.find((p) => p.startsWith('/blog/'));
  const page = locs.find((p) => p !== '/' && !/^\/(blog|category|tag|page)\//.test(p));
  return ['/', post, page, '/zidcms-version.json'].filter((p): p is string => Boolean(p));
}

async function main() {
  const paths = await discoverPaths();
  const used = monthBytesUsed();
  const started = new Date();
  console.log(`Public load test against ${SITE}`);
  console.log(`paths: ${paths.join(', ')}; levels ${LEVELS.join('/')} VU × ${DURATION_S}s (+${WARMUP_S}s warm-up)`);
  console.log(
    `transfer used this month: ${(used / 1024 ** 2).toFixed(1)} MiB of ${(MONTHLY_BUDGET / 1024 ** 3).toFixed(1)} GiB`,
  );
  let runBytes = 0;
  let lastRps = 0;
  let lastAvgBytes = 0;
  const levels = [];
  for (const vus of LEVELS) {
    const budgetLeft = () => Math.min(RUN_BUDGET - runBytes, MONTHLY_BUDGET - used - runBytes);
    if (lastRps) {
      const estimate = lastRps * (vus / Math.max(1, levels.at(-1)?.vus ?? 1)) * lastAvgBytes * (DURATION_S + WARMUP_S);
      console.log(
        `\n${vus} VU: estimated transfer ≤ ${(estimate / 1024 ** 2).toFixed(1)} MiB (budget left ${(budgetLeft() / 1024 ** 2).toFixed(0)} MiB)`,
      );
      if (estimate > budgetLeft()) {
        console.log('  skipped: estimate exceeds the remaining budget');
        levels.push({ vus, skipped: 'budget' });
        continue;
      }
    } else console.log(`\n${vus} VU`);
    const warm = await phase(vus, WARMUP_S, paths, budgetLeft);
    runBytes += warm.samples.reduce((a, s) => a + s.bytes, 0);
    const run = await phase(vus, DURATION_S, paths, budgetLeft);
    const summary = summarize(run.samples, DURATION_S);
    runBytes += summary.bytes;
    lastRps = summary.rps;
    lastAvgBytes = summary.requests ? summary.bytes / summary.requests : 0;
    console.log(
      `  ${summary.requests} req, ${summary.rps} rps, p50 ${summary.p50} ms, p95 ${summary.p95} ms, p99 ${summary.p99} ms, errors ${summary.errorRate}%, cache ${JSON.stringify(summary.cache)}, ${(summary.bytes / 1024 ** 2).toFixed(1)} MiB`,
    );
    levels.push({ vus, warmupRequests: warm.samples.length, stoppedForBudget: run.stoppedForBudget, ...summary });
    if (run.stoppedForBudget) {
      console.log('  stopped: transfer budget reached');
      break;
    }
  }
  mkdirSync(resultsDir, { recursive: true });
  const file = resolve(resultsDir, `public-${started.toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        site: SITE,
        startedAt: started.toISOString(),
        finishedAt: new Date().toISOString(),
        tester: {
          platform: `${platform()} ${release()}`,
          cpus: cpus().length,
          node: process.version,
          network: NETWORK,
        },
        method: { levels: LEVELS, durationS: DURATION_S, warmupS: WARMUP_S, closedLoop: true, thinkTimeMs: 0, paths },
        totalBytes: runBytes,
        levels,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\ntotal transfer this run: ${(runBytes / 1024 ** 2).toFixed(1)} MiB → ${file}`);
}

void main();

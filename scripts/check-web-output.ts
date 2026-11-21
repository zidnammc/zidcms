import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const out = resolve(import.meta.dirname, '../apps/web/out');
const required = ['index.html', '404.html', 'sitemap.xml', 'robots.txt', 'zidcms-version.json'];
const allowed = /\.(html|txt|json|xml|js|css|woff2?|ico|png|jpe?g|gif|webp|svg|map)$/;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

if (!existsSync(out)) {
  console.error('apps/web/out not found; run `pnpm --filter @zidcms/web build` first.');
  process.exit(1);
}
const problems: string[] = [];
for (const file of required) if (!existsSync(join(out, file))) problems.push(`missing ${file}`);
const files = walk(out);
for (const file of files) {
  const rel = relative(out, file).split(sep).join('/');
  if (!allowed.test(rel) && !rel.endsWith('.gitkeep')) problems.push(`unexpected file type: ${rel}`);
  if (/\.svg$/.test(rel) && rel.startsWith('media/')) problems.push(`SVG in published media: ${rel}`);
}
const version = JSON.parse(readFileSync(join(out, 'zidcms-version.json'), 'utf8'));
if (typeof version.version !== 'number' || !String(version.checksum).startsWith('sha256:'))
  problems.push('invalid zidcms-version.json');

console.log(`apps/web/out: ${files.length} static files, snapshot v${version.version}`);
if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('TC-WEB-02: static export only (no server functions, no route handlers).');

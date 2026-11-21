import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/gas/main.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'ZidCMS',
  target: 'es2019',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  outfile: 'dist/Code.js',
  legalComments: 'none',
  logLevel: 'warning',
});

const wrappers = ['doPost', 'doGet', 'setup']
  .map((name) => `function ${name}(e) { return ZidCMS.${name}(e); }`)
  .join('\n');
const code = readFileSync('dist/Code.js', 'utf8');
if (/node:|require\(/.test(code)) throw new Error('GAS bundle must not reference Node APIs');
writeFileSync('dist/Code.js', `${code}\n${wrappers}\n`);
copyFileSync('appsscript.json', 'dist/appsscript.json');
console.log(`dist/Code.js ${(statSync('dist/Code.js').size / 1024).toFixed(1)} KiB`);

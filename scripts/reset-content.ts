import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptySnapshot, versionFileOf } from '../packages/core/src/snapshot';

const web = resolve(import.meta.dirname, '../apps/web');
const snapshot = emptySnapshot();
mkdirSync(resolve(web, 'content'), { recursive: true });
mkdirSync(resolve(web, 'public/media'), { recursive: true });
writeFileSync(resolve(web, 'content/snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(resolve(web, 'public/zidcms-version.json'), `${JSON.stringify(versionFileOf(snapshot))}\n`);
for (const file of readdirSync(resolve(web, 'public/media'))) {
  if (file !== '.gitkeep') rmSync(resolve(web, 'public/media', file));
}
console.log('apps/web content reset to empty snapshot v0');

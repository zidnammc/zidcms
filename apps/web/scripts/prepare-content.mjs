import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = (process.env.ZIDCMS_ENV ?? '').trim().toLowerCase();
const generated = {
  snapshot: join(web, 'content/snapshot.json'),
  version: join(web, 'public/zidcms-version.json'),
  media: join(web, 'public/media'),
};

function activate(source) {
  for (const file of ['snapshot.json', 'zidcms-version.json']) {
    if (!existsSync(join(source, file))) {
      console.error(`prepare-content: ${join(source, file)} is missing`);
      process.exit(1);
    }
  }
  copyFileSync(join(source, 'snapshot.json'), generated.snapshot);
  mkdirSync(dirname(generated.version), { recursive: true });
  copyFileSync(join(source, 'zidcms-version.json'), generated.version);
  rmSync(generated.media, { recursive: true, force: true });
  mkdirSync(generated.media, { recursive: true });
  const mediaSource = join(source, 'media');
  const files = existsSync(mediaSource) ? readdirSync(mediaSource).filter((f) => f !== '.gitkeep') : [];
  for (const file of files) copyFileSync(join(mediaSource, file), join(generated.media, file));
  return files.length;
}

if (env === 'dev' || env === 'prod') {
  const count = activate(join(web, 'content', env));
  console.log(`prepare-content: using content/${env} (${count} media files)`);
} else if (process.env.VERCEL) {
  console.error('prepare-content: set ZIDCMS_ENV to "dev" or "prod" on the Vercel web project.');
  process.exit(1);
} else if (!existsSync(generated.snapshot) || !existsSync(generated.version)) {
  activate(join(web, 'content/empty'));
  console.log('prepare-content: no local content yet, using the empty snapshot');
} else {
  console.log('prepare-content: keeping the local snapshot (ZIDCMS_ENV not set)');
}

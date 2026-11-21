import { call } from './lib/rpc';

interface Item {
  id: string;
  version: number;
}

const category = await call<Item>('taxonomy.create', {
  kind: 'category',
  fields: { name: 'Panduan', description: 'Cara memakai ZidCMS.' },
}).catch(() => null);
const tag = await call<Item>('taxonomy.create', { kind: 'tag', fields: { name: 'Google Sheets' } }).catch(() => null);

const posts = [
  {
    title: 'Selamat datang di ZidCMS',
    content_markdown: [
      'ZidCMS menyimpan konten di **Google Sheets** dan menayangkannya sebagai situs statis.',
      '',
      '## Cara kerja',
      '',
      '1. Tulis artikel di dasbor admin.',
      '2. Klik **Terbitkan** — job publikasi membuat snapshot JSON.',
      '3. Snapshot di-commit ke Git, lalu Vercel membangun ulang situs.',
      '',
      '> Pembaca tidak pernah menyentuh Sheets, Apps Script, atau fungsi serverless.',
    ].join('\n'),
    excerpt: 'Pengantar singkat tentang alur Sheets → Git → CDN.',
  },
  {
    title: 'Menulis dengan Markdown',
    content_markdown: [
      'ZidCMS mendukung CommonMark + GFM:',
      '',
      '| Fitur | Didukung |',
      '|---|---|',
      '| Tabel | ya |',
      '| ~~Coret~~ | ya |',
      '| Daftar tugas | ya |',
      '',
      '- [x] Tulis draf',
      '- [ ] Terbitkan',
      '',
      'HTML mentah seperti `<script>` selalu di-escape.',
    ].join('\n'),
    excerpt: '',
  },
];

for (const post of posts) {
  const created = await call<Item>('posts.create', {
    ...post,
    ...(category ? { category_id: category.id } : {}),
    ...(tag ? { tag_ids: [tag.id] } : {}),
  });
  await call('posts.setStatus', { id: created.id, expected_version: created.version, to: 'published' });
  console.log(`post ${post.title} → ${created.id}`);
}

const page = await call<Item>('pages.create', {
  title: 'Tentang',
  content_markdown: 'Situs contoh yang dibangun dengan ZidCMS — CMS open-source berbasis spreadsheet.',
  nav_order: 1,
});
await call('pages.setStatus', { id: page.id, expected_version: page.version, to: 'published' });
console.log(`page Tentang → ${page.id}`);
console.log('Seed selesai. Buka dasbor lalu klik “Publikasikan Situs”.');

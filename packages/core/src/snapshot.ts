import type { MediaMime } from './limits';
import type { Media, Page, Post, SiteSettings, Taxon } from './schema/types';
import { sha256Hex } from './sha256';

export const SNAPSHOT_SCHEMA = 'zidcms.snapshot/1';

export interface SnapshotPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  markdown: string;
  authorName: string;
  publishedAt: string;
  updatedAt: string;
  category: { slug: string; name: string } | null;
  tags: { slug: string; name: string }[];
  cover: { src: string; alt: string; width: number | null; height: number | null } | null;
  seo: { title: string; description: string };
}

export interface SnapshotPage {
  id: string;
  slug: string;
  title: string;
  markdown: string;
  navOrder: number | null;
  updatedAt: string;
  seo: { title: string; description: string };
}

export interface SnapshotTaxon {
  slug: string;
  name: string;
  description: string;
}

export interface SnapshotMedia {
  sha256: string;
  path: string;
  mime: MediaMime;
}

export interface SnapshotSite {
  title: string;
  description: string;
  language: string;
  url: string;
  postsPerPage: number;
  footerText: string;
  socialImage: string | null;
  allowExternalImages: boolean;
}

export interface Snapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  version: number;
  basedOnVersion: number | null;
  generatedAt: string;
  checksum: string;
  site: SnapshotSite;
  posts: SnapshotPost[];
  pages: SnapshotPage[];
  categories: SnapshotTaxon[];
  tags: SnapshotTaxon[];
  media: SnapshotMedia[];
}

export interface VersionFile {
  version: number;
  checksum: string;
  generatedAt: string;
}

export interface PublishedData {
  posts: Post[];
  pages: Page[];
  categories: Taxon[];
  tags: Taxon[];
  media: Media[];
  settings: SiteSettings;
}

export interface BuildMeta {
  version: number;
  basedOnVersion: number | null;
  generatedAt: string;
  siteUrl: string;
}

export type BuildResult =
  | { ok: true; snapshot: Snapshot; media: Media[]; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export const DEFAULT_SETTINGS: SiteSettings = {
  site_title: 'ZidCMS Site',
  site_description: '',
  site_language: 'id',
  posts_per_page: 10,
  default_author_name: '',
  social_image_media_id: null,
  footer_text: '',
  allow_external_images: false,
};

export function extFromMime(mime: MediaMime): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
  }
}

export function mediaPath(media: Pick<Media, 'sha256' | 'mime_type'>): string {
  return `/media/${media.sha256}.${extFromMime(media.mime_type)}`;
}

export function deriveExcerpt(markdown: string, max = 180): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeChecksum(snapshot: Omit<Snapshot, 'checksum'> | Snapshot): string {
  const {
    version: _version,
    basedOnVersion: _basedOn,
    generatedAt: _generatedAt,
    checksum: _checksum,
    ...content
  } = snapshot as Snapshot;
  return `sha256:${sha256Hex(canonicalJson(content))}`;
}

export const MEDIA_REF_PATTERN = /!\[([^\]]*)\]\(\s*zid-media:([0-9a-fA-F-]{36})\s*\)/g;

export function extractMediaIds(markdown: string): string[] {
  return [...markdown.matchAll(MEDIA_REF_PATTERN)].map((m) => (m[2] as string).toLowerCase());
}

function compareStrings(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}

export function buildSnapshot(data: PublishedData, meta: BuildMeta): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const settings = { ...DEFAULT_SETTINGS, ...data.settings };
  const mediaById = new Map(data.media.filter((m) => !m.deleted_at).map((m) => [m.id, m]));
  const categories = new Map(data.categories.filter((c) => !c.deleted_at).map((c) => [c.id, c]));
  const tags = new Map(data.tags.filter((t) => !t.deleted_at).map((t) => [t.id, t]));
  const used = new Map<string, Media>();

  const useMedia = (id: string, label: string): Media | null => {
    const media = mediaById.get(id);
    if (!media) {
      errors.push(`${label} mereferensikan media yang tidak ada atau sudah dihapus (${id}).`);
      return null;
    }
    used.set(media.sha256, media);
    return media;
  };

  const rewrite = (markdown: string, label: string) =>
    markdown.replace(MEDIA_REF_PATTERN, (full, rawAlt: string, rawId: string) => {
      const media = useMedia(rawId.toLowerCase(), label);
      if (!media) return full;
      const alt = rawAlt.trim() || media.alt_text.trim();
      if (!alt) {
        warnings.push(`Gambar "${media.filename}" pada ${label} belum memiliki teks alternatif.`);
      }
      return `![${alt.replace(/[[\]]/g, '')}](${mediaPath(media)})`;
    });

  const posts: SnapshotPost[] = data.posts
    .filter((p) => p.status === 'published' && !p.deleted_at)
    .map((p): SnapshotPost => {
      const label = `Artikel "${p.title}"`;
      let cover: SnapshotPost['cover'] = null;
      if (p.cover_media_id) {
        const media = useMedia(p.cover_media_id, `Sampul ${label}`);
        if (media) {
          if (!media.alt_text.trim()) warnings.push(`Sampul ${label} belum memiliki teks alternatif.`);
          cover = {
            src: mediaPath(media),
            alt: media.alt_text.trim() || p.title,
            width: media.width,
            height: media.height,
          };
        }
      }
      const category = p.category_id ? categories.get(p.category_id) : undefined;
      if (p.category_id && !category) warnings.push(`${label}: kategori sudah dihapus dan diabaikan.`);
      const postTags = p.tag_ids
        .map((id) => tags.get(id))
        .filter((t): t is Taxon => Boolean(t))
        .map((t) => ({ slug: t.slug, name: t.name }))
        .sort((a, b) => compareStrings(a.slug, b.slug));
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt.trim() || deriveExcerpt(p.content_markdown),
        markdown: rewrite(p.content_markdown, label),
        authorName: p.author_name.trim() || settings.default_author_name.trim(),
        publishedAt: p.published_at ?? p.updated_at,
        updatedAt: p.updated_at,
        category: category ? { slug: category.slug, name: category.name } : null,
        tags: postTags,
        cover,
        seo: { title: p.seo_title, description: p.seo_description },
      };
    })
    .sort((a, b) =>
      a.publishedAt === b.publishedAt ? compareStrings(a.id, b.id) : compareStrings(b.publishedAt, a.publishedAt),
    );

  const pages: SnapshotPage[] = data.pages
    .filter((p) => p.status === 'published' && !p.deleted_at)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      markdown: rewrite(p.content_markdown, `Halaman "${p.title}"`),
      navOrder: p.nav_order,
      updatedAt: p.updated_at,
      seo: { title: p.seo_title, description: p.seo_description },
    }))
    .sort((a, b) => compareStrings(a.slug, b.slug));

  let socialImage: string | null = null;
  if (settings.social_image_media_id) {
    const media = useMedia(settings.social_image_media_id, 'Gambar sosial situs');
    if (media) socialImage = mediaPath(media);
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const toTaxon = (t: Taxon): SnapshotTaxon => ({
    slug: t.slug,
    name: t.name,
    description: t.description,
  });
  const usedMedia = [...used.values()].sort((a, b) => compareStrings(a.sha256, b.sha256));
  const base: Omit<Snapshot, 'checksum'> = {
    schema: SNAPSHOT_SCHEMA,
    version: meta.version,
    basedOnVersion: meta.basedOnVersion,
    generatedAt: meta.generatedAt,
    site: {
      title: settings.site_title,
      description: settings.site_description,
      language: settings.site_language,
      url: meta.siteUrl.replace(/\/+$/, ''),
      postsPerPage: settings.posts_per_page,
      footerText: settings.footer_text,
      socialImage,
      allowExternalImages: settings.allow_external_images,
    },
    posts,
    pages,
    categories: [...categories.values()].map(toTaxon).sort((a, b) => compareStrings(a.slug, b.slug)),
    tags: [...tags.values()].map(toTaxon).sort((a, b) => compareStrings(a.slug, b.slug)),
    media: usedMedia.map((m) => ({ sha256: m.sha256, path: mediaPath(m), mime: m.mime_type })),
  };
  const snapshot: Snapshot = { ...base, checksum: computeChecksum(base) };

  const leaks = findPrivateEmails(snapshot, collectActorEmails(data));
  if (leaks.length > 0) {
    return {
      ok: false,
      errors: leaks.map((path) => `Snapshot memuat alamat email admin pada ${path}; hapus sebelum publikasi.`),
      warnings,
    };
  }
  return { ok: true, snapshot, media: usedMedia, warnings };
}

export function restampSnapshot(
  snapshot: Snapshot,
  meta: { version: number; basedOnVersion: number | null; generatedAt: string },
): Snapshot {
  return { ...snapshot, ...meta };
}

export function versionFileOf(snapshot: Snapshot): VersionFile {
  return {
    version: snapshot.version,
    checksum: snapshot.checksum,
    generatedAt: snapshot.generatedAt,
  };
}

export function emptySnapshot(siteUrl = ''): Snapshot {
  const base: Omit<Snapshot, 'checksum'> = {
    schema: SNAPSHOT_SCHEMA,
    version: 0,
    basedOnVersion: null,
    generatedAt: '1970-01-01T00:00:00.000Z',
    site: {
      title: DEFAULT_SETTINGS.site_title,
      description: DEFAULT_SETTINGS.site_description,
      language: DEFAULT_SETTINGS.site_language,
      url: siteUrl,
      postsPerPage: DEFAULT_SETTINGS.posts_per_page,
      footerText: DEFAULT_SETTINGS.footer_text,
      socialImage: null,
      allowExternalImages: false,
    },
    posts: [],
    pages: [],
    categories: [],
    tags: [],
    media: [],
  };
  return { ...base, checksum: computeChecksum(base) };
}

export function snapshotItemCount(snapshot: Snapshot): number {
  return snapshot.posts.length + snapshot.pages.length;
}

function collectActorEmails(data: PublishedData): string[] {
  const emails = new Set<string>();
  for (const item of [...data.posts, ...data.pages]) {
    if (item.created_by) emails.add(item.created_by.toLowerCase());
    if (item.updated_by) emails.add(item.updated_by.toLowerCase());
  }
  for (const m of data.media) if (m.created_by) emails.add(m.created_by.toLowerCase());
  return [...emails].filter((e) => e.includes('@'));
}

export function findPrivateEmails(value: unknown, emails: string[], path = '$'): string[] {
  if (emails.length === 0) return [];
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return emails.some((e) => lower.includes(e)) ? [path] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => findPrivateEmails(v, emails, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) =>
      k === 'authorName' ? [] : findPrivateEmails(v, emails, `${path}.${k}`),
    );
  }
  return [];
}

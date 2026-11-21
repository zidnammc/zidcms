import type { Snapshot, SnapshotPage, SnapshotPost } from '@zidcms/core';
import { renderMarkdown } from '@zidcms/core/markdown';
import type { Metadata } from 'next';
import raw from '../content/snapshot.json';

export const snapshot = raw as unknown as Snapshot;

export const siteUrl = (process.env.SITE_URL || snapshot.site.url || '').replace(/\/+$/, '');

export const PLACEHOLDER = '__zidcms-empty__';

export const perPage = Math.max(1, snapshot.site.postsPerPage || 10);
export const totalPages = Math.max(1, Math.ceil(snapshot.posts.length / perPage));

export function pagePosts(n: number): SnapshotPost[] {
  return snapshot.posts.slice((n - 1) * perPage, n * perPage);
}

export const navPages = snapshot.pages
  .filter((p) => p.navOrder !== null)
  .sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0) || a.slug.localeCompare(b.slug));

export function render(markdown: string): string {
  return renderMarkdown(markdown, { allowExternalImages: snapshot.site.allowExternalImages, siteUrl });
}

export function absolute(path: string): string | undefined {
  return siteUrl ? `${siteUrl}${path}` : undefined;
}

export function paramsOrPlaceholder<T extends Record<string, string>>(params: T[], key: keyof T): T[] {
  return params.length > 0 ? params : [{ [key]: PLACEHOLDER } as T];
}

const fullTitle = (title: string) => `${title} – ${snapshot.site.title}`;

function images(src: string | null | undefined) {
  const url = src ? absolute(src) : undefined;
  return url ? [{ url }] : undefined;
}

export function baseMetadata(path: string, title: string, description: string): Metadata {
  const url = absolute(path);
  return {
    title: { absolute: title },
    description: description || undefined,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description: description || undefined,
      url,
      siteName: snapshot.site.title,
      type: 'website',
      locale: snapshot.site.language,
      images: images(snapshot.site.socialImage),
    },
  };
}

export function postMetadata(post: SnapshotPost): Metadata {
  const title = fullTitle(post.seo.title || post.title);
  const description = post.seo.description || post.excerpt || snapshot.site.description;
  const base = baseMetadata(`/blog/${post.slug}/`, title, description);
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: post.tags.map((t) => t.name),
      images: images(post.cover?.src ?? snapshot.site.socialImage),
    },
  };
}

export function pageMetadata(page: SnapshotPage): Metadata {
  return baseMetadata(
    `/${page.slug}/`,
    fullTitle(page.seo.title || page.title),
    page.seo.description || snapshot.site.description,
  );
}

export function listMetadata(path: string, title: string, description = snapshot.site.description): Metadata {
  return baseMetadata(path, fullTitle(title), description);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(snapshot.site.language || 'id', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

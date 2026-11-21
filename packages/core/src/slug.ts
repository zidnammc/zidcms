import { LIMITS, RESERVED_PAGE_SLUGS } from './limits';
import type { ContentKind, TaxonomyKind } from './schema/types';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.SLUG)
    .replace(/-+$/g, '');
}

export type SlugNamespace = ContentKind | TaxonomyKind;

export function validateSlug(slug: string, namespace: SlugNamespace): string | null {
  if (!slug) return 'Slug wajib diisi.';
  if (slug.length > LIMITS.SLUG) return `Slug maksimal ${LIMITS.SLUG} karakter.`;
  if (!SLUG_PATTERN.test(slug)) {
    return 'Slug hanya boleh huruf kecil (a-z), angka (0-9), dan tanda hubung tunggal (-).';
  }
  if (namespace === 'page' && RESERVED_PAGE_SLUGS.includes(slug)) {
    return `Slug "${slug}" dicadangkan oleh rute situs publik.`;
  }
  return null;
}

export function publicPath(namespace: SlugNamespace, slug: string): string {
  switch (namespace) {
    case 'post':
      return `/blog/${slug}/`;
    case 'page':
      return `/${slug}/`;
    case 'category':
      return `/category/${slug}/`;
    case 'tag':
      return `/tag/${slug}/`;
  }
}

import type { MetadataRoute } from 'next';
import { siteUrl, snapshot, totalPages } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${siteUrl}${path}`;
  const latest = snapshot.posts[0]?.updatedAt ?? snapshot.generatedAt;
  return [
    { url: url('/'), lastModified: latest },
    ...Array.from({ length: totalPages - 1 }, (_, i) => ({ url: url(`/page/${i + 2}/`), lastModified: latest })),
    ...snapshot.posts.map((p) => ({ url: url(`/blog/${p.slug}/`), lastModified: p.updatedAt })),
    ...snapshot.pages.map((p) => ({ url: url(`/${p.slug}/`), lastModified: p.updatedAt })),
    ...snapshot.categories.map((c) => ({ url: url(`/category/${c.slug}/`) })),
    ...snapshot.tags.map((t) => ({ url: url(`/tag/${t.slug}/`) })),
  ];
}

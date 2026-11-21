import { deriveExcerpt } from '@zidcms/core';
import { renderMarkdown } from '@zidcms/core/markdown';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadEditorContext } from '@/lib/editor-data';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pratinjau', robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== 'posts' && kind !== 'pages') notFound();
  const ctx = await loadEditorContext(kind === 'posts' ? 'post' : 'page', id);
  const item = ctx.item;
  if (!item) notFound();
  const { settings } = ctx;
  const categories = { items: ctx.categories };
  const tags = { items: ctx.tags };
  const media = { items: ctx.media };
  const post = 'author_name' in item ? item : null;
  const mediaById = new Map(media.items.map((m) => [m.id, m]));
  const html = renderMarkdown(item.content_markdown, {
    allowExternalImages: settings.allow_external_images,
    resolveMedia: (mediaId) => {
      const m = mediaById.get(mediaId);
      return m ? { src: `/api/media/${m.id}/preview`, alt: m.alt_text } : null;
    },
  });
  const category = post?.category_id ? categories.items.find((c) => c.id === post.category_id) : null;
  const postTags = post ? tags.items.filter((t) => post.tag_ids.includes(t.id)) : [];
  const cover = post?.cover_media_id ? mediaById.get(post.cover_media_id) : null;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <div
        role="status"
        className="sticky top-0 z-30 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-semibold flex flex-wrap items-center justify-between gap-2"
      >
        <span className="inline-flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Pratinjau – belum dipublikasikan. Status: {item.status}
          {item.deleted_at ? ' (di sampah)' : ''} · v{item.version}
        </span>
        <Link href={`/${kind}/${item.id}`} className="underline underline-offset-2">
          Kembali ke editor
        </Link>
      </div>
      <header className="border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center font-bold text-lg tracking-tight">
          {settings.site_title}
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <article className="space-y-8">
          <header className="space-y-4">
            {category && (
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {category.name}
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              {item.title}
            </h1>
            {post && (
              <p className="flex flex-wrap gap-x-4 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {post.author_name || settings.default_author_name}
                </span>
                <span>{formatDate(item.published_at ?? item.updated_at, false)}</span>
              </p>
            )}
            {post && (
              <p className="text-sm italic text-slate-500">
                Ringkasan: {post.excerpt || deriveExcerpt(item.content_markdown)}
              </p>
            )}
          </header>
          {cover && (
            <figure className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
              {/* biome-ignore lint/performance/noImgElement: admin-only preview */}
              <img
                src={`/api/media/${cover.id}/preview`}
                alt={cover.alt_text}
                className="w-full max-h-[440px] object-cover"
              />
            </figure>
          )}
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: output of the sanitizing renderMarkdown() */}
          <div className="zid-prose" dangerouslySetInnerHTML={{ __html: html }} />
          {postTags.length > 0 && (
            <footer className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
              {postTags.map((t) => (
                <span
                  key={t.id}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  #{t.name}
                </span>
              ))}
            </footer>
          )}
        </article>
      </main>
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-5 text-xs text-slate-500 text-center">
        {settings.footer_text} · Powered by <span className="text-emerald-600 font-bold">ZidCMS</span>
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Prose } from '@/components/post-list';
import { formatDate, paramsOrPlaceholder, postMetadata, render, snapshot } from '@/lib/site';

export const dynamicParams = false;

const find = (slug: string) => snapshot.posts.find((p) => p.slug === slug);

export function generateStaticParams() {
  return paramsOrPlaceholder(
    snapshot.posts.map((p) => ({ slug: p.slug })),
    'slug',
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = find((await params).slug);
  return post ? postMetadata(post) : {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = find((await params).slug);
  if (!post) notFound();
  return (
    <article className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
      >
        ← Semua artikel
      </Link>
      <header className="space-y-4">
        {post.category && (
          <Link
            href={`/category/${post.category.slug}/`}
            className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {post.category.name}
          </Link>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
          {post.title}
        </h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          {post.authorName && <span className="font-medium text-slate-700 dark:text-slate-300">{post.authorName}</span>}
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </p>
      </header>
      {post.cover && (
        <figure className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          {/* biome-ignore lint/performance/noImgElement: static export without image optimization */}
          <img
            src={post.cover.src}
            alt={post.cover.alt}
            width={post.cover.width ?? undefined}
            height={post.cover.height ?? undefined}
            className="w-full max-h-[440px] object-cover"
          />
        </figure>
      )}
      <Prose html={render(post.markdown)} />
      {post.tags.length > 0 && (
        <footer className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Topik:</span>
          {post.tags.map((t) => (
            <Link
              key={t.slug}
              href={`/tag/${t.slug}/`}
              className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800"
            >
              #{t.name}
            </Link>
          ))}
        </footer>
      )}
    </article>
  );
}

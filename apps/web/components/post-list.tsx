import type { SnapshotPost } from '@zidcms/core';
import Link from 'next/link';
import { formatDate } from '@/lib/site';

export function PostCard({ post }: { post: SnapshotPost }) {
  return (
    <article className="group grid sm:grid-cols-[1fr_200px] gap-5 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-colors">
      <div className="space-y-2 min-w-0 order-2 sm:order-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {post.category && (
            <Link
              href={`/category/${post.category.slug}/`}
              className="font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {post.category.name}
            </Link>
          )}
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          <Link href={`/blog/${post.slug}/`} className="hover:text-emerald-600 dark:hover:text-emerald-400">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">{post.excerpt}</p>
        )}
        {post.authorName && <p className="text-xs text-slate-500">oleh {post.authorName}</p>}
      </div>
      {post.cover && (
        <Link href={`/blog/${post.slug}/`} className="order-1 sm:order-2 block" tabIndex={-1} aria-hidden="true">
          {/* biome-ignore lint/performance/noImgElement: static export without image optimization */}
          <img
            src={post.cover.src}
            alt=""
            width={post.cover.width ?? undefined}
            height={post.cover.height ?? undefined}
            loading="lazy"
            className="w-full aspect-[16/10] object-cover rounded-xl border border-slate-200 dark:border-slate-800"
          />
        </Link>
      )}
    </article>
  );
}

export function PostList({ posts, empty }: { posts: SnapshotPost[]; empty: string }) {
  if (posts.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <p className="text-sm text-slate-500">{empty}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

export function Pagination({ current, total }: { current: number; total: number }) {
  if (total <= 1) return null;
  const href = (n: number) => (n <= 1 ? '/' : `/page/${n}/`);
  const cls =
    'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium';
  return (
    <nav
      aria-label="Paginasi"
      className="pt-6 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-sm"
    >
      {current > 1 ? (
        <Link href={href(current - 1)} className={cls} rel="prev">
          ← Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-xs text-slate-500">
        Halaman {current} dari {total}
      </span>
      {current < total ? (
        <Link href={href(current + 1)} className={cls} rel="next">
          Berikutnya →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function Prose({ html }: { html: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: output of the sanitizing renderMarkdown() at build time
  return <div className="zid-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

import Link from 'next/link';
import { Pagination, PostList } from '@/components/post-list';
import { pagePosts, snapshot, totalPages } from '@/lib/site';

export function Home({ page }: { page: number }) {
  return (
    <div className="space-y-10">
      {page === 1 && (
        <section className="space-y-4 pb-8 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {snapshot.site.title}
          </h1>
          {snapshot.site.description && (
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              {snapshot.site.description}
            </p>
          )}
          {snapshot.categories.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-1">
              {snapshot.categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}/`}
                    className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {page > 1 && <h1 className="text-2xl font-bold">Artikel – halaman {page}</h1>}
      <PostList posts={pagePosts(page)} empty="Belum ada artikel yang dipublikasikan." />
      <Pagination current={page} total={totalPages} />
    </div>
  );
}

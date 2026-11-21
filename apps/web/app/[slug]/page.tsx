import { notFound } from 'next/navigation';
import { Prose } from '@/components/post-list';
import { pageMetadata, paramsOrPlaceholder, render, snapshot } from '@/lib/site';

export const dynamicParams = false;

const find = (slug: string) => snapshot.pages.find((p) => p.slug === slug);

export function generateStaticParams() {
  return paramsOrPlaceholder(
    snapshot.pages.map((p) => ({ slug: p.slug })),
    'slug',
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = find((await params).slug);
  return page ? pageMetadata(page) : {};
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = find((await params).slug);
  if (!page) notFound();
  return (
    <article className="space-y-6">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{page.title}</h1>
      <Prose html={render(page.markdown)} />
    </article>
  );
}

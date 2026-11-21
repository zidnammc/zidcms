import type { SnapshotPost, SnapshotTaxon } from '@zidcms/core';
import { notFound } from 'next/navigation';
import { listMetadata, paramsOrPlaceholder, snapshot } from '@/lib/site';
import { PostList } from './post-list';

type Kind = 'category' | 'tag';

const collection = (kind: Kind): SnapshotTaxon[] => (kind === 'category' ? snapshot.categories : snapshot.tags);
const matches = (kind: Kind, post: SnapshotPost, slug: string) =>
  kind === 'category' ? post.category?.slug === slug : post.tags.some((t) => t.slug === slug);
const label = (kind: Kind, name: string) => (kind === 'tag' ? `#${name}` : name);

export function taxonStaticParams(kind: Kind) {
  return paramsOrPlaceholder(
    collection(kind).map((t) => ({ slug: t.slug })),
    'slug',
  );
}

export function taxonMetadata(kind: Kind, slug: string) {
  const taxon = collection(kind).find((t) => t.slug === slug);
  return taxon ? listMetadata(`/${kind}/${taxon.slug}/`, label(kind, taxon.name), taxon.description || undefined) : {};
}

export function TaxonPage({ kind, slug }: { kind: Kind; slug: string }) {
  const taxon = collection(kind).find((t) => t.slug === slug);
  if (!taxon) notFound();
  const posts = snapshot.posts.filter((p) => matches(kind, p, slug));
  return (
    <div className="space-y-8">
      <div className="space-y-2 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="text-xs font-mono uppercase text-emerald-600 dark:text-emerald-400">
          {kind === 'category' ? 'Arsip kategori' : 'Arsip tag'}
        </div>
        <h1 className="text-3xl font-bold">{label(kind, taxon.name)}</h1>
        {taxon.description && <p className="text-slate-600 dark:text-slate-400">{taxon.description}</p>}
      </div>
      <PostList posts={posts} empty="Belum ada artikel terbit di sini." />
    </div>
  );
}

import type { Taxon } from '@zidcms/core';
import { TaxonomyScreen } from '@/components/taxonomy-screen';
import { getAdmin } from '@/lib/data';
import { gas } from '@/lib/gas-client';

export const metadata = { title: 'Kategori & Tag' };

export default async function TaxonomyPage() {
  const admin = await getAdmin();
  const ctx = { actor: admin.email };
  const [categories, tags] = await Promise.all([
    gas<{ items: Taxon[] }>('taxonomy.list', { kind: 'category' }, ctx),
    gas<{ items: Taxon[] }>('taxonomy.list', { kind: 'tag' }, ctx),
  ]);
  return <TaxonomyScreen categories={categories.items} tags={tags.items} />;
}

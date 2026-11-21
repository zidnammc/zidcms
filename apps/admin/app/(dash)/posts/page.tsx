import { ContentList, type ListResult } from '@/components/content-list';
import { getAdmin, getLiveIndex } from '@/lib/data';
import { gas } from '@/lib/gas-client';

export const metadata = { title: 'Artikel' };

const STATUSES = ['all', 'draft', 'published', 'archived', 'trash'];

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; cursor?: string }>;
}) {
  const admin = await getAdmin();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? '') ? (sp.status as string) : 'all';
  const q = (sp.q ?? '').slice(0, 100);
  const cursor = Math.max(Number(sp.cursor ?? 0) || 0, 0);
  const [result, liveIndex] = await Promise.all([
    gas<ListResult>('posts.list', { status, q, cursor: String(cursor), limit: 20 }, { actor: admin.email }),
    getLiveIndex(),
  ]);
  return <ContentList kind="post" result={result} status={status} q={q} cursor={cursor} liveIndex={liveIndex} />;
}

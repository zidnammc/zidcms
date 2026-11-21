import { type ContentKind, type ContentSummary, computeLiveState, type Page, type Post } from '@zidcms/core';
import { ChevronLeft, ChevronRight, Eye, PenSquare, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { type PlainLiveIndex, type StatusCounts, toLiveIndex } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { LiveBadge, StatusBadge } from './badges';
import { RestoreButton } from './content-actions';
import { btn, card, input } from './feedback';

export interface ListResult {
  items: ContentSummary<Post | Page>[];
  total: number;
  counts: StatusCounts;
  nextCursor: string | null;
}

const TABS = [
  ['all', 'Semua'],
  ['draft', 'Draf'],
  ['published', 'Terbit'],
  ['archived', 'Arsip'],
  ['trash', 'Sampah'],
] as const;

export function ContentList({
  kind,
  result,
  status,
  q,
  cursor,
  liveIndex,
}: {
  kind: ContentKind;
  result: ListResult;
  status: string;
  q: string;
  cursor: number;
  liveIndex: PlainLiveIndex | null;
}) {
  const base = kind === 'post' ? '/posts' : '/pages';
  const index = toLiveIndex(liveIndex);
  const label = kind === 'post' ? 'Artikel' : 'Halaman Statis';
  const href = (params: Record<string, string | number>) => {
    const sp = new URLSearchParams({
      status,
      ...(q ? { q } : {}),
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    if (sp.get('status') === 'all') sp.delete('status');
    if (sp.get('cursor') === '0') sp.delete('cursor');
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };
  const limit = 20;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{label}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {kind === 'post'
              ? 'Kelola artikel blog. Artikel terbit tampil di /blog/<slug>/ setelah publikasi.'
              : 'Halaman tingkat atas (/<slug>/). Isi “urutan navigasi” agar tampil di menu header.'}
          </p>
        </div>
        <Link href={`${base}/new`} className={btn.primary}>
          <Plus className="w-4 h-4" />
          {kind === 'post' ? 'Artikel Baru' : 'Halaman Baru'}
        </Link>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-1.5" aria-label="Filter status">
            {TABS.map(([key, text]) => (
              <Link
                key={key}
                href={href({ status: key, cursor: 0 })}
                aria-current={status === key ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  status === key
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {text} <span className="font-mono opacity-70">{result.counts[key]}</span>
              </Link>
            ))}
          </nav>
          <form className="relative w-full lg:w-72" action={base}>
            {status !== 'all' && <input type="hidden" name="status" value={status} />}
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari judul atau slug…"
              aria-label="Cari"
              className={`${input} pl-9`}
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase font-mono text-[11px]">
              <tr>
                <th className="px-5 py-3">Judul</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Situs publik</th>
                <th className="px-4 py-3">Diperbarui</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {result.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    {q ? `Tidak ada hasil untuk “${q}”.` : 'Belum ada item di tampilan ini.'}
                  </td>
                </tr>
              )}
              {result.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3.5 max-w-md">
                    {item.deleted_at ? (
                      <span className="font-semibold text-slate-500 line-through">{item.title}</span>
                    ) : (
                      <Link
                        href={`${base}/${item.id}`}
                        className="font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        {item.title}
                      </Link>
                    )}
                    <div className="text-xs font-mono text-slate-400 truncate">
                      {kind === 'post' ? '/blog/' : '/'}
                      {item.slug}/ · v{item.version}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={item.status} deleted={Boolean(item.deleted_at)} />
                  </td>
                  <td className="px-4 py-3.5">
                    <LiveBadge state={computeLiveState(item, index)} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(item.updated_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      {item.deleted_at ? (
                        <RestoreButton kind={kind} id={item.id} version={item.version} />
                      ) : (
                        <>
                          <Link href={`/preview/${kind}s/${item.id}`} className={btn.ghost} title="Pratinjau">
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Pratinjau</span>
                          </Link>
                          <Link href={`${base}/${item.id}`} className={btn.ghost} title="Edit">
                            <PenSquare className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Edit</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            {result.total === 0 ? 0 : cursor + 1}–{Math.min(cursor + limit, result.total)} dari {result.total}
          </span>
          <div className="flex gap-2">
            {cursor > 0 ? (
              <Link href={href({ cursor: Math.max(cursor - limit, 0) })} className={btn.ghost}>
                <ChevronLeft className="w-3.5 h-3.5" />
                Sebelumnya
              </Link>
            ) : null}
            {result.nextCursor ? (
              <Link href={href({ cursor: result.nextCursor })} className={btn.ghost}>
                Berikutnya
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

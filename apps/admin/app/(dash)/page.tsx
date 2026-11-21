import type { AuditEntry } from '@zidcms/core';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  FileText,
  Globe,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { btn, card } from '@/components/feedback';
import { LiveJobCard, PendingBanner, PublishButton } from '@/components/publish-controls';
import { getAdmin, getSummary } from '@/lib/data';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { gas } from '@/lib/gas-client';

export const metadata = { title: 'Dasbor' };

export default async function DashboardPage() {
  const admin = await getAdmin();
  const [summary, audit] = await Promise.all([
    getSummary(),
    gas<{ items: AuditEntry[] }>('audit.list', { limit: 8 }, { actor: admin.email }),
  ]);
  const { posts, pages } = summary;
  const stats = [
    {
      href: '/posts?status=published',
      label: 'Artikel terbit',
      value: posts.counts.published,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      hover: 'hover:border-emerald-500/50',
    },
    {
      href: '/posts?status=draft',
      label: 'Draf privat',
      value: posts.counts.draft,
      icon: FileEdit,
      color: 'text-amber-600 dark:text-amber-400',
      hover: 'hover:border-amber-500/50',
    },
    {
      href: '/posts?status=archived',
      label: 'Diarsipkan',
      value: posts.counts.archived,
      icon: Archive,
      color: 'text-slate-500',
      hover: 'hover:border-slate-400',
    },
    {
      href: '/posts?status=trash',
      label: 'Di sampah',
      value: posts.counts.trash,
      icon: Trash2,
      color: 'text-rose-500',
      hover: 'hover:border-rose-500/50',
    },
    {
      href: '/pages',
      label: 'Halaman statis',
      value: pages.counts.all,
      icon: FileText,
      color: 'text-indigo-500',
      hover: 'hover:border-indigo-500/50',
    },
    {
      href: '/media',
      label: 'Media Drive',
      value: summary.mediaCount,
      icon: ImageIcon,
      color: 'text-purple-500',
      hover: 'hover:border-purple-500/50',
    },
  ];
  const total = posts.counts.all + posts.counts.trash + pages.counts.all + pages.counts.trash;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dasbor Editorial
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pantau konten di Google Sheets, jalankan publikasi snapshot, dan periksa kesehatan sistem.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/posts/new" className={btn.secondary}>
            <Plus className="w-4 h-4" />
            Artikel Baru
          </Link>
          <PublishButton />
        </div>
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
        <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <span>
          <strong>Kesegaran konten:</strong> perubahan tayang di situs publik setelah job publikasi mencapai status{' '}
          <strong>Tayang</strong> (biasanya beberapa menit). Menyimpan draf tidak pernah memengaruhi situs publik.
        </span>
      </div>

      {summary.invalidRowCount > 0 && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3.5"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold text-rose-900 dark:text-rose-200">
              Peringatan integritas spreadsheet: {summary.invalidRowCount} baris tidak valid
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
              Ada pengeditan manual di Google Sheets yang melanggar skema. Baris tersebut dilewati dari daftar dan
              snapshot.
            </p>
          </div>
        </div>
      )}

      <PendingBanner liveVersion={summary.live?.version ?? null} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {stats.map(({ href, label, value, icon: Icon, color, hover }) => (
          <Link key={label} href={href} className={`${card} text-left p-4 transition-all ${hover}`}>
            <div className={`flex items-center justify-between mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className={`${card} lg:col-span-2 p-5 sm:p-6 space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">Status publikasi terkini</h2>
            <Link
              href="/publish"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Buka riwayat & rollback →
            </Link>
          </div>
          <LiveJobCard fallback={summary.lastJob} />
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {summary.live
                    ? `Situs publik aktif: snapshot v${summary.live.version}`
                    : 'Situs publik belum memiliki snapshot'}
                  {summary.live?.based_on_version != null && (
                    <span className="ml-2 text-xs font-normal text-purple-600 dark:text-purple-400">
                      (rollback dari v{summary.live.based_on_version})
                    </span>
                  )}
                </div>
                {summary.live && (
                  <div className="text-xs font-mono text-slate-500">
                    {summary.live.checksum.slice(0, 22)}… • {summary.live.item_count} item •{' '}
                    {formatDate(summary.live.created_at)}
                  </div>
                )}
              </div>
            </div>
            <a
              href={env.publicSiteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold"
            >
              Kunjungi situs
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        <section className={`${card} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Kesehatan & anggaran $0
            </h2>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                summary.invalidRowCount
                  ? 'bg-rose-500/10 text-rose-600'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {summary.invalidRowCount ? 'PERIKSA' : 'SEHAT'}
            </span>
          </div>
          <dl className="space-y-2 text-xs">
            {[
              ['Lingkungan Apps Script', summary.environment],
              ['Kapasitas desain konten', `${total} / 500 item`],
              ['Baris rusak (edit manual)', `${summary.invalidRowCount} baris`],
              ['Snapshot terbaru', summary.latestVersion ? `v${summary.latestVersion}` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-mono font-medium">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between py-1">
              <dt className="text-slate-500">Fungsi runtime web publik</dt>
              <dd className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />0 serverless
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-slate-500 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            Vercel Hobby: maks. 100 deployment/hari (kode + publikasi), 1 build bersamaan. Panduan: ≤40 kode + ≤30
            publikasi + 30 cadangan.
          </p>
        </section>
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Jejak audit terbaru</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Setiap mutasi dan publikasi tercatat di lembar AuditLog.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase font-mono text-[11px]">
              <tr>
                <th className="px-5 py-3">Waktu</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Hasil</th>
                <th className="px-4 py-3">Rincian</th>
                <th className="px-5 py-3">Request ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {audit.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                    Belum ada aktivitas.
                  </td>
                </tr>
              )}
              {audit.items.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500">{formatDate(entry.at)}</td>
                  <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-slate-200">{entry.action}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                        entry.result === 'ok'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {entry.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{entry.detail}</td>
                  <td className="px-5 py-3 font-mono text-slate-400">{entry.request_id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

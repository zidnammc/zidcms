'use client';

import type { PublishJob, SnapshotRecord } from '@zidcms/core';
import { Clock, GitCommit, History, RotateCcw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { formatDate, shortSha } from '@/lib/format';
import { JobStateBadge } from './badges';
import { btn, card, Modal } from './feedback';
import { usePublish } from './publish-context';
import { LiveJobCard, PublishButton } from './publish-controls';

const SNAPSHOT_STYLE: Record<SnapshotRecord['status'], string> = {
  live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  committed: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  superseded: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  failed: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

export function PublishScreen({
  jobs,
  snapshots,
  commitUrlBase,
}: {
  jobs: PublishJob[];
  snapshots: SnapshotRecord[];
  commitUrlBase: string | null;
}) {
  const { activeJob, startRollback, starting } = usePublish();
  const [target, setTarget] = useState<SnapshotRecord | null>(null);
  const sha = (value: string | null) =>
    value && commitUrlBase ? (
      <a
        href={`${commitUrlBase}/${value}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono hover:underline"
      >
        {shortSha(value)}
      </a>
    ) : (
      <span className="font-mono">{shortSha(value)}</span>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Publikasi & Snapshot</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Setiap publikasi membuat snapshot JSON baru, commit atomik ke Git, build statis, lalu verifikasi versi.
          </p>
        </div>
        <PublishButton />
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
        <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        Perubahan tayang setelah job mencapai <strong className="mx-1">Tayang</strong> (biasanya beberapa menit). Job
        tetap berlanjut pada polling berikutnya bila tab ini ditutup.
      </div>

      <section className={`${card} p-5 sm:p-6 space-y-4`}>
        <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">Job aktif / terakhir</h2>
        <LiveJobCard fallback={jobs[0] ?? null} />
      </section>

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <section className={`${card} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-500" />
            <h2 className="text-base font-bold">Riwayat snapshot</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-3">Versi</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Isi</th>
                  <th className="px-3 py-3">Commit</th>
                  <th className="px-3 py-3">Dibuat</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {snapshots.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Belum ada snapshot.
                    </td>
                  </tr>
                )}
                {snapshots.map((s) => (
                  <tr key={s.version}>
                    <td className="px-4 py-3 font-mono font-bold">
                      v{s.version}
                      {s.based_on_version != null && (
                        <div className="font-normal text-purple-600">← v{s.based_on_version}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded font-mono text-[11px] ${SNAPSHOT_STYLE[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {s.item_count} item · {s.media_count} media
                    </td>
                    <td className="px-3 py-3">{sha(s.git_commit_sha)}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(s.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'superseded' && (
                        <button
                          type="button"
                          onClick={() => setTarget(s)}
                          disabled={Boolean(activeJob) || starting}
                          className={btn.ghost}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${card} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-sky-500" />
            <h2 className="text-base font-bold">Riwayat job</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {jobs.length === 0 && <li className="px-5 py-8 text-center text-xs text-slate-500">Belum ada job.</li>}
            {jobs.map((j) => (
              <li key={j.id} className="px-5 py-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {j.type === 'rollback' ? `Rollback → v${j.target_version}` : 'Publikasi'}
                    <span className="ml-2 font-mono font-normal text-slate-400">{j.id.slice(0, 8)}</span>
                  </span>
                  <JobStateBadge state={j.state} />
                </div>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                  <span>{formatDate(j.created_at)}</span>
                  {j.snapshot_version != null && <span>snapshot v{j.snapshot_version}</span>}
                  {j.git_commit_sha && <span>commit {sha(j.git_commit_sha)}</span>}
                  {j.rerun_requested && <span className="text-amber-600">+ rerun</span>}
                </div>
                {(j.error_message || j.deploy_detail) && (
                  <p
                    className={`text-[11px] ${j.state === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}
                  >
                    {j.error_code ? `${j.error_code}: ` : ''}
                    {j.error_message || j.deploy_detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        Darurat (admin tidak bisa diakses): gunakan Instant Rollback pada proyek web di dasbor Vercel — lihat runbook R1
        di docs/operations.md.
      </div>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={`Rollback ke snapshot v${target?.version}?`}
        icon={<RotateCcw className="w-5 h-5 text-purple-500" />}
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={() => setTarget(null)}>
              Batal
            </button>
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                if (target) void startRollback(target.version);
                setTarget(null);
              }}
            >
              Ya, rollback
            </button>
          </>
        }
      >
        <p>
          Konten snapshot v{target?.version} akan dipublikasikan ulang sebagai versi baru (riwayat tetap append-only).
          Status item di Google Sheets tidak berubah; item yang berbeda akan ditandai “Selisih Rollback”.
        </p>
      </Modal>
    </div>
  );
}

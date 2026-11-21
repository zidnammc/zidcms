'use client';

import type { PublishJob, PublishJobState } from '@zidcms/core';
import { Loader2, Rocket } from 'lucide-react';
import { btn } from './feedback';
import { usePublish } from './publish-context';

export function PublishButton({
  className = btn.primary,
  label = 'Publikasikan Situs',
}: {
  className?: string;
  label?: string;
}) {
  const { activeJob, starting, startPublish } = usePublish();
  return (
    <button type="button" disabled={starting} onClick={startPublish} className={className}>
      {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
      {activeJob ? 'Gabungkan ke antrean rilis' : label}
    </button>
  );
}

export function PendingBanner({ liveVersion }: { liveVersion: number | null }) {
  const { pendingChanges, activeJob } = usePublish();
  if (!pendingChanges || activeJob) return null;
  return (
    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Rocket className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Ada perubahan yang menunggu publikasi
          </div>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
            Konten, taksonomi, atau pengaturan di Google Sheets lebih baru daripada{' '}
            {liveVersion !== null ? `snapshot v${liveVersion}` : 'situs'} yang sedang tayang.
          </p>
        </div>
      </div>
      <PublishButton
        label="Publikasikan sekarang"
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
      />
    </div>
  );
}

export const PIPELINE: { key: PublishJobState; label: string }[] = [
  { key: 'queued', label: 'Antrean' },
  { key: 'collecting', label: 'Validasi & Snapshot' },
  { key: 'committing', label: 'Commit GitHub' },
  { key: 'deploying', label: 'Build Vercel' },
  { key: 'verifying', label: 'Cek zidcms-version' },
  { key: 'live', label: 'Tayang' },
];

export function Pipeline({ job }: { job: PublishJob }) {
  const idx = PIPELINE.findIndex((s) => s.key === job.state);
  const failed = job.state === 'failed';
  return (
    <ol className="grid grid-cols-2 sm:grid-cols-6 gap-2">
      {PIPELINE.map((step, i) => {
        const done = job.state === 'live' || (!failed && idx > i);
        const current = !failed && idx === i && job.state !== 'live';
        return (
          <li
            key={step.key}
            aria-current={current ? 'step' : undefined}
            className={`p-2.5 rounded-xl border text-center transition-all ${
              done
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : current
                  ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-400 dark:border-sky-700 text-sky-800 dark:text-sky-200 ring-2 ring-sky-500/20'
                  : failed
                    ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-400'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
            }`}
          >
            <div className="text-[10px] font-mono uppercase">Tahap {i + 1}</div>
            <div className="text-xs font-semibold mt-0.5 leading-tight">{step.label}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function LiveJobCard({ fallback }: { fallback: PublishJob | null }) {
  const { activeJob, lastJob } = usePublish();
  const job = activeJob ?? lastJob ?? fallback;
  if (!job) {
    return (
      <p className="text-sm text-slate-500">
        Belum ada job publikasi. Klik “Publikasikan Situs” untuk membuat snapshot pertama.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
        Job <span className="font-mono text-xs">{job.id.slice(0, 8)}</span>
        <span className="text-xs font-normal text-slate-500">
          ({job.type === 'rollback' ? `rollback ke v${job.target_version}` : 'publikasi'})
        </span>
      </div>
      <Pipeline job={job} />
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
        <div className="flex justify-between text-slate-500 gap-2">
          <span>Status: {job.state}</span>
          {job.git_commit_sha && <span className="font-mono">{job.git_commit_sha.slice(0, 7)}</span>}
        </div>
        <p
          className={`font-medium ${job.state === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}
        >
          {job.error_message || job.deploy_detail || '—'}
        </p>
      </div>
    </div>
  );
}

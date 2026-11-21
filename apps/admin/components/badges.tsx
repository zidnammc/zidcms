import type { ContentStatus, LiveState, PublishJobState } from '@zidcms/core';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  FileEdit,
  GitBranch,
  Globe,
  Loader2,
  MinusCircle,
  Trash2,
  XCircle,
} from 'lucide-react';

const pill = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border';
const tag = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border';

export function StatusBadge({ status, deleted }: { status: ContentStatus; deleted?: boolean }) {
  if (deleted) {
    return (
      <span
        className={`${pill} bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70`}
      >
        <Trash2 className="w-3 h-3" />
        Sampah
      </span>
    );
  }
  if (status === 'published') {
    return (
      <span
        className={`${pill} bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70`}
      >
        <CheckCircle2 className="w-3 h-3" />
        Terbit
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span
        className={`${pill} bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700`}
      >
        <Archive className="w-3 h-3" />
        Arsip
      </span>
    );
  }
  return (
    <span
      className={`${pill} bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70`}
    >
      <FileEdit className="w-3 h-3" />
      Draf
    </span>
  );
}

const LIVE: Record<LiveState, { label: string; cls: string; icon: React.ReactNode; title?: string }> = {
  live: {
    label: 'Tayang',
    cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />,
  },
  live_pending_update: {
    label: 'Tayang – pembaruan tertunda',
    cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
    icon: <Clock className="w-3 h-3" />,
  },
  pending_publish: {
    label: 'Menunggu publikasi',
    cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    icon: <Clock className="w-3 h-3" />,
  },
  removal_pending: {
    label: 'Penghapusan tertunda',
    cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  rollback_mismatch: {
    label: 'Selisih Rollback',
    cls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
    icon: <GitBranch className="w-3 h-3" />,
    title: 'Situs menayangkan snapshot hasil rollback yang berbeda dari status di Google Sheets',
  },
  not_live: {
    label: 'Belum tayang',
    cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    icon: <MinusCircle className="w-3 h-3" />,
  },
};

export function LiveBadge({ state }: { state: LiveState }) {
  const s = LIVE[state];
  return (
    <span className={`${tag} ${s.cls}`} title={s.title}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function EnvBadge({ env }: { env: 'DEV' | 'PROD' }) {
  const prod = env === 'PROD';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tracking-wider uppercase border ${
        prod
          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
          : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${prod ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`} />
      {env}
    </span>
  );
}

export const JOB_LABELS: Record<PublishJobState, string> = {
  queued: 'Antrean',
  collecting: 'Merakit Snapshot',
  committing: 'Commit GitHub',
  deploying: 'Deploy (Build)',
  verifying: 'Verifikasi Versi',
  live: 'Tayang (Live)',
  failed: 'Gagal',
};

export function JobStateBadge({ state }: { state: PublishJobState }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border';
  if (state === 'live') {
    return (
      <span className={`${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30`}>
        <Globe className="w-3.5 h-3.5" />
        {JOB_LABELS[state]}
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span className={`${base} bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30`}>
        <XCircle className="w-3.5 h-3.5" />
        {JOB_LABELS[state]}
      </span>
    );
  }
  return (
    <span className={`${base} bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30`}>
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      {JOB_LABELS[state]}
    </span>
  );
}

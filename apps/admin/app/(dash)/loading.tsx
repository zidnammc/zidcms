import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        Memuat data dari Google Sheets… (biasanya 2–5 detik)
      </div>
      <div className="h-8 w-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
        <div className="h-80 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
      </div>
    </div>
  );
}

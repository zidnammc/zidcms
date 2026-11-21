'use client';

import {
  ExternalLink,
  FileSpreadsheet,
  Files,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Rocket,
  Settings,
  Sun,
  Tags,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOutAction } from '@/app/actions';
import { EnvBadge, JobStateBadge } from './badges';
import { usePublish } from './publish-context';

export interface ShellInfo {
  email: string;
  environment: 'DEV' | 'PROD';
  publicSiteUrl: string;
  liveVersion: number | null;
  counts: { posts: number; pages: number; media: number };
}

export function AdminShell({ info, children }: { info: ShellInfo; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { activeJob, pendingChanges } = usePublish();

  const nav = [
    { href: '/', label: 'Dasbor', icon: LayoutDashboard, exact: true },
    { href: '/posts', label: 'Artikel', icon: FileText, badge: info.counts.posts },
    { href: '/pages', label: 'Halaman Statis', icon: Files, badge: info.counts.pages },
    { href: '/taxonomy', label: 'Kategori & Tag', icon: Tags },
    { href: '/media', label: 'Pustaka Media', icon: ImageIcon, badge: info.counts.media },
    {
      href: '/publish',
      label: 'Publikasi & Snapshot',
      icon: Rocket,
      badge: info.liveVersion !== null ? `v${info.liveVersion}` : '—',
      dot: Boolean(activeJob) || pendingChanges,
    },
    { href: '/settings', label: 'Pengaturan Situs', icon: Settings },
  ];

  const toggleTheme = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('zid-theme', dark ? 'dark' : 'light');
    } catch {}
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-slate-900 dark:text-white leading-none">ZidCMS</div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">Sheets → Git → CDN</div>
          </div>
        </Link>
        <EnvBadge env={info.environment} />
      </div>
      <div className="p-3">
        <Link
          href="/posts/new"
          onClick={() => setOpen(false)}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tulis Artikel Baru
        </Link>
      </div>
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto" aria-label="Navigasi admin">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                active
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/70'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100 border-transparent'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                {item.label}
              </span>
              <span className="flex items-center gap-1.5">
                {item.dot && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                {item.badge !== undefined && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {item.badge}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
        <a
          href={info.publicSiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
        >
          Buka Situs Publik
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
        <div className="flex items-center justify-between px-2 py-1">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{info.email}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Admin (allowlist)</div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Keluar"
              aria-label="Keluar"
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:block w-[272px] shrink-0 sticky top-0 h-screen">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <button
            type="button"
            aria-label="Tutup menu"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebar}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="relative z-10 m-3 h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden">
              <EnvBadge env={info.environment} />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {activeJob ? (
              <Link href="/publish" className="hover:opacity-90">
                <JobStateBadge state={activeJob.state} />
              </Link>
            ) : pendingChanges ? (
              <Link
                href="/publish"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Perubahan menunggu publikasi
              </Link>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {info.liveVersion !== null
                  ? `Sinkron dengan snapshot v${info.liveVersion}`
                  : 'Belum ada snapshot tayang'}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Ganti tema terang/gelap"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Sun className="w-4 h-4 hidden dark:block" />
              <Moon className="w-4 h-4 dark:hidden" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

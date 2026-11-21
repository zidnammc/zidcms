import type { Metadata } from 'next';
import Link from 'next/link';
import { navPages, siteUrl, snapshot } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: snapshot.site.title,
  description: snapshot.site.description || undefined,
  generator: 'ZidCMS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={snapshot.site.language || 'id'} className="antialiased">
      <body className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-emerald-600 focus:text-white"
        >
          Lewati ke konten
        </a>
        <header className="border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="font-bold text-lg tracking-tight text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 truncate"
            >
              {snapshot.site.title}
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto text-sm" aria-label="Navigasi utama">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Beranda
              </Link>
              {navPages.map((p) => (
                <Link
                  key={p.id}
                  href={`/${p.slug}/`}
                  className="px-3 py-1.5 rounded-lg font-medium whitespace-nowrap text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  {p.title}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="konten" className="flex-1 max-w-4xl w-full mx-auto px-5 sm:px-8 py-10 sm:py-14">
          {children}
        </main>
        <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-5 sm:px-8 text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>{snapshot.site.footerText}</div>
            <div className="font-medium text-slate-700 dark:text-slate-300">
              Powered by <span className="text-emerald-600 dark:text-emerald-400 font-bold">ZidCMS</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

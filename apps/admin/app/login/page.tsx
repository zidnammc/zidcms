import { AlertOctagon, ArrowRight, Database, GitCommit, Globe, Lock, ShieldCheck, Table2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { signInDev, signInWithGoogle } from '@/app/actions';
import { EnvBadge } from '@/components/badges';
import { auth } from '@/lib/auth';
import { env, isAllowedAdmin } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Masuk' };

const ERRORS: Record<string, string> = {
  AccessDenied: 'Akun Google ini tidak terdaftar di ADMIN_EMAILS atau emailnya belum terverifikasi.',
  Configuration: 'Konfigurasi autentikasi server belum lengkap.',
  CredentialsSignin: 'Email tidak ada di allowlist.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (isAllowedAdmin(session?.user?.email)) redirect('/');
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? 'Gagal masuk. Silakan coba lagi.') : null;
  const devLogin = env.devLoginEnabled();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Table2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">ZidCMS</span>
              <span className="block text-[11px] font-mono text-emerald-400">Spreadsheet-Native Headless CMS</span>
            </div>
          </div>
          <EnvBadge env={env.environment()} />
        </div>
        <div className="relative z-10 my-12 max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Infrastruktur $0 • Open-source Apache-2.0
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
            Tulis dari Sheets. <span className="text-emerald-400">Sajikan dalam skala besar.</span>
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            Dasbor editorial yang menyimpan konten di Google Sheets melalui RPC bertanda tangan HMAC, lalu
            mempublikasikan snapshot terverifikasi ke CDN statis tanpa fungsi runtime di sisi pembaca.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            {[
              {
                icon: Database,
                color: 'text-emerald-400',
                title: 'Google Sheets + Drive',
                text: 'Teks murni & media privat via Apps Script',
              },
              {
                icon: GitCommit,
                color: 'text-sky-400',
                title: 'Snapshot atomik Git',
                text: 'Riwayat versi di GitHub dengan rollback',
              },
              {
                icon: Globe,
                color: 'text-purple-400',
                title: '100% situs statis',
                text: 'Pembaca tidak pernah menyentuh Sheets',
              },
            ].map(({ icon: Icon, color, title, text }) => (
              <div key={title} className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <Icon className={`w-4 h-4 mb-2 ${color}`} />
                <div className="text-xs font-semibold">{title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{text}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-slate-400">© 2026 The ZidCMS Authors</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-7 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              Autentikasi admin (Auth.js + allowlist)
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Masuk ke Dasbor Admin</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hanya akun Google terverifikasi yang terdaftar di variabel server{' '}
              <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                ADMIN_EMAILS
              </code>{' '}
              yang diizinkan masuk.
            </p>
          </div>
          {message && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 flex items-start gap-3"
            >
              <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                <div className="font-bold mb-0.5">Akses ditolak</div>
                {message}
              </div>
            </div>
          )}
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-sm shadow-sm transition-all"
            >
              <span className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white text-slate-900 font-bold text-xs flex items-center justify-center">
                  G
                </span>
                Masuk dengan Google
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          {devLogin && (
            <form
              action={signInDev}
              className="space-y-2 p-4 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30"
            >
              <label htmlFor="dev-email" className="block text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                Dev login (hanya `next dev` + ZIDCMS_DEV_LOGIN=true)
              </label>
              <div className="flex gap-2">
                <input
                  id="dev-email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Masuk
                </button>
              </div>
            </form>
          )}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Strategi sesi</span>
              <span className="font-mono">JWT cookie (httpOnly, SameSite=Lax)</span>
            </div>
            <div className="flex justify-between">
              <span>Perlindungan mutasi</span>
              <span className="font-mono">Origin check + requireAdmin()</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

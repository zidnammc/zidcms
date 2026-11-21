import Link from 'next/link';

export const metadata = { title: 'Halaman tidak ditemukan', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="py-16 text-center max-w-md mx-auto space-y-5">
      <div className="text-5xl font-bold font-mono text-slate-300 dark:text-slate-700">404</div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Halaman tidak ditemukan</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Konten mungkin belum dipublikasikan, sudah dihapus, atau URL-nya berubah.
      </p>
      <Link
        href="/"
        className="inline-flex px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
      >
        Kembali ke beranda
      </Link>
    </div>
  );
}

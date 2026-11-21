'use client';

import { LIMITS, type SiteSettings } from '@zidcms/core';
import { Image as ImageIcon, Loader2, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/client';
import { formatDate } from '@/lib/format';
import { useUnsavedGuard } from './editor/use-unsaved-guard';
import { btn, card, input, useToast } from './feedback';
import { type MediaItem, MediaPicker } from './media-picker';
import { usePublish } from './publish-context';

export function SettingsForm({
  initial,
  updatedAt,
  media,
}: {
  initial: SiteSettings;
  updatedAt: string | null;
  media: MediaItem[];
}) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const [library, setLibrary] = useState(media);
  const toast = useToast();
  const router = useRouter();
  const { markPending } = usePublish();
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  useUnsavedGuard(dirty);
  const social = library.find((m) => m.id === form.social_image_media_id) ?? null;

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const patch = Object.fromEntries(
        Object.entries(form).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(saved[k as keyof SiteSettings])),
      );
      const result = await api<{ settings: SiteSettings }>('PATCH', '/api/settings', { patch });
      setSaved(result.settings);
      setForm(result.settings);
      markPending();
      toast('success', 'Pengaturan tersimpan', 'Klik “Publikasikan Situs” agar perubahan tayang.');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const fields = (err.details?.fields ?? []) as { field: string; message: string }[];
        setErrors(Object.fromEntries(fields.map((f) => [f.field, f.message])));
      }
      toast('error', 'Gagal menyimpan pengaturan', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof SiteSettings, label: string, control: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={key} className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
        {label}
      </label>
      {control}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
      {errors[key] && (
        <p role="alert" className="mt-1 text-xs text-rose-600">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pengaturan Situs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Perubahan pengaturan tidak otomatis tayang; jalankan publikasi setelah menyimpan. Terakhir diubah:{' '}
            {formatDate(updatedAt)}
          </p>
        </div>
        <button type="button" onClick={save} disabled={busy || !dirty} className={btn.primary}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan pengaturan
        </button>
      </div>

      <section className={`${card} p-5 sm:p-6 space-y-4`}>
        <h2 className="text-sm font-bold">Identitas</h2>
        {field(
          'site_title',
          'Judul situs',
          <input
            id="site_title"
            value={form.site_title}
            maxLength={LIMITS.SITE_TITLE}
            onChange={(e) => set('site_title', e.target.value)}
            className={input}
          />,
        )}
        {field(
          'site_description',
          'Deskripsi situs',
          <textarea
            id="site_description"
            rows={3}
            value={form.site_description}
            maxLength={LIMITS.SITE_DESCRIPTION}
            onChange={(e) => set('site_description', e.target.value)}
            className={input}
          />,
          'Dipakai sebagai meta description beranda dan cadangan untuk halaman tanpa deskripsi.',
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {field(
            'site_language',
            'Bahasa (BCP-47)',
            <input
              id="site_language"
              value={form.site_language}
              onChange={(e) => set('site_language', e.target.value)}
              className={input}
            />,
            'Contoh: id, en, id-ID',
          )}
          {field(
            'posts_per_page',
            'Artikel per halaman',
            <input
              id="posts_per_page"
              type="number"
              min={1}
              max={50}
              value={form.posts_per_page}
              onChange={(e) => set('posts_per_page', Number(e.target.value))}
              className={input}
            />,
          )}
        </div>
        {field(
          'default_author_name',
          'Nama penulis default',
          <input
            id="default_author_name"
            value={form.default_author_name}
            maxLength={LIMITS.AUTHOR}
            onChange={(e) => set('default_author_name', e.target.value)}
            className={input}
          />,
        )}
        {field(
          'footer_text',
          'Teks footer',
          <input
            id="footer_text"
            value={form.footer_text}
            maxLength={LIMITS.FOOTER_TEXT}
            onChange={(e) => set('footer_text', e.target.value)}
            className={input}
          />,
        )}
      </section>

      <section className={`${card} p-5 sm:p-6 space-y-4`}>
        <h2 className="text-sm font-bold">Media</h2>
        <div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Gambar sosial default (og:image)
          </div>
          {social ? (
            <div className="flex items-center gap-3">
              {/* biome-ignore lint/performance/noImgElement: admin-only preview */}
              <img
                src={`/api/media/${social.id}/preview`}
                alt={social.alt_text}
                className="w-32 aspect-video object-cover rounded-lg border border-slate-200 dark:border-slate-800"
              />
              <div className="text-xs text-slate-500 flex-1 truncate">{social.filename}</div>
              <button type="button" onClick={() => set('social_image_media_id', null)} className={btn.ghost}>
                <X className="w-3.5 h-3.5" />
                Lepas
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setPicker(true)} className={btn.secondary}>
              <ImageIcon className="w-4 h-4" />
              Pilih gambar
            </button>
          )}
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.allow_external_images}
            onChange={(e) => set('allow_external_images', e.target.checked)}
            className="mt-1 w-4 h-4 accent-emerald-600"
          />
          <span>
            Izinkan gambar eksternal (https://)
            <span className="block text-xs text-slate-500">
              Bila nonaktif, gambar eksternal dirender sebagai tautan agar situs hanya memuat aset dari domainnya
              sendiri.
            </span>
          </span>
        </label>
      </section>

      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        title="Pilih gambar sosial"
        onPick={(m) => {
          setLibrary((l) => (l.some((x) => x.id === m.id) ? l : [m, ...l]));
          set('social_image_media_id', m.id);
        }}
      />
    </div>
  );
}

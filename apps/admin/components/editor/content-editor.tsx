'use client';

import {
  type ContentKind,
  LIMITS,
  type LiveState,
  type Page,
  type Post,
  type PublishJob,
  type RevisionSummary,
  slugify,
  type Taxon,
  validateSlug,
} from '@zidcms/core';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Copy,
  Eye,
  FileEdit,
  History,
  ImageIcon,
  Loader2,
  RefreshCw,
  Rocket,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/client';
import { formatDate } from '@/lib/format';
import { LiveBadge, StatusBadge } from '../badges';
import { btn, card, input, Modal, useToast } from '../feedback';
import { type MediaItem, MediaPicker } from '../media-picker';
import { usePublish } from '../publish-context';
import { MarkdownEditor } from './markdown-editor';
import { confirmLeave, useUnsavedGuard } from './use-unsaved-guard';

type Item = Post | Page;

interface Form {
  title: string;
  slug: string;
  content_markdown: string;
  excerpt: string;
  author_name: string;
  category_id: string | null;
  tag_ids: string[];
  cover_media_id: string | null;
  seo_title: string;
  seo_description: string;
  nav_order: string;
}

function toForm(item: Item | null, defaultAuthor: string): Form {
  const post = item && 'author_name' in item ? item : null;
  return {
    title: item?.title ?? '',
    slug: item?.slug ?? '',
    content_markdown: item?.content_markdown ?? '',
    excerpt: post?.excerpt ?? '',
    author_name: post?.author_name ?? (item ? '' : defaultAuthor),
    category_id: post?.category_id ?? null,
    tag_ids: post?.tag_ids ?? [],
    cover_media_id: post?.cover_media_id ?? null,
    seo_title: item?.seo_title ?? '',
    seo_description: item?.seo_description ?? '',
    nav_order: item && 'nav_order' in item && item.nav_order !== null ? String(item.nav_order) : '',
  };
}

function toPayload(kind: ContentKind, form: Form): Record<string, unknown> {
  const common = {
    title: form.title,
    slug: form.slug,
    content_markdown: form.content_markdown,
    seo_title: form.seo_title,
    seo_description: form.seo_description,
  };
  if (kind === 'page') return { ...common, nav_order: form.nav_order === '' ? null : Number(form.nav_order) };
  return {
    ...common,
    excerpt: form.excerpt,
    author_name: form.author_name,
    category_id: form.category_id,
    tag_ids: form.tag_ids,
    cover_media_id: form.cover_media_id,
  };
}

function Counter({ value, max, warn }: { value: number; max: number; warn?: number }) {
  const cls = value > max ? 'text-rose-600 font-semibold' : warn && value > warn ? 'text-amber-600' : 'text-slate-400';
  return (
    <span className={`text-[11px] font-mono ${cls}`}>
      {value}/{warn && value <= max ? `${warn} disarankan` : max}
    </span>
  );
}

export interface EditorProps {
  kind: ContentKind;
  item: Item | null;
  liveState: LiveState | null;
  defaultAuthor: string;
  allowExternalImages: boolean;
  publicSiteUrl: string;
  categories: Taxon[];
  tags: Taxon[];
  media: MediaItem[];
}

export function ContentEditor(props: EditorProps) {
  const { kind, defaultAuthor } = props;
  const router = useRouter();
  const toast = useToast();
  const { track } = usePublish();
  const [item, setItem] = useState<Item | null>(props.item);
  const [form, setForm] = useState<Form>(() => toForm(props.item, defaultAuthor));
  const [saved, setSaved] = useState<Form>(() => toForm(props.item, defaultAuthor));
  const [slugTouched, setSlugTouched] = useState(Boolean(props.item));
  const [busy, setBusy] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [picker, setPicker] = useState<'inline' | 'cover' | null>(null);
  const [media, setMedia] = useState(props.media);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [showRevisions, setShowRevisions] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  useUnsavedGuard(dirty);

  const base = kind === 'post' ? '/posts' : '/pages';
  const publicPath = kind === 'post' ? `/blog/${form.slug}/` : `/${form.slug}/`;
  const slugError = form.slug ? validateSlug(form.slug, kind) : null;
  const status = item?.status ?? 'draft';
  const wasLive = props.liveState === 'live' || props.liveState === 'live_pending_update';
  const cover = media.find((m) => m.id === form.cover_media_id) ?? null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => {
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  };

  const setTitle = (title: string) => {
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
  };

  const handleError = (err: unknown, action: string) => {
    if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
      setConflict(true);
      return;
    }
    if (err instanceof ApiError && err.code === 'SLUG_CONFLICT') {
      setFieldErrors({ slug: err.message });
    } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
      const fields = (err.details?.fields ?? []) as { field: string; message: string }[];
      setFieldErrors(Object.fromEntries(fields.map((f) => [f.field, f.message])));
    }
    toast('error', `${action} gagal`, errorMessage(err));
  };

  const applyResult = (next: Item, publishJob?: PublishJob | null) => {
    setItem(next);
    const f = toForm(next, defaultAuthor);
    setForm(f);
    setSaved(f);
    if (publishJob) track(publishJob);
  };

  const save = async (): Promise<Item | null> => {
    const payload = toPayload(kind, form);
    if (!item) {
      const created = await api<Item>('POST', `/api/${kind}s`, payload);
      applyResult(created);
      router.replace(`${base}/${created.id}`);
      return created;
    }
    if (!dirty) return item;
    const result = await api<{ item: Item; publishJob: PublishJob | null }>('PATCH', `/api/${kind}s/${item.id}`, {
      expected_version: item.version,
      patch: payload,
    });
    applyResult(result.item, result.publishJob);
    return result.item;
  };

  const run = async (name: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      handleError(err, name);
    } finally {
      setBusy(null);
    }
  };

  const onSave = () =>
    run('Simpan', async () => {
      const wasPublished = item?.status === 'published';
      await save();
      toast(
        'success',
        wasPublished ? 'Diperbarui — publikasi dimulai' : 'Draf tersimpan',
        wasPublished ? undefined : 'Situs publik tidak berubah.',
      );
      router.refresh();
    });

  const setStatus = (to: 'draft' | 'published' | 'archived', label: string) =>
    run(label, async () => {
      const current = await save();
      if (!current) return;
      const result = await api<{ item: Item; publishJob: PublishJob | null }>(
        'POST',
        `/api/${kind}s/${current.id}/status`,
        {
          expected_version: current.version,
          to,
        },
      );
      applyResult(result.item, result.publishJob);
      toast('success', `${label} berhasil`, result.publishJob ? 'Job publikasi dimulai.' : undefined);
      router.refresh();
    });

  const onDelete = () => {
    if (!item || !window.confirm('Pindahkan item ini ke tempat sampah?')) return;
    void run('Hapus', async () => {
      const result = await api<{ item: Item; publishJob: PublishJob | null }>('DELETE', `/api/${kind}s/${item.id}`, {
        expected_version: item.version,
      });
      if (result.publishJob) track(result.publishJob);
      setSaved(form);
      toast(
        'success',
        'Dipindahkan ke sampah',
        result.publishJob ? 'Job publikasi dimulai untuk menghapus dari situs.' : undefined,
      );
      router.push(`${base}?status=trash`);
      router.refresh();
    });
  };

  const openRevisions = async () => {
    setShowRevisions(true);
    if (!item) return;
    try {
      setRevisions(await api<RevisionSummary[]>('GET', `/api/${kind}s/${item.id}/revisions`));
    } catch (err) {
      toast('error', 'Gagal memuat riwayat', errorMessage(err));
    }
  };

  const insertMedia = (m: MediaItem) => {
    setMedia((list) => (list.some((x) => x.id === m.id) ? list : [m, ...list]));
    if (picker === 'cover') set('cover_media_id', m.id);
    else
      set(
        'content_markdown',
        `${form.content_markdown}${form.content_markdown.endsWith('\n') || !form.content_markdown ? '' : '\n\n'}![${m.alt_text}](zid-media:${m.id})\n`,
      );
  };

  const err = (field: string) =>
    fieldErrors[field] ? (
      <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
        {fieldErrors[field]}
      </p>
    ) : null;

  const primary = (() => {
    if (!item || status === 'draft') {
      return (
        <>
          <button type="button" onClick={onSave} disabled={Boolean(busy)} className={btn.secondary}>
            {busy === 'Simpan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan draf
          </button>
          <button
            type="button"
            onClick={() => setStatus('published', 'Terbitkan')}
            disabled={Boolean(busy)}
            className={btn.primary}
          >
            {busy === 'Terbitkan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Terbitkan
          </button>
        </>
      );
    }
    if (status === 'published') {
      return (
        <>
          <button
            type="button"
            onClick={() => setStatus('draft', 'Batalkan terbit')}
            disabled={Boolean(busy)}
            className={btn.warning}
          >
            {busy === 'Batalkan terbit' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileEdit className="w-4 h-4" />
            )}
            Batalkan terbit
          </button>
          <button type="button" onClick={onSave} disabled={Boolean(busy) || !dirty} className={btn.primary}>
            {busy === 'Simpan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Perbarui
          </button>
        </>
      );
    }
    return (
      <>
        <button type="button" onClick={onSave} disabled={Boolean(busy) || !dirty} className={btn.secondary}>
          <Save className="w-4 h-4" />
          Simpan
        </button>
        <button
          type="button"
          onClick={() => setStatus('draft', 'Pindahkan ke draf')}
          disabled={Boolean(busy)}
          className={btn.primary}
        >
          {busy === 'Pindahkan ke draf' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileEdit className="w-4 h-4" />
          )}
          Pindahkan ke draf
        </button>
      </>
    );
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (!confirmLeave(dirty)) return;
              setSaved(form);
              router.push(base);
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            aria-label="Kembali ke daftar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                {item
                  ? kind === 'post'
                    ? 'Edit artikel'
                    : 'Edit halaman'
                  : kind === 'post'
                    ? 'Artikel baru'
                    : 'Halaman baru'}
              </h1>
              {item && <StatusBadge status={item.status} />}
              {props.liveState && <LiveBadge state={props.liveState} />}
              {item && <span className="text-xs font-mono text-slate-400">v{item.version}</span>}
              {dirty && <span className="text-xs font-semibold text-amber-600">● belum disimpan</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {item ? `Diperbarui ${formatDate(item.updated_at)}` : 'Belum disimpan ke Google Sheets.'}
              {status === 'published' && ' · Memperbarui akan langsung mempublikasikan perubahan.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item && (
            <>
              <button type="button" onClick={openRevisions} className={btn.ghost}>
                <History className="w-3.5 h-3.5" />
                Riwayat
              </button>
              <Link href={`/preview/${kind}s/${item.id}`} target="_blank" className={btn.ghost}>
                <Eye className="w-3.5 h-3.5" />
                Pratinjau
              </Link>
            </>
          )}
          {primary}
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-5">
          <div className={`${card} p-5 space-y-4`}>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Judul
                </label>
                <Counter value={form.title.length} max={LIMITS.TITLE} />
              </div>
              <input
                id="title"
                value={form.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul yang menarik…"
                className="w-full px-0 py-1 bg-transparent text-2xl font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none"
              />
              {err('title')}
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="slug" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Slug URL
                </label>
                {!slugTouched || !item ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSlugTouched(false);
                      set('slug', slugify(form.title));
                    }}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Buat dari judul
                  </button>
                ) : null}
              </div>
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/50">
                <span className="px-3 py-2 text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                  {kind === 'post' ? '/blog/' : '/'}
                </span>
                <input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', e.target.value.toLowerCase());
                  }}
                  className="flex-1 px-3 py-2 bg-transparent font-mono text-sm focus:outline-none"
                />
                <span className="px-3 py-2 text-xs font-mono text-slate-400">/</span>
              </div>
              {slugError && <p className="mt-1 text-xs text-rose-600">{slugError}</p>}
              {err('slug')}
              {wasLive && item && form.slug !== item.slug && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Mengubah slug item yang sudah tayang memutus URL lama (
                    <code className="font-mono">{kind === 'post' ? `/blog/${item.slug}/` : `/${item.slug}/`}</code>).
                    ZidCMS belum mendukung redirect.
                  </span>
                </div>
              )}
            </div>
          </div>

          <MarkdownEditor
            value={form.content_markdown}
            onChange={(v) => set('content_markdown', v)}
            onInsertImage={() => setPicker('inline')}
            allowExternalImages={props.allowExternalImages}
          />
          {err('content_markdown')}
        </div>

        <div className="space-y-4">
          {kind === 'post' ? (
            <>
              <section className={`${card} p-5 space-y-3`}>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Gambar sampul</h2>
                {cover ? (
                  <div className="space-y-2">
                    {/* biome-ignore lint/performance/noImgElement: admin-only preview */}
                    <img
                      src={`/api/media/${cover.id}/preview`}
                      alt={cover.alt_text}
                      className="aspect-video w-full object-cover rounded-xl border border-slate-200 dark:border-slate-800"
                    />
                    <div className="text-xs text-slate-500 truncate">{cover.filename}</div>
                    {!cover.alt_text && (
                      <p className="text-xs text-amber-600">Media ini belum memiliki teks alternatif.</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPicker('cover')}
                        className={`${btn.ghost} flex-1 border border-slate-200 dark:border-slate-700`}
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={() => set('cover_media_id', null)}
                        className={`${btn.ghost} text-rose-600`}
                      >
                        <X className="w-3.5 h-3.5" />
                        Lepas
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPicker('cover')}
                    className="w-full py-7 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-xs font-medium text-slate-500 flex flex-col items-center gap-1.5"
                  >
                    <ImageIcon className="w-5 h-5" />
                    Pilih dari Pustaka Media
                  </button>
                )}
              </section>

              <section className={`${card} p-5 space-y-4`}>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Metadata artikel</h2>
                <div>
                  <label htmlFor="author" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Nama penulis
                  </label>
                  <input
                    id="author"
                    value={form.author_name}
                    onChange={(e) => set('author_name', e.target.value)}
                    placeholder={defaultAuthor || 'Penulis'}
                    className={input}
                  />
                  {err('author_name')}
                </div>
                <div>
                  <label
                    htmlFor="category"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Kategori
                  </label>
                  <select
                    id="category"
                    value={form.category_id ?? ''}
                    onChange={(e) => set('category_id', e.target.value || null)}
                    className={input}
                  >
                    <option value="">— Tanpa kategori —</option>
                    {props.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <fieldset>
                  <legend className="flex w-full justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    <span>Tag</span>
                    <span className="font-mono text-slate-400">
                      {form.tag_ids.length}/{LIMITS.TAGS_PER_POST}
                    </span>
                  </legend>
                  {props.tags.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Belum ada tag.{' '}
                      <Link href="/taxonomy" className="text-emerald-600 hover:underline">
                        Buat tag
                      </Link>
                      .
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {props.tags.map((t) => {
                        const on = form.tag_ids.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              set('tag_ids', on ? form.tag_ids.filter((x) => x !== t.id) : [...form.tag_ids, t.id])
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              on
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            #{t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="excerpt" className="font-medium text-slate-600 dark:text-slate-400">
                      Ringkasan (kosong = otomatis)
                    </label>
                    <Counter value={form.excerpt.length} max={LIMITS.EXCERPT} />
                  </div>
                  <textarea
                    id="excerpt"
                    rows={3}
                    value={form.excerpt}
                    onChange={(e) => set('excerpt', e.target.value)}
                    className={input}
                  />
                  {err('excerpt')}
                </div>
              </section>
            </>
          ) : (
            <section className={`${card} p-5 space-y-3`}>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Navigasi</h2>
              <label htmlFor="nav" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Urutan di menu header (kosong = tidak tampil)
              </label>
              <input
                id="nav"
                type="number"
                min={0}
                max={9999}
                value={form.nav_order}
                onChange={(e) => set('nav_order', e.target.value)}
                className={input}
              />
              {err('nav_order')}
            </section>
          )}

          <section className={`${card} p-5 space-y-4`}>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">SEO & Open Graph</h2>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="seo-title" className="font-medium text-slate-600 dark:text-slate-400">
                  Judul SEO
                </label>
                <Counter value={form.seo_title.length} max={LIMITS.SEO_TITLE} warn={LIMITS.SEO_TITLE_WARN} />
              </div>
              <input
                id="seo-title"
                value={form.seo_title}
                onChange={(e) => set('seo_title', e.target.value)}
                placeholder={form.title}
                className={input}
              />
              {err('seo_title')}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="seo-desc" className="font-medium text-slate-600 dark:text-slate-400">
                  Deskripsi SEO
                </label>
                <Counter value={form.seo_description.length} max={LIMITS.SEO_DESC} warn={LIMITS.SEO_DESC_WARN} />
              </div>
              <textarea
                id="seo-desc"
                rows={3}
                value={form.seo_description}
                onChange={(e) => set('seo_description', e.target.value)}
                className={input}
              />
              {err('seo_description')}
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-slate-400">Pratinjau hasil pencarian</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                {props.publicSiteUrl.replace(/^https?:\/\//, '')}
                {publicPath}
              </div>
              <div className="text-sm font-semibold text-blue-700 dark:text-sky-400 line-clamp-1">
                {form.seo_title || form.title || 'Judul halaman'}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {form.seo_description || form.excerpt || 'Deskripsi akan diambil dari ringkasan atau deskripsi situs.'}
              </div>
            </div>
          </section>

          {item && (
            <div className={`${card} p-4 flex items-center justify-between gap-2`}>
              {status !== 'archived' ? (
                <button
                  type="button"
                  onClick={() => setStatus('archived', 'Arsipkan')}
                  disabled={Boolean(busy)}
                  className={btn.ghost}
                >
                  <Archive className="w-3.5 h-3.5" />
                  Arsipkan
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onDelete}
                disabled={Boolean(busy)}
                className={`${btn.danger} px-3 py-2 text-xs`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Pindahkan ke sampah
              </button>
            </div>
          )}
        </div>
      </div>

      <MediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPick={insertMedia}
        title={picker === 'cover' ? 'Pilih gambar sampul' : 'Sisipkan gambar ke konten'}
      />

      <Modal
        open={conflict}
        onClose={() => setConflict(false)}
        title="Item ini telah diubah di tempat lain"
        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        footer={
          <>
            <button
              type="button"
              className={btn.secondary}
              onClick={async () => {
                await navigator.clipboard.writeText(`# ${form.title}\n\n${form.content_markdown}`);
                toast('success', 'Konten Anda disalin ke clipboard');
              }}
            >
              <Copy className="w-4 h-4" />
              Salin konten saya
            </button>
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                setSaved(form);
                window.location.reload();
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Muat ulang (buang perubahan saya)
            </button>
          </>
        }
      >
        <p>
          Versi di Google Sheets lebih baru daripada versi yang Anda edit (v{item?.version}). ZidCMS tidak menggabungkan
          perubahan secara diam-diam. Salin konten Anda terlebih dahulu bila perlu, lalu muat ulang.
        </p>
      </Modal>

      <Modal
        open={showRevisions}
        onClose={() => setShowRevisions(false)}
        title="Riwayat revisi"
        icon={<History className="w-5 h-5 text-emerald-500" />}
      >
        {revisions === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        ) : (
          <ol className="space-y-2 max-h-[55vh] overflow-y-auto">
            {revisions.map((r) => (
              <li
                key={r.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
              >
                <div className="flex justify-between text-xs">
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">v{r.version}</span>
                  <span className="text-slate-500">{formatDate(r.created_at)}</span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{r.title}</div>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </div>
  );
}

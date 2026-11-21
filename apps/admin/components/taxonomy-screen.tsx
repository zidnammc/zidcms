'use client';

import { slugify, type Taxon, type TaxonomyKind } from '@zidcms/core';
import { Check, FolderOpen, Hash, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { btn, card, input, useToast } from './feedback';
import { usePublish } from './publish-context';

function TaxonColumn({ kind, items }: { kind: TaxonomyKind; items: Taxon[] }) {
  const endpoint = kind === 'category' ? '/api/categories' : '/api/tags';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string; slug: string; description: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const { markPending } = usePublish();

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast('success', success, 'Perubahan taksonomi tayang setelah publikasi berikutnya.');
      markPending();
      router.refresh();
      return true;
    } catch (err) {
      toast('error', 'Gagal', errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const Icon = kind === 'category' ? FolderOpen : Hash;
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Icon className="w-4 h-4 text-emerald-500" />
        <h2 className="text-base font-bold">{kind === 'category' ? 'Kategori' : 'Tag'}</h2>
        <span className="text-xs font-mono text-slate-400">{items.length}</span>
      </div>
      <form
        className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              'create',
              () => api('POST', endpoint, { name, description }),
              `${kind === 'category' ? 'Kategori' : 'Tag'} dibuat`,
            )
          ) {
            setName('');
            setDescription('');
          }
        }}
      >
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'category' ? 'Nama kategori baru' : 'Nama tag baru'}
            aria-label="Nama"
            className={input}
            required
            maxLength={60}
          />
          <button type="submit" disabled={busy !== null || !name.trim()} className={btn.primary}>
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Tambah
          </button>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsi (opsional)"
          aria-label="Deskripsi"
          className={input}
          maxLength={300}
        />
        {name && (
          <p className="text-[11px] font-mono text-slate-400">
            /{kind}/{slugify(name)}/
          </p>
        )}
      </form>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {items.length === 0 && <li className="px-5 py-6 text-center text-xs text-slate-500">Belum ada data.</li>}
        {items.map((t) =>
          editing?.id === t.id ? (
            <li key={t.id} className="p-4 space-y-2 bg-slate-50/70 dark:bg-slate-950/40">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                aria-label="Nama"
                className={input}
              />
              <input
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                aria-label="Slug"
                className={`${input} font-mono`}
              />
              <input
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                aria-label="Deskripsi"
                className={input}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className={btn.ghost}>
                  <X className="w-3.5 h-3.5" />
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    const { id: _id, ...patch } = editing;
                    if (
                      await run(
                        t.id,
                        () => api('PATCH', `${endpoint}/${t.id}`, { expected_version: t.version, patch }),
                        'Disimpan',
                      )
                    )
                      setEditing(null);
                  }}
                  className={btn.primary}
                >
                  {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </li>
          ) : (
            <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{t.name}</div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  /{kind}/{t.slug}/{t.description ? ` · ${t.description}` : ''}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing({ id: t.id, name: t.name, slug: t.slug, description: t.description })}
                  className={btn.ghost}
                  aria-label={`Ubah ${t.name}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Hapus "${t.name}"? Artikel yang memakainya tidak lagi menampilkannya setelah publikasi.`,
                      )
                    ) {
                      void run(
                        t.id,
                        () => api('DELETE', `${endpoint}/${t.id}`, { expected_version: t.version }),
                        'Dihapus',
                      );
                    }
                  }}
                  className={`${btn.ghost} text-rose-600`}
                  aria-label={`Hapus ${t.name}`}
                >
                  {busy === t.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

export function TaxonomyScreen({ categories, tags }: { categories: Taxon[]; tags: Taxon[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Kategori & Tag</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Satu kategori per artikel, hingga 20 tag. Arsip publik tersedia di /category/&lt;slug&gt;/ dan
          /tag/&lt;slug&gt;/.
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <TaxonColumn kind="category" items={categories} />
        <TaxonColumn kind="tag" items={tags} />
      </div>
    </div>
  );
}

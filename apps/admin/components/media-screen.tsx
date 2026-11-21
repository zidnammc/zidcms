'use client';

import { Check, Copy, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { formatBytes, formatDate } from '@/lib/format';
import { btn, card, input, useToast } from './feedback';
import { type MediaItem, UploadButton, useUpload } from './media-picker';

function MediaCard({ item }: { item: MediaItem }) {
  const [alt, setAlt] = useState(item.alt_text);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const reference = `![${alt}](zid-media:${item.id})`;
  const saveAlt = async () => {
    setBusy(true);
    try {
      await api('PATCH', `/api/media/${item.id}`, { expected_version: item.version, alt_text: alt });
      toast('success', 'Teks alternatif disimpan');
      router.refresh();
    } catch (err) {
      toast('error', 'Gagal menyimpan', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`${card} overflow-hidden flex flex-col`}>
      {/* biome-ignore lint/performance/noImgElement: admin-only preview of private Drive media */}
      <img
        src={`/api/media/${item.id}/preview`}
        alt={item.alt_text}
        loading="lazy"
        className="w-full aspect-video object-cover bg-slate-100 dark:bg-slate-800"
      />
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="text-sm font-semibold truncate" title={item.filename}>
          {item.filename}
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          {item.mime_type.replace('image/', '')} · {formatBytes(item.size_bytes)}
          {item.width && item.height ? ` · ${item.width}×${item.height}` : ''} · {item.sha256.slice(0, 10)}
        </div>
        <div className="text-[11px] text-slate-400">{formatDate(item.created_at)}</div>
        <label htmlFor={`alt-${item.id}`} className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Teks alternatif {!item.alt_text && <span className="text-amber-600">(belum diisi)</span>}
        </label>
        <div className="flex gap-1.5">
          <input
            id={`alt-${item.id}`}
            value={alt}
            maxLength={300}
            onChange={(e) => setAlt(e.target.value)}
            className={`${input} text-xs py-1.5`}
          />
          <button
            type="button"
            disabled={busy || alt === item.alt_text}
            onClick={saveAlt}
            className={btn.ghost}
            aria-label="Simpan teks alternatif"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(reference);
            toast('success', 'Referensi disalin', reference);
          }}
          className={`${btn.ghost} mt-auto border border-slate-200 dark:border-slate-700`}
        >
          <Copy className="w-3.5 h-3.5" />
          Salin referensi Markdown
        </button>
      </div>
    </li>
  );
}

export function MediaScreen({ items }: { items: MediaItem[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const { upload, uploading } = useUpload(() => router.refresh());
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Pustaka Media</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Disimpan privat di Google Drive. Saat publikasi, gambar yang dirujuk disalin ke build statis
            (/media/&lt;sha256&gt;).
          </p>
        </div>
        <UploadButton onUploaded={() => router.refresh()} />
      </div>
      <section
        aria-label="Area unggah"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
        className={`p-6 rounded-2xl border-2 border-dashed text-center text-sm transition-colors ${
          dragging
            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
            : 'border-slate-200 dark:border-slate-800 text-slate-500'
        }`}
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <Upload className="w-5 h-5 mx-auto mb-1" />}
        Seret & lepas gambar di sini — JPEG, PNG, WebP, GIF, maks. 3 MB. SVG ditolak.
      </section>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        Tipe berkas diverifikasi dari magic bytes; duplikat dideteksi lewat sha256.
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Belum ada media.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((m) => (
            <MediaCard key={`${m.id}-${m.version}`} item={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

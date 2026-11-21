'use client';

import type { Media } from '@zidcms/core';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { formatBytes } from '@/lib/format';
import { btn, Modal, useToast } from './feedback';

export type MediaItem = Omit<Media, 'drive_file_id'>;

export function useUpload(onUploaded: (item: MediaItem) => void) {
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const upload = async (file: File, altText = '') => {
    if (file.size > 3 * 1024 * 1024) {
      toast('error', 'Berkas terlalu besar', 'Ukuran maksimal 3 MB.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('alt_text', altText);
      const result = await api<{ item: MediaItem; deduplicated: boolean }>('POST', '/api/media', form);
      toast(
        'success',
        result.deduplicated ? 'Media sudah ada (deduplikasi sha256)' : 'Media diunggah ke Drive',
        result.item.filename,
      );
      onUploaded(result.item);
    } catch (err) {
      toast('error', 'Unggah gagal', errorMessage(err));
    } finally {
      setUploading(false);
    }
  };
  return { upload, uploading };
}

export function UploadButton({
  onUploaded,
  label = 'Unggah gambar',
}: {
  onUploaded: (item: MediaItem) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useUpload(onUploaded);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
      <button type="button" disabled={uploading} onClick={() => ref.current?.click()} className={btn.secondary}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {label}
      </button>
    </>
  );
}

export function MediaPicker({
  open,
  onClose,
  onPick,
  title = 'Pilih media',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: MediaItem) => void;
  title?: string;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const toast = useToast();
  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: MediaItem[] }>('GET', '/api/media')).items);
    } catch (err) {
      toast('error', 'Gagal memuat media', errorMessage(err));
      setItems([]);
    }
  }, [toast]);
  useEffect(() => {
    if (open && items === null) void load();
  }, [open, items, load]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={<ImagePlus className="w-5 h-5 text-emerald-500" />}
      footer={
        <UploadButton
          onUploaded={(item) => setItems((list) => [item, ...(list ?? []).filter((m) => m.id !== item.id)])}
        />
      }
    >
      {items === null ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          Belum ada media. Unggah gambar JPEG, PNG, WebP, atau GIF (≤ 3 MB).
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto p-1">
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onPick(m);
                onClose();
              }}
              className="text-left rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:ring-2 hover:ring-emerald-500 focus:ring-2 focus:ring-emerald-500"
            >
              {/* biome-ignore lint/performance/noImgElement: admin-only preview of private Drive media */}
              <img
                src={`/api/media/${m.id}/preview`}
                alt={m.alt_text}
                loading="lazy"
                className="w-full aspect-video object-cover bg-slate-100 dark:bg-slate-800"
              />
              <div className="p-2">
                <div className="text-xs font-medium truncate">{m.filename}</div>
                <div className="text-[10px] text-slate-500">
                  {formatBytes(m.size_bytes)}
                  {m.alt_text ? '' : ' · tanpa alt'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

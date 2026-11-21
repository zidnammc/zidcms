import {
  imageDimensions,
  isUuid,
  LIMITS,
  MEDIA_MIME_TYPES,
  MEDIA_UPDATE_INPUT,
  type Media,
  type MediaMime,
  sanitizeFilename,
  sha256Hex,
  sniffImageMime,
  validateInput,
  validationError,
  ZidError,
} from '@zidcms/core';
import type { Ctx } from '../ports';
import { appendRecord, audit, loadTable, writeEntry } from '../table';
import { checkVersion, requireId, requireVersion } from './content';

function payloadObj(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) throw new ZidError('BAD_REQUEST', 'Payload tidak valid.');
  return payload as Record<string, unknown>;
}

export function activeMedia(ctx: Ctx): Media[] {
  return loadTable<Media>(ctx.sheets, 'Media')
    .entries.map((e) => e.record)
    .filter((m) => !m.deleted_at);
}

export const mediaActions = {
  'media.upload': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = payloadObj(payload);
      const mime = p.mime as MediaMime;
      if (!(MEDIA_MIME_TYPES as readonly string[]).includes(mime)) {
        throw new ZidError('UNSUPPORTED_MEDIA_TYPE', 'Hanya JPEG, PNG, WebP, dan GIF yang diizinkan.');
      }
      if (typeof p.base64 !== 'string' || typeof p.filename !== 'string' || typeof p.sha256 !== 'string') {
        throw new ZidError('BAD_REQUEST', 'filename, sha256, dan base64 wajib diisi.');
      }
      const altText = typeof p.alt_text === 'string' ? p.alt_text.trim() : '';
      if (altText.length > LIMITS.ALT_TEXT) {
        throw new ZidError('VALIDATION_ERROR', `Teks alternatif maksimal ${LIMITS.ALT_TEXT} karakter.`);
      }
      const bytes = ctx.runtime.base64ToBytes(p.base64);
      if (bytes.length === 0) throw new ZidError('BAD_REQUEST', 'Berkas kosong.');
      if (bytes.length > LIMITS.MEDIA_BYTES) throw new ZidError('PAYLOAD_TOO_LARGE', 'Ukuran berkas maksimal 3 MB.');
      if (sniffImageMime(bytes) !== mime) {
        throw new ZidError('UNSUPPORTED_MEDIA_TYPE', 'Isi berkas tidak cocok dengan tipe gambar yang diizinkan.');
      }
      const sha256 = sha256Hex(bytes);
      if (sha256 !== p.sha256.toLowerCase()) throw new ZidError('BAD_REQUEST', 'Checksum berkas tidak cocok.');
      const table = loadTable<Media>(ctx.sheets, 'Media');
      const existing = table.entries.find((e) => e.record.sha256 === sha256 && !e.record.deleted_at);
      if (existing) return { item: existing.record, deduplicated: true };
      const filename = sanitizeFilename(p.filename);
      const dims = imageDimensions(bytes, mime);
      const item: Media = {
        id: ctx.runtime.uuid(),
        drive_file_id: ctx.media.create(filename, mime, bytes),
        filename,
        mime_type: mime,
        size_bytes: bytes.length,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        sha256,
        alt_text: altText,
        created_at: ctx.nowIso,
        created_by: ctx.actor,
        deleted_at: null,
        version: 1,
      };
      appendRecord(ctx.sheets, table, item);
      audit(ctx, 'media.upload', 'media', item.id, 'ok', `${mime} ${bytes.length}B`);
      return { item, deduplicated: false };
    },
  },
  'media.list': {
    lock: false,
    run(ctx: Ctx) {
      const items = activeMedia(ctx).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { items: items.map(({ drive_file_id: _d, ...rest }) => rest) };
    },
  },
  'media.update': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = payloadObj(payload);
      const id = requireId(p);
      const expected = requireVersion(p);
      const { value, errors } = validateInput(MEDIA_UPDATE_INPUT, p.patch ?? {}, { partial: true });
      if (errors.length) throw validationError(errors);
      const table = loadTable<Media>(ctx.sheets, 'Media');
      const entry = table.entries.find((e) => e.record.id === id && !e.record.deleted_at);
      if (!entry) throw new ZidError('NOT_FOUND', 'Media tidak ditemukan.');
      checkVersion(entry.record, expected);
      const next: Media = { ...entry.record, ...value, version: entry.record.version + 1 };
      writeEntry(ctx.sheets, table, entry, next);
      audit(ctx, 'media.update', 'media', id, 'ok', `v${next.version}`);
      const { drive_file_id: _d, ...rest } = next;
      return rest;
    },
  },
  'media.getBytes': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      const p = payloadObj(payload);
      if (!isUuid(p.id)) throw new ZidError('BAD_REQUEST', 'ID tidak valid.');
      const media = loadTable<Media>(ctx.sheets, 'Media').entries.find((e) => e.record.id === p.id)?.record;
      if (!media) throw new ZidError('NOT_FOUND', 'Media tidak ditemukan.');
      return { base64: ctx.media.getBase64(media.drive_file_id), mime: media.mime_type, sha256: media.sha256 };
    },
  },
};

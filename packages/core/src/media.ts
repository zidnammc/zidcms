import { LIMITS, type MediaMime } from './limits';

export function sniffImageMime(bytes: Uint8Array): MediaMime | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  ) {
    return 'image/png';
  }
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  return null;
}

export function imageDimensions(bytes: Uint8Array, mime: MediaMime): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    switch (mime) {
      case 'image/png':
        return { width: view.getUint32(16), height: view.getUint32(20) };
      case 'image/gif':
        return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
      case 'image/webp': {
        const chunk = String.fromCharCode(...bytes.subarray(12, 16));
        if (chunk === 'VP8X') {
          const w = 1 + (view.getUint16(24, true) | (view.getUint8(26) << 16));
          const h = 1 + (view.getUint16(27, true) | (view.getUint8(29) << 16));
          return { width: w, height: h };
        }
        if (chunk === 'VP8 ') {
          return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
        }
        if (chunk === 'VP8L') {
          const b = view.getUint32(21, true);
          return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
        }
        return null;
      }
      case 'image/jpeg': {
        let offset = 2;
        while (offset + 9 < bytes.length) {
          if (view.getUint8(offset) !== 0xff) return null;
          const marker = view.getUint8(offset + 1);
          const length = view.getUint16(offset + 2);
          if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
          }
          offset += 2 + length;
        }
        return null;
      }
    }
  } catch {
    return null;
  }
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return (cleaned || 'image').slice(0, LIMITS.FILENAME);
}

import type { FieldError } from './errors';
import { LIMITS } from './limits';
import { type SlugNamespace, validateSlug } from './slug';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCP47 = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;

export type FieldSpec =
  | { type: 'string'; max: number; min?: number; label: string }
  | { type: 'slug'; label: string }
  | { type: 'id'; label: string }
  | { type: 'ids'; max: number; label: string }
  | { type: 'int'; min: number; max: number; nullable?: boolean; label: string }
  | { type: 'iso'; label: string }
  | { type: 'bool'; label: string }
  | { type: 'lang'; label: string };

export type InputSpec = Record<string, FieldSpec>;

const seo = {
  seo_title: { type: 'string', max: LIMITS.SEO_TITLE, label: 'Judul SEO' },
  seo_description: { type: 'string', max: LIMITS.SEO_DESC, label: 'Deskripsi SEO' },
} as const satisfies InputSpec;

export const POST_INPUT = {
  title: { type: 'string', min: 1, max: LIMITS.TITLE, label: 'Judul' },
  slug: { type: 'slug', label: 'Slug' },
  content_markdown: { type: 'string', max: LIMITS.BODY, label: 'Konten' },
  excerpt: { type: 'string', max: LIMITS.EXCERPT, label: 'Ringkasan' },
  author_name: { type: 'string', max: LIMITS.AUTHOR, label: 'Nama penulis' },
  category_id: { type: 'id', label: 'Kategori' },
  tag_ids: { type: 'ids', max: LIMITS.TAGS_PER_POST, label: 'Tag' },
  cover_media_id: { type: 'id', label: 'Gambar sampul' },
  published_at: { type: 'iso', label: 'Tanggal terbit' },
  ...seo,
} as const satisfies InputSpec;

export const PAGE_INPUT = {
  title: { type: 'string', min: 1, max: LIMITS.TITLE, label: 'Judul' },
  slug: { type: 'slug', label: 'Slug' },
  content_markdown: { type: 'string', max: LIMITS.BODY, label: 'Konten' },
  nav_order: { type: 'int', min: 0, max: 9999, nullable: true, label: 'Urutan navigasi' },
  published_at: { type: 'iso', label: 'Tanggal terbit' },
  ...seo,
} as const satisfies InputSpec;

export const TAXON_INPUT = {
  name: { type: 'string', min: 1, max: LIMITS.TAXONOMY_NAME, label: 'Nama' },
  slug: { type: 'slug', label: 'Slug' },
  description: { type: 'string', max: LIMITS.TAXONOMY_DESC, label: 'Deskripsi' },
} as const satisfies InputSpec;

export const SETTINGS_INPUT = {
  site_title: { type: 'string', min: 1, max: LIMITS.SITE_TITLE, label: 'Judul situs' },
  site_description: { type: 'string', max: LIMITS.SITE_DESCRIPTION, label: 'Deskripsi situs' },
  site_language: { type: 'lang', label: 'Bahasa situs' },
  posts_per_page: { type: 'int', min: 1, max: 50, label: 'Artikel per halaman' },
  default_author_name: { type: 'string', max: LIMITS.AUTHOR, label: 'Penulis default' },
  social_image_media_id: { type: 'id', label: 'Gambar sosial' },
  footer_text: { type: 'string', max: LIMITS.FOOTER_TEXT, label: 'Teks footer' },
  allow_external_images: { type: 'bool', label: 'Gambar eksternal' },
} as const satisfies InputSpec;

export const MEDIA_UPDATE_INPUT = {
  alt_text: { type: 'string', max: LIMITS.ALT_TEXT, label: 'Teks alternatif' },
} as const satisfies InputSpec;

export interface ValidateOptions {
  partial: boolean;
  namespace?: SlugNamespace;
  required?: string[];
}

export interface ValidationResult {
  value: Record<string, unknown>;
  errors: FieldError[];
}

function checkField(
  field: string,
  spec: FieldSpec,
  raw: unknown,
  namespace: SlugNamespace | undefined,
): { value?: unknown; error?: FieldError } {
  const fail = (code: string, message: string) => ({ error: { field, code, message } });
  switch (spec.type) {
    case 'string': {
      if (typeof raw !== 'string') return fail('type', `${spec.label} harus berupa teks.`);
      const value = field === 'content_markdown' ? raw.replace(/\r\n/g, '\n') : raw.trim();
      if (spec.min && value.length < spec.min) return fail('required', `${spec.label} wajib diisi.`);
      if (value.length > spec.max) {
        return fail('too_long', `${spec.label} maksimal ${spec.max.toLocaleString('id-ID')} karakter.`);
      }
      return { value };
    }
    case 'slug': {
      if (typeof raw !== 'string') return fail('type', `${spec.label} harus berupa teks.`);
      const message = validateSlug(raw, namespace ?? 'post');
      return message ? fail('invalid_slug', message) : { value: raw };
    }
    case 'id':
      if (raw === null || raw === '') return { value: null };
      return typeof raw === 'string' && UUID_PATTERN.test(raw)
        ? { value: raw.toLowerCase() }
        : fail('invalid_id', `${spec.label} tidak valid.`);
    case 'ids': {
      if (!Array.isArray(raw)) return fail('type', `${spec.label} harus berupa daftar.`);
      if (raw.length > spec.max) return fail('too_many', `${spec.label} maksimal ${spec.max}.`);
      if (!raw.every((id) => typeof id === 'string' && UUID_PATTERN.test(id))) {
        return fail('invalid_id', `${spec.label} berisi ID tidak valid.`);
      }
      return { value: [...new Set(raw.map((id: string) => id.toLowerCase()))] };
    }
    case 'int':
      if (spec.nullable && (raw === null || raw === '')) return { value: null };
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < spec.min || raw > spec.max) {
        return fail('out_of_range', `${spec.label} harus bilangan bulat ${spec.min}–${spec.max}.`);
      }
      return { value: raw };
    case 'iso':
      if (raw === null || raw === '') return { value: null };
      return typeof raw === 'string' && ISO_PATTERN.test(raw) && !Number.isNaN(Date.parse(raw))
        ? { value: raw }
        : fail('invalid_date', `${spec.label} harus format ISO 8601 UTC.`);
    case 'bool':
      return typeof raw === 'boolean' ? { value: raw } : fail('type', `${spec.label} harus boolean.`);
    case 'lang':
      return typeof raw === 'string' && BCP47.test(raw)
        ? { value: raw }
        : fail('invalid_lang', `${spec.label} harus kode BCP-47 (mis. "id" atau "en").`);
  }
}

export function validateInput(spec: InputSpec, raw: unknown, options: ValidateOptions): ValidationResult {
  const errors: FieldError[] = [];
  const value: Record<string, unknown> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { value, errors: [{ field: '_', code: 'type', message: 'Data masukan harus berupa objek.' }] };
  }
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!(key in spec)) errors.push({ field: key, code: 'unknown_field', message: `Field "${key}" tidak dikenal.` });
  }
  for (const [field, fieldSpec] of Object.entries(spec)) {
    if (!(field in input) || input[field] === undefined) {
      const required = options.required?.includes(field);
      if (required && !options.partial) {
        errors.push({ field, code: 'required', message: `${fieldSpec.label} wajib diisi.` });
      }
      continue;
    }
    const result = checkField(field, fieldSpec, input[field], options.namespace);
    if (result.error) errors.push(result.error);
    else value[field] = result.value;
  }
  return { value, errors };
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value);
}

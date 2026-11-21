import {
  slugify,
  TAXON_INPUT,
  type Taxon,
  type TaxonomyKind,
  validateInput,
  validationError,
  ZidError,
} from '@zidcms/core';
import type { Ctx } from '../ports';
import { appendRecord, audit, loadTable, writeEntry } from '../table';
import { assertSlugFree, checkVersion, requireId, requireVersion } from './content';

function kindOf(payload: Record<string, unknown>): TaxonomyKind {
  if (payload.kind !== 'category' && payload.kind !== 'tag') {
    throw new ZidError('BAD_REQUEST', 'kind harus "category" atau "tag".');
  }
  return payload.kind;
}

const sheetOf = (kind: TaxonomyKind) => (kind === 'category' ? 'Categories' : 'Tags');

function payloadObj(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) throw new ZidError('BAD_REQUEST', 'Payload tidak valid.');
  return payload as Record<string, unknown>;
}

export function listTaxa(ctx: Ctx, kind: TaxonomyKind): Taxon[] {
  return loadTable<Taxon>(ctx.sheets, sheetOf(kind))
    .entries.map((e) => e.record)
    .filter((t) => !t.deleted_at)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const taxonomyActions = {
  'taxonomy.list': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      const kind = kindOf(payloadObj(payload));
      return { items: listTaxa(ctx, kind) };
    },
  },
  'taxonomy.create': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = payloadObj(payload);
      const kind = kindOf(p);
      const input = { ...(p.fields as Record<string, unknown>) };
      if (typeof input.name === 'string' && !input.slug) input.slug = slugify(input.name);
      const { value, errors } = validateInput(TAXON_INPUT, input, {
        partial: false,
        namespace: kind,
        required: ['name', 'slug'],
      });
      if (errors.length) throw validationError(errors);
      const table = loadTable<Taxon>(ctx.sheets, sheetOf(kind));
      assertSlugFree(table, value.slug as string, null);
      const item: Taxon = {
        id: ctx.runtime.uuid(),
        name: value.name as string,
        slug: value.slug as string,
        description: (value.description as string) ?? '',
        created_at: ctx.nowIso,
        updated_at: ctx.nowIso,
        deleted_at: null,
        version: 1,
      };
      appendRecord(ctx.sheets, table, item);
      audit(ctx, 'taxonomy.create', kind, item.id);
      return item;
    },
  },
  'taxonomy.update': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = payloadObj(payload);
      const kind = kindOf(p);
      const id = requireId(p);
      const expected = requireVersion(p);
      const table = loadTable<Taxon>(ctx.sheets, sheetOf(kind));
      const entry = table.entries.find((e) => e.record.id === id && !e.record.deleted_at);
      if (!entry) throw new ZidError('NOT_FOUND', 'Item tidak ditemukan.');
      checkVersion(entry.record, expected);
      const { value, errors } = validateInput(TAXON_INPUT, p.patch ?? {}, { partial: true, namespace: kind });
      if (errors.length) throw validationError(errors);
      if (typeof value.slug === 'string') assertSlugFree(table, value.slug, id);
      const next: Taxon = { ...entry.record, ...value, updated_at: ctx.nowIso, version: entry.record.version + 1 };
      writeEntry(ctx.sheets, table, entry, next);
      audit(ctx, 'taxonomy.update', kind, id, 'ok', `v${next.version}`);
      return next;
    },
  },
  'taxonomy.softDelete': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const p = payloadObj(payload);
      const kind = kindOf(p);
      const id = requireId(p);
      const expected = requireVersion(p);
      const table = loadTable<Taxon>(ctx.sheets, sheetOf(kind));
      const entry = table.entries.find((e) => e.record.id === id && !e.record.deleted_at);
      if (!entry) throw new ZidError('NOT_FOUND', 'Item tidak ditemukan.');
      checkVersion(entry.record, expected);
      const next: Taxon = {
        ...entry.record,
        deleted_at: ctx.nowIso,
        updated_at: ctx.nowIso,
        version: entry.record.version + 1,
      };
      writeEntry(ctx.sheets, table, entry, next);
      audit(ctx, 'taxonomy.softDelete', kind, id);
      return next;
    },
  },
};

import { type AuditEntry, decodeRow, encodeRow, LIMITS, type SheetName, ZidError } from '@zidcms/core';
import type { Ctx, SheetStore } from './ports';

export interface Entry<T> {
  index: number;
  row: string[];
  record: T;
}

export interface Table<T> {
  sheet: SheetName;
  headers: string[];
  entries: Entry<T>[];
  invalid: number[];
}

export function loadTable<T>(store: SheetStore, sheet: SheetName): Table<T> {
  const data = store.read(sheet);
  if (!data || data.headers.length === 0) {
    throw new ZidError('INTERNAL_ERROR', `Sheet ${sheet} belum disiapkan. Jalankan system.setup.`);
  }
  const entries: Entry<T>[] = [];
  const invalid: number[] = [];
  data.rows.forEach((row, index) => {
    if (row.every((cell) => cell === '')) return;
    const decoded = decodeRow<T>(sheet, data.headers, row);
    if (decoded.ok && isStructurallyValid(sheet, decoded.record as Record<string, unknown>)) {
      entries.push({ index, row, record: decoded.record });
    } else {
      invalid.push(index);
    }
  });
  return { sheet, headers: data.headers, entries, invalid };
}

function isStructurallyValid(sheet: SheetName, record: Record<string, unknown>): boolean {
  switch (sheet) {
    case 'Posts':
    case 'Pages':
      return (
        typeof record.id === 'string' &&
        record.id !== '' &&
        ['draft', 'published', 'archived'].includes(record.status as string) &&
        typeof record.version === 'number' &&
        record.version >= 1 &&
        Array.isArray(record.tag_ids ?? [])
      );
    case 'Categories':
    case 'Tags':
    case 'Media':
      return typeof record.id === 'string' && record.id !== '' && (record.version as number) >= 1;
    default:
      return true;
  }
}

export function writeEntry<T extends object>(store: SheetStore, table: Table<T>, entry: Entry<T>, record: T): void {
  store.updateRow(table.sheet, entry.index, encodeRow(table.sheet, table.headers, record, entry.row));
}

export function appendRecord<T extends object>(
  store: SheetStore,
  table: Pick<Table<T>, 'sheet' | 'headers'>,
  record: T,
): void {
  store.appendRow(table.sheet, encodeRow(table.sheet, table.headers, record));
}

export function appendTo(ctx: Ctx, sheet: SheetName, record: object): void {
  const data = ctx.sheets.read(sheet);
  if (!data) throw new ZidError('INTERNAL_ERROR', `Sheet ${sheet} belum disiapkan.`);
  ctx.sheets.appendRow(sheet, encodeRow(sheet, data.headers, record));
}

export function audit(
  ctx: Ctx,
  action: string,
  entityType: string,
  entityId: string,
  result = 'ok',
  detail = '',
): void {
  const entry: AuditEntry = {
    id: ctx.runtime.uuid(),
    at: ctx.nowIso,
    actor: ctx.actor,
    action,
    entity_type: entityType,
    entity_id: entityId,
    request_id: ctx.requestId,
    result,
    detail: detail.slice(0, LIMITS.AUDIT_DETAIL),
  };
  appendTo(ctx, 'AuditLog', entry);
}

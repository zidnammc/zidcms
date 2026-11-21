import { type CellType, SHEET_COLUMNS, type SheetName } from './sheets';

const ESCAPE_PREFIX = '~';
const NEEDS_ESCAPE = /^[=+\-@~'\t\r]/;

export function encodeCell(value: string): string {
  return NEEDS_ESCAPE.test(value) ? ESCAPE_PREFIX + value : value;
}

export function decodeCell(cell: string): string {
  return cell.startsWith(ESCAPE_PREFIX) ? cell.slice(ESCAPE_PREFIX.length) : cell;
}

const INT = /^-?\d+$/;

function decodeTyped(type: CellType, raw: string): { ok: true; value: unknown } | { ok: false } {
  switch (type) {
    case 'str':
      return { ok: true, value: raw };
    case 'opt':
      return { ok: true, value: raw === '' ? null : raw };
    case 'int':
      return INT.test(raw) ? { ok: true, value: Number(raw) } : { ok: false };
    case 'optint':
      if (raw === '') return { ok: true, value: null };
      return INT.test(raw) ? { ok: true, value: Number(raw) } : { ok: false };
    case 'bool':
      if (raw === 'TRUE') return { ok: true, value: true };
      if (raw === 'FALSE' || raw === '') return { ok: true, value: false };
      return { ok: false };
    case 'json':
      if (raw === '') return { ok: true, value: [] };
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch {
        return { ok: false };
      }
  }
}

function encodeTyped(type: CellType, value: unknown): string {
  switch (type) {
    case 'str':
      return value == null ? '' : String(value);
    case 'opt':
    case 'optint':
      return value == null ? '' : String(value);
    case 'int':
      return String(value ?? 0);
    case 'bool':
      return value ? 'TRUE' : 'FALSE';
    case 'json':
      return JSON.stringify(value ?? []);
  }
}

export type DecodeResult<T> = { ok: true; record: T } | { ok: false; error: string };

export function decodeRow<T>(sheet: SheetName, headers: string[], row: string[]): DecodeResult<T> {
  const columns = SHEET_COLUMNS[sheet] as Record<string, CellType>;
  const record: Record<string, unknown> = {};
  for (const [name, type] of Object.entries(columns)) {
    const idx = headers.indexOf(name);
    if (idx === -1) return { ok: false, error: `missing column ${name}` };
    const decoded = decodeTyped(type, decodeCell(row[idx] ?? ''));
    if (!decoded.ok) return { ok: false, error: `invalid ${type} in column ${name}` };
    record[name] = decoded.value;
  }
  return { ok: true, record: record as T };
}

export function encodeRow(sheet: SheetName, headers: string[], record: object, existing?: string[]): string[] {
  const columns = SHEET_COLUMNS[sheet] as Record<string, CellType>;
  const values = record as Record<string, unknown>;
  return headers.map((header, idx) => {
    const type = columns[header];
    if (!type) return existing?.[idx] ?? '';
    return encodeCell(encodeTyped(type, values[header]));
  });
}

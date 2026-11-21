import { type SheetName, ZidError } from '@zidcms/core';
import type { GasDeps, SheetData } from '../ports';

function toCell(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value == null ? '' : String(value);
}

function spreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new ZidError('INTERNAL_ERROR', 'Script harus terikat (container-bound) ke spreadsheet CMS.');
  return ss;
}

function writeRange(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number, values: string[]): void {
  const range = sheet.getRange(row, 1, 1, values.length);
  range.setNumberFormat('@');
  range.setValues([values]);
}

function signedToUnsigned(bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes, (b) => b & 0xff);
}

function unsignedToSigned(bytes: Uint8Array): number[] {
  return Array.from(bytes, (b) => (b > 127 ? b - 256 : b));
}

export function gasDeps(): GasDeps {
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  return {
    sheets: {
      ensureSheet(name: SheetName, headers: string[]) {
        const ss = spreadsheet();
        let sheet = ss.getSheetByName(name);
        const created = !sheet;
        if (!sheet) sheet = ss.insertSheet(name);
        const lastColumn = sheet.getLastColumn();
        const current = lastColumn > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]!.map(toCell) : [];
        const added = headers.filter((h) => !current.includes(h));
        const all = [...current.filter((h) => h !== ''), ...added];
        writeRange(sheet, 1, all);
        sheet.getRange(1, 1, sheet.getMaxRows(), all.length).setNumberFormat('@');
        sheet.setFrozenRows(1);
        return { created, addedColumns: added };
      },
      read(name: SheetName): SheetData | null {
        const sheet = spreadsheet().getSheetByName(name);
        if (!sheet) return null;
        if (sheet.getLastRow() === 0) return { headers: [], rows: [] };
        const values = sheet
          .getDataRange()
          .getValues()
          .map((row) => row.map(toCell));
        const [headers = [], ...rows] = values;
        return { headers, rows };
      },
      updateRow(name: SheetName, dataIndex: number, values: string[]) {
        const sheet = spreadsheet().getSheetByName(name);
        if (!sheet) throw new ZidError('INTERNAL_ERROR', `Sheet ${name} tidak ada.`);
        writeRange(sheet, dataIndex + 2, values);
      },
      appendRow(name: SheetName, values: string[]) {
        const sheet = spreadsheet().getSheetByName(name);
        if (!sheet) throw new ZidError('INTERNAL_ERROR', `Sheet ${name} tidak ada.`);
        writeRange(sheet, sheet.getLastRow() + 1, values);
      },
    },
    media: {
      create(filename: string, mime: string, bytes: Uint8Array) {
        const folderId = props.getProperty('MEDIA_FOLDER_ID');
        if (!folderId) throw new ZidError('INTERNAL_ERROR', 'MEDIA_FOLDER_ID belum diatur.');
        const blob = Utilities.newBlob(unsignedToSigned(bytes), mime, filename);
        return DriveApp.getFolderById(folderId).createFile(blob).getId();
      },
      getBase64(fileId: string) {
        return Utilities.base64Encode(DriveApp.getFileById(fileId).getBlob().getBytes());
      },
      ensureFolder(environment: string) {
        return DriveApp.createFolder(`ZidCMS Media (${environment})`).getId();
      },
    },
    nonces: {
      seen: (nonce) => cache.get(`n:${nonce}`) !== null,
      remember: (nonce, ttl) => cache.put(`n:${nonce}`, '1', ttl),
    },
    lock: {
      withLock<T>(fn: () => T): T {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(10_000)) {
          throw new ZidError('LOCK_TIMEOUT', 'Spreadsheet sedang sibuk, coba lagi sebentar.');
        }
        try {
          const result = fn();
          SpreadsheetApp.flush();
          return result;
        } finally {
          lock.releaseLock();
        }
      },
    },
    props: {
      get: (key) => props.getProperty(key),
      set: (key, value) => {
        props.setProperty(key, value);
      },
    },
    runtime: {
      now: () => Date.now(),
      uuid: () => Utilities.getUuid(),
      hmacHex: (secret, message) =>
        Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8)
          .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
          .join(''),
      base64ToBytes: (b64) => signedToUnsigned(Utilities.base64Decode(b64)),
      log: (entry) => console.log(JSON.stringify(entry)),
    },
  };
}

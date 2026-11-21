import { createHmac, randomUUID } from 'node:crypto';
import { type SheetName, ZidError } from '@zidcms/core';
import type { GasDeps, Lock, MediaStore, NonceStore, Props, Runtime, SheetData, SheetStore } from './ports';

export interface MemoryState {
  sheets: Record<string, string[][]>;
  media: Record<string, { filename: string; mime: string; base64: string }>;
  props: Record<string, string>;
}

export function emptyState(props: Record<string, string> = {}): MemoryState {
  return { sheets: {}, media: {}, props: { ...props } };
}

export class MemorySheetStore implements SheetStore {
  constructor(private readonly state: MemoryState) {}

  ensureSheet(name: SheetName, headers: string[]) {
    const existing = this.state.sheets[name];
    if (!existing) {
      this.state.sheets[name] = [[...headers]];
      return { created: true, addedColumns: headers };
    }
    const current = existing[0] ?? [];
    const added = headers.filter((h) => !current.includes(h));
    existing[0] = [...current, ...added];
    return { created: false, addedColumns: added };
  }

  read(name: SheetName): SheetData | null {
    const sheet = this.state.sheets[name];
    if (!sheet) return null;
    const [headers = [], ...rows] = sheet;
    return { headers: [...headers], rows: rows.map((r) => [...r]) };
  }

  updateRow(name: SheetName, dataIndex: number, values: string[]): void {
    const sheet = this.require(name);
    sheet[dataIndex + 1] = values.map(String);
  }

  appendRow(name: SheetName, values: string[]): void {
    this.require(name).push(values.map(String));
  }

  private require(name: SheetName): string[][] {
    const sheet = this.state.sheets[name];
    if (!sheet) throw new ZidError('INTERNAL_ERROR', `Sheet ${name} tidak ada.`);
    return sheet;
  }
}

export class MemoryMediaStore implements MediaStore {
  constructor(private readonly state: MemoryState) {}

  create(filename: string, mime: string, bytes: Uint8Array): string {
    const id = `mem-${randomUUID()}`;
    this.state.media[id] = { filename, mime, base64: Buffer.from(bytes).toString('base64') };
    return id;
  }

  getBase64(fileId: string): string {
    const file = this.state.media[fileId];
    if (!file) throw new ZidError('NOT_FOUND', 'Berkas media tidak ditemukan di penyimpanan.');
    return file.base64;
  }

  ensureFolder(environment: string): string | null {
    return `memory-folder-${environment}`;
  }
}

export class MemoryNonceStore implements NonceStore {
  private readonly nonces = new Map<string, number>();
  constructor(private readonly now: () => number) {}

  seen(nonce: string): boolean {
    const expires = this.nonces.get(nonce);
    return expires !== undefined && expires > this.now();
  }

  remember(nonce: string, ttlSeconds: number): void {
    this.nonces.set(nonce, this.now() + ttlSeconds * 1000);
  }
}

export class MemoryLock implements Lock {
  held = false;
  forceTimeout = false;

  withLock<T>(fn: () => T): T {
    if (this.forceTimeout || this.held) {
      throw new ZidError('LOCK_TIMEOUT', 'Spreadsheet sedang sibuk, coba lagi sebentar.');
    }
    this.held = true;
    try {
      return fn();
    } finally {
      this.held = false;
    }
  }
}

export class MemoryProps implements Props {
  constructor(private readonly state: MemoryState) {}
  get(key: string): string | null {
    return this.state.props[key] ?? null;
  }
  set(key: string, value: string): void {
    this.state.props[key] = value;
  }
}

export function nodeRuntime(options: { now?: () => number; log?: (e: Record<string, unknown>) => void } = {}): Runtime {
  return {
    now: options.now ?? (() => Date.now()),
    uuid: () => randomUUID(),
    hmacHex: (secret, message) =>
      createHmac('sha256', Buffer.from(secret, 'utf8')).update(message, 'utf8').digest('hex'),
    base64ToBytes: (b64) => new Uint8Array(Buffer.from(b64, 'base64')),
    log: options.log ?? (() => {}),
  };
}

export function memoryDeps(
  state: MemoryState,
  options: { now?: () => number; log?: (e: Record<string, unknown>) => void } = {},
): GasDeps & { lock: MemoryLock } {
  const runtime = nodeRuntime(options);
  return {
    sheets: new MemorySheetStore(state),
    media: new MemoryMediaStore(state),
    nonces: new MemoryNonceStore(() => runtime.now()),
    lock: new MemoryLock(),
    props: new MemoryProps(state),
    runtime,
  };
}

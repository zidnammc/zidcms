import type { SheetName } from '@zidcms/core';

export interface SheetData {
  headers: string[];
  rows: string[][];
}

export interface SheetStore {
  ensureSheet(name: SheetName, headers: string[]): { created: boolean; addedColumns: string[] };
  read(name: SheetName): SheetData | null;
  updateRow(name: SheetName, dataIndex: number, values: string[]): void;
  appendRow(name: SheetName, values: string[]): void;
}

export interface MediaStore {
  create(filename: string, mime: string, bytes: Uint8Array): string;
  getBase64(fileId: string): string;
  ensureFolder(environment: string): string | null;
}

export interface NonceStore {
  seen(nonce: string): boolean;
  remember(nonce: string, ttlSeconds: number): void;
}

export interface Lock {
  withLock<T>(fn: () => T): T;
}

export interface Props {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface Runtime {
  now(): number;
  uuid(): string;
  hmacHex(secret: string, message: string): string;
  base64ToBytes(base64: string): Uint8Array;
  log(entry: Record<string, unknown>): void;
}

export interface GasDeps {
  sheets: SheetStore;
  media: MediaStore;
  nonces: NonceStore;
  lock: Lock;
  props: Props;
  runtime: Runtime;
}

export interface Ctx extends GasDeps {
  actor: string;
  requestId: string;
  environment: string;
  nowIso: string;
}

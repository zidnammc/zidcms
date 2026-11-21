import {
  type AuditEntry,
  type ContentItem,
  LIMITS,
  type Media,
  type PublishJob,
  SCHEMA_VERSION,
  SHEET_NAMES,
  type SnapshotRecord,
  sheetHeaders,
  type Taxon,
  ZidError,
} from '@zidcms/core';
import type { Ctx } from '../ports';
import { appendRecord, audit, loadTable, writeEntry } from '../table';
import { isActive } from './publish';
import { settingsMeta, writeDefaultSettings } from './settings';

interface MetaRow {
  key: string;
  value: string;
}

function readMeta(ctx: Ctx): Record<string, string> {
  if (!ctx.sheets.read('_Meta')) return {};
  return Object.fromEntries(loadTable<MetaRow>(ctx.sheets, '_Meta').entries.map((e) => [e.record.key, e.record.value]));
}

function setMeta(ctx: Ctx, key: string, value: string): void {
  const table = loadTable<MetaRow>(ctx.sheets, '_Meta');
  const entry = table.entries.find((e) => e.record.key === key);
  if (entry) writeEntry(ctx.sheets, table, entry, { key, value });
  else appendRecord(ctx.sheets, table, { key, value });
}

export const systemActions = {
  'system.health': {
    lock: false,
    run(ctx: Ctx) {
      const meta = readMeta(ctx);
      const missing: string[] = [];
      const invalidRows: Record<string, number> = {};
      const rowCounts: Record<string, number> = {};
      for (const name of SHEET_NAMES) {
        if (!ctx.sheets.read(name)) {
          missing.push(name);
          continue;
        }
        const table = loadTable(ctx.sheets, name);
        rowCounts[name] = table.entries.length;
        if (table.invalid.length) invalidRows[name] = table.invalid.length;
      }
      return {
        environment: ctx.environment,
        schema_version: meta.schema_version ? Number(meta.schema_version) : null,
        installed_at: meta.installed_at ?? null,
        missing_sheets: missing,
        invalid_rows: invalidRows,
        invalid_row_count: Object.values(invalidRows).reduce((a, b) => a + b, 0),
        row_counts: rowCounts,
        media_folder_configured: Boolean(ctx.props.get('MEDIA_FOLDER_ID')),
        server_time: ctx.nowIso,
      };
    },
  },

  'system.setup': {
    lock: true,
    run(ctx: Ctx) {
      const meta = readMeta(ctx);
      if (ctx.environment === 'prod' && meta.installed_at && ctx.props.get('MEDIA_FOLDER_ID')) {
        throw new ZidError('FORBIDDEN', 'system.setup dinonaktifkan di prod setelah instalasi pertama.');
      }
      const created: string[] = [];
      const addedColumns: Record<string, string[]> = {};
      for (const name of SHEET_NAMES) {
        const result = ctx.sheets.ensureSheet(name, sheetHeaders(name));
        if (result.created) created.push(name);
        if (result.addedColumns.length && !result.created) addedColumns[name] = result.addedColumns;
      }
      setMeta(ctx, 'schema_version', String(SCHEMA_VERSION));
      setMeta(ctx, 'environment', ctx.environment);
      const settingsAdded = writeDefaultSettings(ctx);
      let mediaFolder = ctx.props.get('MEDIA_FOLDER_ID');
      if (!mediaFolder) {
        mediaFolder = ctx.media.ensureFolder(ctx.environment);
        if (mediaFolder) ctx.props.set('MEDIA_FOLDER_ID', mediaFolder);
      }
      if (!meta.installed_at) setMeta(ctx, 'installed_at', ctx.nowIso);
      audit(ctx, 'system.setup', 'system', 'spreadsheet', 'ok', `created=${created.join(',')}`);
      return {
        created_sheets: created,
        added_columns: addedColumns,
        settings_added: settingsAdded,
        media_folder_configured: Boolean(mediaFolder),
        schema_version: SCHEMA_VERSION,
      };
    },
  },

  'system.summary': {
    lock: false,
    run(ctx: Ctx) {
      const brief = (sheet: 'Posts' | 'Pages') => {
        const table = loadTable<ContentItem>(ctx.sheets, sheet);
        const counts = { all: 0, draft: 0, published: 0, archived: 0, trash: 0 };
        const items = table.entries.map(({ record: r }) => {
          if (r.deleted_at) counts.trash += 1;
          else {
            counts.all += 1;
            counts[r.status] += 1;
          }
          return { id: r.id, status: r.status, updated_at: r.updated_at, deleted_at: r.deleted_at };
        });
        return { counts, items, invalid: table.invalid.length };
      };
      const posts = brief('Posts');
      const pages = brief('Pages');
      const jobs = loadTable<PublishJob>(ctx.sheets, 'PublishJobs').entries.map((e) => e.record);
      const snaps = loadTable<SnapshotRecord>(ctx.sheets, 'Snapshots').entries.map((e) => e.record);
      const taxa = [
        ...loadTable<Taxon>(ctx.sheets, 'Categories').entries,
        ...loadTable<Taxon>(ctx.sheets, 'Tags').entries,
      ].map((e) => e.record.updated_at);
      const sortedJobs = jobs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return {
        environment: ctx.environment,
        posts,
        pages,
        mediaCount: loadTable<Media>(ctx.sheets, 'Media').entries.filter((e) => !e.record.deleted_at).length,
        activeJob: sortedJobs.find(isActive) ?? null,
        lastJob: sortedJobs[0] ?? null,
        live: snaps.find((s) => s.status === 'live') ?? null,
        latestVersion: snaps.reduce((max, s) => Math.max(max, s.version), 0),
        settingsUpdatedAt: settingsMeta(ctx).updated_at,
        taxonomyUpdatedAt: taxa.sort().pop() ?? null,
        invalidRowCount: posts.invalid + pages.invalid,
      };
    },
  },

  'audit.list': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      const raw = (payload ?? {}) as { limit?: unknown };
      const limit = Math.min(Math.max(Number(raw.limit ?? 20) || 20, 1), LIMITS.LIST_MAX);
      const items = loadTable<AuditEntry>(ctx.sheets, 'AuditLog').entries.map((e) => e.record);
      return { items: items.slice(-limit).reverse() };
    },
  },
};

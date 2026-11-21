import {
  DEFAULT_SETTINGS,
  SETTINGS_INPUT,
  type SiteSettings,
  validateInput,
  validationError,
  ZidError,
} from '@zidcms/core';
import type { Ctx } from '../ports';
import { appendRecord, audit, loadTable, writeEntry } from '../table';

interface SettingRow {
  key: string;
  value_json: string;
  is_public: boolean;
  updated_at: string;
  updated_by: string;
}

export function readSettings(ctx: Ctx): SiteSettings {
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const { record } of loadTable<SettingRow>(ctx.sheets, 'Settings').entries) {
    if (!(record.key in DEFAULT_SETTINGS)) continue;
    try {
      settings[record.key] = JSON.parse(record.value_json);
    } catch {
      ctx.runtime.log({ level: 'warn', msg: 'invalid_setting', key: record.key });
    }
  }
  return settings as unknown as SiteSettings;
}

export function settingsMeta(ctx: Ctx): { updated_at: string | null } {
  const rows = loadTable<SettingRow>(ctx.sheets, 'Settings').entries.map((e) => e.record);
  const latest = rows
    .map((r) => r.updated_at)
    .sort()
    .pop();
  return { updated_at: latest || null };
}

export function writeDefaultSettings(ctx: Ctx): string[] {
  const table = loadTable<SettingRow>(ctx.sheets, 'Settings');
  const existing = new Set(table.entries.map((e) => e.record.key));
  const added: string[] = [];
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing.has(key)) continue;
    appendRecord(ctx.sheets, table, {
      key,
      value_json: JSON.stringify(value),
      is_public: true,
      updated_at: ctx.nowIso,
      updated_by: ctx.actor,
    });
    added.push(key);
  }
  return added;
}

export const settingsActions = {
  'settings.get': {
    lock: false,
    run(ctx: Ctx) {
      return { settings: readSettings(ctx), ...settingsMeta(ctx) };
    },
  },
  'settings.update': {
    lock: true,
    run(ctx: Ctx, payload: unknown) {
      const patch = (payload as { patch?: unknown } | null)?.patch;
      if (!patch) throw new ZidError('BAD_REQUEST', 'patch wajib diisi.');
      const { value, errors } = validateInput(SETTINGS_INPUT, patch, { partial: true });
      if (errors.length) throw validationError(errors);
      const table = loadTable<SettingRow>(ctx.sheets, 'Settings');
      for (const [key, v] of Object.entries(value)) {
        const record: SettingRow = {
          key,
          value_json: JSON.stringify(v),
          is_public: true,
          updated_at: ctx.nowIso,
          updated_by: ctx.actor,
        };
        const entry = table.entries.find((e) => e.record.key === key);
        if (entry) writeEntry(ctx.sheets, table, entry, record);
        else appendRecord(ctx.sheets, table, record);
      }
      audit(ctx, 'settings.update', 'settings', 'site', 'ok', Object.keys(value).join(','));
      return { settings: readSettings(ctx), ...settingsMeta(ctx) };
    },
  },
};

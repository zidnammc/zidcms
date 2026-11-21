import { isUuid, type Page, type Post, type SnapshotRecord, ZidError } from '@zidcms/core';
import type { Ctx } from '../ports';
import { loadTable } from '../table';
import { activeMedia } from './media';
import { readSettings } from './settings';
import { listTaxa } from './taxonomy';

export const editorActions = {
  'editor.context': {
    lock: false,
    run(ctx: Ctx, payload: unknown) {
      const p = (payload ?? {}) as { kind?: unknown; id?: unknown };
      if (p.kind !== 'post' && p.kind !== 'page') throw new ZidError('BAD_REQUEST', 'kind harus "post" atau "page".');
      if (p.id !== undefined && p.id !== null && !isUuid(p.id)) throw new ZidError('BAD_REQUEST', 'ID tidak valid.');
      let item: Post | Page | null = null;
      if (p.id) {
        const id = String(p.id).toLowerCase();
        item =
          loadTable<Post | Page>(ctx.sheets, p.kind === 'post' ? 'Posts' : 'Pages').entries.find(
            (e) => e.record.id === id,
          )?.record ?? null;
        if (!item) throw new ZidError('NOT_FOUND', 'Item tidak ditemukan.');
      }
      const live =
        loadTable<SnapshotRecord>(ctx.sheets, 'Snapshots')
          .entries.map((e) => e.record)
          .find((s) => s.status === 'live') ?? null;
      return {
        item,
        settings: readSettings(ctx),
        categories: p.kind === 'post' ? listTaxa(ctx, 'category') : [],
        tags: p.kind === 'post' ? listTaxa(ctx, 'tag') : [],
        media: activeMedia(ctx)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .map(({ drive_file_id: _d, ...rest }) => rest),
        live,
      };
    },
  },
};

import {
  type ContentKind,
  type ContentStatus,
  type ContentSummary,
  deleteStartsPublish,
  isContentStatus,
  isUuid,
  LIMITS,
  PAGE_INPUT,
  type Page,
  POST_INPUT,
  type Post,
  planTransition,
  type Revision,
  type RevisionSummary,
  type SheetName,
  slugify,
  validateInput,
  validationError,
  ZidError,
} from '@zidcms/core';
import type { Ctx } from '../ports';
import { appendRecord, appendTo, audit, type Entry, loadTable, type Table, writeEntry } from '../table';
import { readSettings } from './settings';

type Item = Post | Page;

const SHEET: Record<ContentKind, SheetName> = { post: 'Posts', page: 'Pages' };

function spec(kind: ContentKind) {
  return kind === 'post' ? POST_INPUT : PAGE_INPUT;
}

function obj(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ZidError('BAD_REQUEST', 'Payload harus berupa objek.');
  }
  return payload as Record<string, unknown>;
}

export function requireId(payload: Record<string, unknown>): string {
  if (!isUuid(payload.id)) throw new ZidError('BAD_REQUEST', 'ID tidak valid.');
  return (payload.id as string).toLowerCase();
}

export function requireVersion(payload: Record<string, unknown>): number {
  const v = payload.expected_version;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new ZidError('BAD_REQUEST', 'expected_version wajib berupa bilangan bulat.');
  }
  return v;
}

export function checkVersion(current: { version: number }, expected: number): void {
  if (current.version !== expected) {
    throw new ZidError('VERSION_CONFLICT', 'Item ini telah diubah di tempat lain.', {
      current_version: current.version,
    });
  }
}

function findEntry<T extends { id: string }>(table: Table<T>, id: string): Entry<T> {
  const entry = table.entries.find((e) => e.record.id === id);
  if (!entry) throw new ZidError('NOT_FOUND', 'Item tidak ditemukan.');
  return entry;
}

export function assertSlugFree(
  table: Table<{ id: string; slug: string; deleted_at: string | null }>,
  slug: string,
  selfId: string | null,
): void {
  const taken = table.entries.some(
    (e) => e.record.slug === slug && e.record.deleted_at === null && e.record.id !== selfId,
  );
  if (taken) {
    throw new ZidError('SLUG_CONFLICT', `Slug "${slug}" sudah dipakai item lain (termasuk arsip).`, {
      slug,
    });
  }
}

function summary<T extends Item>(item: T): ContentSummary<T> {
  const { content_markdown: _body, ...rest } = item;
  return rest as ContentSummary<T>;
}

function recordRevision(ctx: Ctx, kind: ContentKind, item: Item): void {
  const { content_markdown, title, id, version, ...meta } = item;
  const revision: Revision = {
    id: ctx.runtime.uuid(),
    content_type: kind,
    content_id: id,
    version,
    title,
    content_markdown,
    meta_json: JSON.stringify(meta).slice(0, LIMITS.META_JSON),
    created_at: ctx.nowIso,
    created_by: ctx.actor,
  };
  appendTo(ctx, 'Revisions', revision);
}

function persist(ctx: Ctx, kind: ContentKind, table: Table<Item>, entry: Entry<Item>, next: Item, action: string) {
  writeEntry(ctx.sheets, table, entry, next);
  recordRevision(ctx, kind, next);
  audit(ctx, action, kind, next.id, 'ok', `v${next.version}`);
}

export const STATUS_FILTERS = ['all', 'draft', 'published', 'archived', 'trash'] as const;

export function contentActions(kind: ContentKind) {
  const sheet = SHEET[kind];
  const ns = kind === 'post' ? 'posts' : 'pages';
  const load = (ctx: Ctx) => loadTable<Item>(ctx.sheets, sheet);

  return {
    [`${ns}.list`]: {
      lock: false,
      run(ctx: Ctx, payload: unknown) {
        const p = obj(payload ?? {});
        const status = (p.status ?? 'all') as string;
        if (!(STATUS_FILTERS as readonly string[]).includes(status)) {
          throw new ZidError('BAD_REQUEST', 'Filter status tidak valid.');
        }
        const limit = Math.min(Math.max(Number(p.limit ?? 20) || 20, 1), LIMITS.LIST_MAX);
        const offset = Math.max(Number(p.cursor ?? 0) || 0, 0);
        const q = typeof p.q === 'string' ? p.q.trim().toLowerCase() : '';
        const records = load(ctx).entries.map((e) => e.record);
        const counts = { all: 0, draft: 0, published: 0, archived: 0, trash: 0 };
        for (const r of records) {
          if (r.deleted_at) counts.trash += 1;
          else {
            counts.all += 1;
            counts[r.status] += 1;
          }
        }
        const filtered = records
          .filter((r) =>
            status === 'trash'
              ? r.deleted_at !== null
              : r.deleted_at === null && (status === 'all' || r.status === status),
          )
          .filter((r) => !q || r.title.toLowerCase().includes(q) || r.slug.includes(q))
          .sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));
        const page = filtered.slice(offset, offset + limit);
        return {
          items: page.map(summary),
          total: filtered.length,
          counts,
          nextCursor: offset + limit < filtered.length ? String(offset + limit) : null,
        };
      },
    },

    [`${ns}.get`]: {
      lock: false,
      run(ctx: Ctx, payload: unknown) {
        return findEntry(load(ctx), requireId(obj(payload))).record;
      },
    },

    [`${ns}.create`]: {
      lock: true,
      run(ctx: Ctx, payload: unknown) {
        const p = obj(payload);
        const input = { ...p };
        if (typeof input.title === 'string' && (input.slug === undefined || input.slug === '')) {
          input.slug = slugify(input.title);
        }
        const { value, errors } = validateInput(spec(kind), input, {
          partial: false,
          namespace: kind,
          required: ['title', 'slug'],
        });
        if (errors.length) throw validationError(errors);
        const table = load(ctx);
        assertSlugFree(table, value.slug as string, null);
        const base = {
          id: ctx.runtime.uuid(),
          title: value.title as string,
          slug: value.slug as string,
          content_markdown: (value.content_markdown as string) ?? '',
          status: 'draft' as ContentStatus,
          seo_title: (value.seo_title as string) ?? '',
          seo_description: (value.seo_description as string) ?? '',
          created_at: ctx.nowIso,
          updated_at: ctx.nowIso,
          created_by: ctx.actor,
          updated_by: ctx.actor,
          published_at: (value.published_at as string | null) ?? null,
          deleted_at: null,
          version: 1,
        };
        const item: Item =
          kind === 'post'
            ? {
                ...base,
                excerpt: (value.excerpt as string) ?? '',
                author_name: (value.author_name as string) ?? readSettings(ctx).default_author_name,
                category_id: (value.category_id as string | null) ?? null,
                tag_ids: (value.tag_ids as string[]) ?? [],
                cover_media_id: (value.cover_media_id as string | null) ?? null,
              }
            : { ...base, nav_order: (value.nav_order as number | null) ?? null };
        appendRecord(ctx.sheets, table, item);
        recordRevision(ctx, kind, item);
        audit(ctx, `${ns}.create`, kind, item.id, 'ok', 'v1');
        return item;
      },
    },

    [`${ns}.update`]: {
      lock: true,
      run(ctx: Ctx, payload: unknown) {
        const p = obj(payload);
        const id = requireId(p);
        const expected = requireVersion(p);
        const table = load(ctx);
        const entry = findEntry(table, id);
        if (entry.record.deleted_at) throw new ZidError('NOT_FOUND', 'Item ada di tempat sampah.');
        checkVersion(entry.record, expected);
        const { value, errors } = validateInput(spec(kind), p.patch ?? {}, { partial: true, namespace: kind });
        if (errors.length) throw validationError(errors);
        if (typeof value.slug === 'string') assertSlugFree(table, value.slug, id);
        const next = {
          ...entry.record,
          ...value,
          updated_at: ctx.nowIso,
          updated_by: ctx.actor,
          version: entry.record.version + 1,
        } as Item;
        persist(ctx, kind, table, entry, next, `${ns}.update`);
        return { item: next, publishRequired: next.status === 'published' };
      },
    },

    [`${ns}.setStatus`]: {
      lock: true,
      run(ctx: Ctx, payload: unknown) {
        const p = obj(payload);
        const id = requireId(p);
        const expected = requireVersion(p);
        if (!isContentStatus(p.to)) throw new ZidError('BAD_REQUEST', 'Status tujuan tidak valid.');
        const table = load(ctx);
        const entry = findEntry(table, id);
        if (entry.record.deleted_at) throw new ZidError('NOT_FOUND', 'Item ada di tempat sampah.');
        checkVersion(entry.record, expected);
        const plan = planTransition(entry.record.status, p.to);
        if (!plan.ok) {
          throw new ZidError('INVALID_TRANSITION', `Tidak bisa mengubah status ${entry.record.status} → ${p.to}.`, {
            from: entry.record.status,
            to: p.to,
          });
        }
        const next = {
          ...entry.record,
          status: p.to,
          published_at: plan.setPublishedAt ? (entry.record.published_at ?? ctx.nowIso) : entry.record.published_at,
          updated_at: ctx.nowIso,
          updated_by: ctx.actor,
          version: entry.record.version + 1,
        } as Item;
        persist(ctx, kind, table, entry, next, `${ns}.setStatus`);
        return { item: next, publishRequired: plan.startsPublish };
      },
    },

    [`${ns}.softDelete`]: {
      lock: true,
      run(ctx: Ctx, payload: unknown) {
        const p = obj(payload);
        const id = requireId(p);
        const expected = requireVersion(p);
        const table = load(ctx);
        const entry = findEntry(table, id);
        if (entry.record.deleted_at) throw new ZidError('NOT_FOUND', 'Item sudah ada di tempat sampah.');
        checkVersion(entry.record, expected);
        const next = {
          ...entry.record,
          deleted_at: ctx.nowIso,
          updated_at: ctx.nowIso,
          updated_by: ctx.actor,
          version: entry.record.version + 1,
        } as Item;
        persist(ctx, kind, table, entry, next, `${ns}.softDelete`);
        return { item: next, publishRequired: deleteStartsPublish(entry.record.status) };
      },
    },

    [`${ns}.restore`]: {
      lock: true,
      run(ctx: Ctx, payload: unknown) {
        const p = obj(payload);
        const id = requireId(p);
        const expected = requireVersion(p);
        const table = load(ctx);
        const entry = findEntry(table, id);
        if (!entry.record.deleted_at) throw new ZidError('INVALID_TRANSITION', 'Item tidak ada di tempat sampah.');
        checkVersion(entry.record, expected);
        assertSlugFree(table, entry.record.slug, id);
        const next = {
          ...entry.record,
          status: 'draft',
          deleted_at: null,
          updated_at: ctx.nowIso,
          updated_by: ctx.actor,
          version: entry.record.version + 1,
        } as Item;
        persist(ctx, kind, table, entry, next, `${ns}.restore`);
        return { item: next, publishRequired: false };
      },
    },

    [`${ns}.revisions`]: {
      lock: false,
      run(ctx: Ctx, payload: unknown) {
        const id = requireId(obj(payload));
        return loadTable<Revision>(ctx.sheets, 'Revisions')
          .entries.map((e) => e.record)
          .filter((r) => r.content_id === id && r.content_type === kind)
          .sort((a, b) => b.version - a.version)
          .map(({ content_markdown: _c, meta_json: _m, ...rest }): RevisionSummary => rest);
      },
    },
  };
}

export function publishedContent(ctx: Ctx) {
  const posts = loadTable<Post>(ctx.sheets, 'Posts').entries.map((e) => e.record);
  const pages = loadTable<Page>(ctx.sheets, 'Pages').entries.map((e) => e.record);
  const live = <T extends Item>(items: T[]) => items.filter((i) => i.status === 'published' && !i.deleted_at);
  return { posts: live(posts), pages: live(pages) };
}

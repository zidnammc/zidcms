import {
  type ContentKind,
  computeLiveState,
  type Media,
  type Page,
  type Post,
  type SiteSettings,
  type SnapshotRecord,
  type Taxon,
  ZidError,
} from '@zidcms/core';
import { notFound } from 'next/navigation';
import type { EditorProps } from '@/components/editor/content-editor';
import { getAdmin, plainLiveIndex, readLiveSnapshot, toLiveIndex } from './data';
import { env } from './env';
import { gas } from './gas-client';

export interface EditorContext {
  item: Post | Page | null;
  settings: SiteSettings;
  categories: Taxon[];
  tags: Taxon[];
  media: Omit<Media, 'drive_file_id'>[];
  live: SnapshotRecord | null;
}

export async function loadEditorContext(kind: ContentKind, id: string | null): Promise<EditorContext> {
  const admin = await getAdmin();
  try {
    return await gas<EditorContext>('editor.context', { kind, id }, { actor: admin.email });
  } catch (err) {
    if (err instanceof ZidError && (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST')) notFound();
    throw err;
  }
}

export async function loadEditor(kind: ContentKind, id: string | null): Promise<EditorProps> {
  const ctx = await loadEditorContext(kind, id);
  if (ctx.item?.deleted_at) notFound();
  const index = ctx.item ? toLiveIndex(plainLiveIndex(await readLiveSnapshot(ctx.live))) : null;
  return {
    kind,
    item: ctx.item,
    liveState: ctx.item ? computeLiveState(ctx.item, index) : null,
    defaultAuthor: ctx.settings.default_author_name,
    allowExternalImages: ctx.settings.allow_external_images,
    publicSiteUrl: env.publicSiteUrl(),
    categories: ctx.categories,
    tags: ctx.tags,
    media: ctx.media,
  };
}

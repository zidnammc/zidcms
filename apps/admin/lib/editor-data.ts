import {
  type ContentKind,
  computeLiveState,
  type Page,
  type Post,
  type SiteSettings,
  type Taxon,
  ZidError,
} from '@zidcms/core';
import { notFound } from 'next/navigation';
import type { EditorProps } from '@/components/editor/content-editor';
import type { MediaItem } from '@/components/media-picker';
import { getAdmin, getLiveIndex, toLiveIndex } from './data';
import { env } from './env';
import { gas } from './gas-client';

export async function loadEditor(kind: ContentKind, id: string | null): Promise<EditorProps> {
  const admin = await getAdmin();
  const ctx = { actor: admin.email };
  const empty = Promise.resolve({ items: [] as never[] });
  const [item, settings, categories, tags, media, liveIndex] = await Promise.all([
    id
      ? gas<Post | Page>(`${kind}s.get`, { id }, ctx).catch((err: unknown) => {
          if (err instanceof ZidError && (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST')) notFound();
          throw err;
        })
      : Promise.resolve(null),
    gas<{ settings: SiteSettings }>('settings.get', {}, ctx),
    kind === 'post' ? gas<{ items: Taxon[] }>('taxonomy.list', { kind: 'category' }, ctx) : empty,
    kind === 'post' ? gas<{ items: Taxon[] }>('taxonomy.list', { kind: 'tag' }, ctx) : empty,
    gas<{ items: MediaItem[] }>('media.list', {}, ctx),
    getLiveIndex(),
  ]);
  if (item?.deleted_at) notFound();
  return {
    kind,
    item,
    liveState: item ? computeLiveState(item, toLiveIndex(liveIndex)) : null,
    defaultAuthor: settings.settings.default_author_name,
    allowExternalImages: settings.settings.allow_external_images,
    publicSiteUrl: env.publicSiteUrl(),
    categories: categories.items,
    tags: tags.items,
    media: media.items,
  };
}

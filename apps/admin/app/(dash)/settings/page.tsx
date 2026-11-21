import type { SiteSettings } from '@zidcms/core';
import type { MediaItem } from '@/components/media-picker';
import { SettingsForm } from '@/components/settings-form';
import { getAdmin } from '@/lib/data';
import { gas } from '@/lib/gas-client';

export const metadata = { title: 'Pengaturan' };

export default async function SettingsPage() {
  const admin = await getAdmin();
  const ctx = { actor: admin.email };
  const [settings, media] = await Promise.all([
    gas<{ settings: SiteSettings; updated_at: string | null }>('settings.get', {}, ctx),
    gas<{ items: MediaItem[] }>('media.list', {}, ctx),
  ]);
  return <SettingsForm initial={settings.settings} updatedAt={settings.updated_at} media={media.items} />;
}

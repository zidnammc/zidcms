import type { MediaItem } from '@/components/media-picker';
import { MediaScreen } from '@/components/media-screen';
import { getAdmin } from '@/lib/data';
import { gas } from '@/lib/gas-client';

export const metadata = { title: 'Pustaka Media' };

export default async function MediaPage() {
  const admin = await getAdmin();
  const { items } = await gas<{ items: MediaItem[] }>('media.list', {}, { actor: admin.email });
  return <MediaScreen items={items} />;
}

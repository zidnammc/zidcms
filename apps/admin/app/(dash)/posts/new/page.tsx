import { ContentEditor } from '@/components/editor/content-editor';
import { loadEditor } from '@/lib/editor-data';

export const metadata = { title: 'Artikel baru' };

export default async function NewPage() {
  return <ContentEditor {...(await loadEditor('post', null))} />;
}

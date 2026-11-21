import { ContentEditor } from '@/components/editor/content-editor';
import { loadEditor } from '@/lib/editor-data';

export const metadata = { title: 'Editor' };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const props = await loadEditor('page', id);
  return <ContentEditor key={props.item?.id} {...props} />;
}

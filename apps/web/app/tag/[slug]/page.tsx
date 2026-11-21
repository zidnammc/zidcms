import { TaxonPage, taxonMetadata, taxonStaticParams } from '@/components/taxon-page';

export const dynamicParams = false;

export function generateStaticParams() {
  return taxonStaticParams('tag');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return taxonMetadata('tag', (await params).slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <TaxonPage kind="tag" slug={(await params).slug} />;
}

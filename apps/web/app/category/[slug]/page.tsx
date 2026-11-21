import { TaxonPage, taxonMetadata, taxonStaticParams } from '@/components/taxon-page';

export const dynamicParams = false;

export function generateStaticParams() {
  return taxonStaticParams('category');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return taxonMetadata('category', (await params).slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <TaxonPage kind="category" slug={(await params).slug} />;
}

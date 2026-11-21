import { notFound } from 'next/navigation';
import { listMetadata, PLACEHOLDER, paramsOrPlaceholder, totalPages } from '@/lib/site';
import { Home } from '../../home';

export const dynamicParams = false;

export function generateStaticParams() {
  return paramsOrPlaceholder(
    Array.from({ length: Math.max(totalPages - 1, 0) }, (_, i) => ({ n: String(i + 2) })),
    'n',
  );
}

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  return listMetadata(`/page/${n}/`, `Halaman ${n}`);
}

export default async function PaginatedPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const page = Number(n);
  if (n === PLACEHOLDER || !Number.isInteger(page) || page < 2 || page > totalPages) notFound();
  return <Home page={page} />;
}

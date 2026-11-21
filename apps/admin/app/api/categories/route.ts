import { taxonomyRoutes } from '@/lib/api/misc';

const r = taxonomyRoutes('category');
export const GET = r.list;
export const POST = r.create;

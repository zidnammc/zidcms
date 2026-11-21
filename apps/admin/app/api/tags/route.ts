import { taxonomyRoutes } from '@/lib/api/misc';

const r = taxonomyRoutes('tag');
export const GET = r.list;
export const POST = r.create;

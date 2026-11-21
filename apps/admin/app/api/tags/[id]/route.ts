import { taxonomyRoutes } from '@/lib/api/misc';

const r = taxonomyRoutes('tag');
export const PATCH = r.update;
export const DELETE = r.remove;

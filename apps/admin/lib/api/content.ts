import { randomUUID } from 'node:crypto';
import {
  type ContentKind,
  type InputSpec,
  isUuid,
  PAGE_INPUT,
  POST_INPUT,
  type PublishJob,
  validateInput,
  validationError,
  ZidError,
} from '@zidcms/core';
import { gas } from '../gas-client';
import { Json, readJson, route } from '../http';

export async function requestPublish(actor: string, requestId: string, key: string = randomUUID()) {
  return gas<{ job: PublishJob; coalesced: boolean }>(
    'publish.acquire',
    { type: 'publish', idempotency_key: key },
    { actor, requestId },
  );
}

export function requireVersion(body: Record<string, unknown>): number {
  const v = body.expected_version;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new ZidError('BAD_REQUEST', 'expected_version wajib diisi.');
  }
  return v;
}

export function requireIdParam(id: string): string {
  if (!isUuid(id)) throw new ZidError('NOT_FOUND', 'Item tidak ditemukan.');
  return id;
}

export function prevalidate(spec: InputSpec, input: unknown, kind: ContentKind | 'category' | 'tag', partial: boolean) {
  const { errors } = validateInput(spec, input, { partial, namespace: kind });
  if (errors.length) throw validationError(errors);
}

type Params = { id: string };

export function contentRoutes(kind: ContentKind) {
  const ns = kind === 'post' ? 'posts' : 'pages';
  const spec = kind === 'post' ? POST_INPUT : PAGE_INPUT;

  const withPublish = async (
    result: { item: unknown; publishRequired: boolean },
    actor: string,
    requestId: string,
  ) => ({
    item: result.item,
    publishJob: result.publishRequired ? (await requestPublish(actor, requestId)).job : null,
  });

  return {
    list: route({}, async ({ req, admin, requestId }) => {
      const q = new URL(req.url).searchParams;
      return gas(
        `${ns}.list`,
        {
          status: q.get('status') ?? 'all',
          q: q.get('q') ?? '',
          cursor: q.get('cursor') ?? '0',
          limit: Number(q.get('limit') ?? 20),
        },
        { actor: admin.email, requestId },
      );
    }),

    create: route({ mutation: true }, async ({ req, admin, requestId }) => {
      const body = await readJson(req);
      prevalidate(spec, body, kind, true);
      return new Json(await gas(`${ns}.create`, body, { actor: admin.email, requestId }), 201);
    }),

    get: route<Params>({}, async ({ params, admin, requestId }) =>
      gas(`${ns}.get`, { id: requireIdParam(params.id) }, { actor: admin.email, requestId }),
    ),

    update: route<Params>({ mutation: true }, async ({ req, params, admin, requestId }) => {
      const body = await readJson(req);
      prevalidate(spec, body.patch ?? {}, kind, true);
      const result = await gas<{ item: unknown; publishRequired: boolean }>(
        `${ns}.update`,
        { id: requireIdParam(params.id), expected_version: requireVersion(body), patch: body.patch ?? {} },
        { actor: admin.email, requestId },
      );
      return withPublish(result, admin.email, requestId);
    }),

    setStatus: route<Params>({ mutation: true }, async ({ req, params, admin, requestId }) => {
      const body = await readJson(req);
      const result = await gas<{ item: unknown; publishRequired: boolean }>(
        `${ns}.setStatus`,
        { id: requireIdParam(params.id), expected_version: requireVersion(body), to: body.to },
        { actor: admin.email, requestId },
      );
      return withPublish(result, admin.email, requestId);
    }),

    remove: route<Params>({ mutation: true }, async ({ req, params, admin, requestId }) => {
      const body = await readJson(req);
      const result = await gas<{ item: unknown; publishRequired: boolean }>(
        `${ns}.softDelete`,
        { id: requireIdParam(params.id), expected_version: requireVersion(body) },
        { actor: admin.email, requestId },
      );
      return withPublish(result, admin.email, requestId);
    }),

    restore: route<Params>({ mutation: true }, async ({ req, params, admin, requestId }) => {
      const body = await readJson(req);
      const result = await gas<{ item: unknown }>(
        `${ns}.restore`,
        { id: requireIdParam(params.id), expected_version: requireVersion(body) },
        { actor: admin.email, requestId },
      );
      return { item: result.item, publishJob: null };
    }),

    revisions: route<Params>({}, async ({ params, admin, requestId }) =>
      gas(`${ns}.revisions`, { id: requireIdParam(params.id) }, { actor: admin.email, requestId }),
    ),
  };
}

export const postRoutes = contentRoutes('post');
export const pageRoutes = contentRoutes('page');

import { createHash, randomUUID } from 'node:crypto';
import {
  LIMITS,
  type Media,
  SETTINGS_INPUT,
  sniffImageMime,
  TAXON_INPUT,
  type TaxonomyKind,
  validateInput,
  validationError,
  ZidError,
} from '@zidcms/core';
import { env } from '../env';
import { gas } from '../gas-client';
import { Json, readJson, route } from '../http';
import { orchestratorDeps } from '../publish';
import { advanceJob } from '../publish/orchestrator';
import { prevalidate, requireIdParam, requireVersion } from './content';

type Params = { id: string };

export function taxonomyRoutes(kind: TaxonomyKind) {
  return {
    list: route({}, async ({ admin, requestId }) => gas('taxonomy.list', { kind }, { actor: admin.email, requestId })),
    create: route({ mutation: true }, async ({ req, admin, requestId }) => {
      const body = await readJson(req);
      prevalidate(TAXON_INPUT, body, kind, true);
      return new Json(await gas('taxonomy.create', { kind, fields: body }, { actor: admin.email, requestId }), 201);
    }),
    update: route<Params>({ mutation: true }, async ({ req, params, admin, requestId }) => {
      const body = await readJson(req);
      prevalidate(TAXON_INPUT, body.patch ?? {}, kind, true);
      return gas(
        'taxonomy.update',
        { kind, id: requireIdParam(params.id), expected_version: requireVersion(body), patch: body.patch ?? {} },
        { actor: admin.email, requestId },
      );
    }),
    remove: route<Params>({ mutation: true }, async ({ req, params, admin, requestId }) => {
      const body = await readJson(req);
      return gas(
        'taxonomy.softDelete',
        { kind, id: requireIdParam(params.id), expected_version: requireVersion(body) },
        { actor: admin.email, requestId },
      );
    }),
  };
}

export const mediaRoutes = {
  list: route({}, async ({ admin, requestId }) => gas('media.list', {}, { actor: admin.email, requestId })),

  upload: route({ mutation: true }, async ({ req, admin, requestId }) => {
    const length = Number(req.headers.get('content-length') ?? 0);
    if (length > LIMITS.MEDIA_BYTES + 64 * 1024)
      throw new ZidError('PAYLOAD_TOO_LARGE', 'Ukuran berkas maksimal 3 MB.');
    const form = await req.formData().catch(() => {
      throw new ZidError('BAD_REQUEST', 'Gunakan multipart/form-data.');
    });
    const file = form.get('file');
    if (!(file instanceof File)) throw new ZidError('BAD_REQUEST', 'Field "file" wajib diisi.');
    if (file.size > LIMITS.MEDIA_BYTES) throw new ZidError('PAYLOAD_TOO_LARGE', 'Ukuran berkas maksimal 3 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImageMime(bytes);
    if (!mime)
      throw new ZidError('UNSUPPORTED_MEDIA_TYPE', 'Hanya JPEG, PNG, WebP, dan GIF yang diizinkan (SVG ditolak).');
    const altText = String(form.get('alt_text') ?? '').trim();
    if (altText.length > LIMITS.ALT_TEXT) throw new ZidError('VALIDATION_ERROR', 'Teks alternatif terlalu panjang.');
    const result = await gas<{ item: Media; deduplicated: boolean }>(
      'media.upload',
      {
        filename: file.name.slice(0, 200),
        mime,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        base64: Buffer.from(bytes).toString('base64'),
        alt_text: altText,
      },
      { actor: admin.email, requestId },
    );
    const { drive_file_id: _d, ...item } = result.item;
    return new Json({ item, deduplicated: result.deduplicated }, 201);
  }),

  update: route<Params>({ mutation: true }, async ({ req, params, admin, requestId }) => {
    const body = await readJson(req);
    return gas(
      'media.update',
      {
        id: requireIdParam(params.id),
        expected_version: requireVersion(body),
        patch: { alt_text: body.alt_text ?? '' },
      },
      { actor: admin.email, requestId },
    );
  }),

  preview: route<Params>({}, async ({ params, admin, requestId }) => {
    const media = await gas<{ base64: string; mime: string }>(
      'media.getBytes',
      { id: requireIdParam(params.id) },
      { actor: admin.email, requestId },
    );
    return new Response(Buffer.from(media.base64, 'base64'), {
      headers: {
        'content-type': media.mime,
        'cache-control': 'private, max-age=3600',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  }),
};

export const settingsRoutes = {
  get: route({}, async ({ admin, requestId }) => gas('settings.get', {}, { actor: admin.email, requestId })),
  update: route({ mutation: true }, async ({ req, admin, requestId }) => {
    const body = await readJson(req);
    const { errors } = validateInput(SETTINGS_INPUT, body.patch ?? {}, { partial: true });
    if (errors.length) throw validationError(errors);
    return gas('settings.update', { patch: body.patch ?? {} }, { actor: admin.email, requestId });
  }),
};

function idempotencyKey(body: Record<string, unknown>): string {
  const key = body.idempotency_key;
  return typeof key === 'string' && key.length >= 8 && key.length <= 100 ? key : randomUUID();
}

export const publishRoutes = {
  overview: route({}, async ({ admin, requestId }) => {
    const ctx = { actor: admin.email, requestId };
    const [jobs, snapshots] = await Promise.all([
      gas('publish.listJobs', { limit: 20 }, ctx),
      gas('snapshots.list', { limit: 30 }, ctx),
    ]);
    return { jobs, snapshots };
  }),

  start: route({ mutation: true }, async ({ req, admin, requestId }) => {
    const body = await readJson(req);
    const result = await gas(
      'publish.acquire',
      { type: 'publish', idempotency_key: idempotencyKey(body) },
      { actor: admin.email, requestId },
    );
    return new Json(result, 202);
  }),

  rollback: route({ mutation: true }, async ({ req, admin, requestId }) => {
    const body = await readJson(req);
    if (typeof body.target_version !== 'number') throw new ZidError('BAD_REQUEST', 'target_version wajib diisi.');
    const result = await gas(
      'publish.acquire',
      { type: 'rollback', idempotency_key: idempotencyKey(body), target_version: body.target_version },
      { actor: admin.email, requestId },
    );
    return new Json(result, 202);
  }),

  poll: route<{ jobId: string }>({}, async ({ params, admin, requestId }) => {
    requireIdParam(params.jobId);
    return advanceJob(orchestratorDeps(admin.email, requestId), params.jobId);
  }),
};

export const healthRoute = route({}, async ({ admin, requestId }) => {
  const gasHealth = await gas('system.health', {}, { actor: admin.email, requestId }).catch((err: unknown) => ({
    error: err instanceof ZidError ? err.code : 'UPSTREAM_ERROR',
  }));
  return {
    admin: { environment: env.environment(), publishTarget: env.publishTarget(), time: new Date().toISOString() },
    gas: gasHealth,
  };
});

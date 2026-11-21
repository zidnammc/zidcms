import { randomUUID } from 'node:crypto';
import { ERROR_HTTP, ZidError } from '@zidcms/core';
import { NextResponse } from 'next/server';
import { type Admin, requireAdmin } from './auth';
import { env } from './env';
import { log } from './log';

export interface HandlerCtx<P> {
  req: Request;
  params: P;
  admin: Admin;
  requestId: string;
}

type Handler<P> = (ctx: HandlerCtx<P>) => Promise<unknown>;

export class Json {
  constructor(
    readonly body: unknown,
    readonly status: number,
  ) {}
}

export function checkOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin || origin.replace(/\/+$/, '') !== env.adminUrl()) {
    throw new ZidError('FORBIDDEN', 'Origin permintaan tidak diizinkan.');
  }
}

export function errorResponse(err: unknown, requestId: string): NextResponse {
  if (err instanceof ZidError) {
    const { status } = ERROR_HTTP[err.code];
    if (status >= 500) log('warn', 'request_failed', { code: err.code, requestId, message: err.message });
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}), requestId } },
      { status },
    );
  }
  log('error', 'unhandled_error', { requestId, error: err instanceof Error ? err.message : String(err) });
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.', requestId } },
    { status: 500 },
  );
}

export function route<P = Record<string, never>>(options: { mutation?: boolean }, handler: Handler<P>) {
  return async (req: Request, context: { params: Promise<P> }): Promise<Response> => {
    const requestId = randomUUID();
    try {
      if (options.mutation) checkOrigin(req);
      const admin = await requireAdmin();
      const result = await handler({ req, params: await context.params, admin, requestId });
      if (result instanceof Response) return result;
      if (result instanceof Json) return NextResponse.json(result.body, { status: result.status });
      return NextResponse.json(result);
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

export async function readJson(req: Request, maxBytes = 200_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ZidError('PAYLOAD_TOO_LARGE', 'Permintaan terlalu besar.');
  try {
    const value = JSON.parse(text || '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ZidError('BAD_REQUEST', 'Body harus JSON objek.');
  }
}

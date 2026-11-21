'use client';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> | undefined,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body && !isForm ? { 'content-type': 'application/json' } : undefined,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('NETWORK', 'Koneksi ke server admin terputus.', undefined, 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') window.location.href = '/login';
    const error = data?.error ?? {};
    throw new ApiError(error.code ?? 'UNKNOWN', error.message ?? `HTTP ${res.status}`, error.details, res.status);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const fields = err.details?.fields as { message: string }[] | undefined;
    return fields?.length ? fields.map((f) => f.message).join(' ') : err.message;
  }
  return err instanceof Error ? err.message : 'Terjadi kesalahan.';
}

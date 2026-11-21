export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'SLUG_CONFLICT',
  'VERSION_CONFLICT',
  'INVALID_TRANSITION',
  'PUBLISH_IN_PROGRESS',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'LOCK_TIMEOUT',
  'UPSTREAM_ERROR',
  'SIGNATURE_INVALID',
  'REQUEST_EXPIRED',
  'REPLAY_DETECTED',
  'UNKNOWN_ACTION',
  'DEPLOY_FAILED',
  'DEPLOY_TIMEOUT',
  'VERIFY_TIMEOUT',
  'GITHUB_ERROR',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP: Record<ErrorCode, { status: number; retryable: boolean }> = {
  UNAUTHENTICATED: { status: 401, retryable: false },
  FORBIDDEN: { status: 403, retryable: false },
  BAD_REQUEST: { status: 400, retryable: false },
  VALIDATION_ERROR: { status: 400, retryable: false },
  NOT_FOUND: { status: 404, retryable: false },
  SLUG_CONFLICT: { status: 409, retryable: false },
  VERSION_CONFLICT: { status: 409, retryable: false },
  INVALID_TRANSITION: { status: 409, retryable: false },
  PUBLISH_IN_PROGRESS: { status: 202, retryable: false },
  PAYLOAD_TOO_LARGE: { status: 413, retryable: false },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, retryable: false },
  LOCK_TIMEOUT: { status: 503, retryable: true },
  UPSTREAM_ERROR: { status: 502, retryable: true },
  SIGNATURE_INVALID: { status: 500, retryable: false },
  REQUEST_EXPIRED: { status: 500, retryable: false },
  REPLAY_DETECTED: { status: 500, retryable: false },
  UNKNOWN_ACTION: { status: 500, retryable: false },
  DEPLOY_FAILED: { status: 502, retryable: false },
  DEPLOY_TIMEOUT: { status: 504, retryable: false },
  VERIFY_TIMEOUT: { status: 504, retryable: false },
  GITHUB_ERROR: { status: 502, retryable: true },
  INTERNAL_ERROR: { status: 500, retryable: false },
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

export class ZidError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ZidError';
    this.code = code;
    this.details = details;
  }

  get retryable(): boolean {
    return ERROR_HTTP[this.code].retryable;
  }
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export function validationError(errors: FieldError[]): ZidError {
  return new ZidError('VALIDATION_ERROR', errors.map((e) => e.message).join(' '), { fields: errors });
}

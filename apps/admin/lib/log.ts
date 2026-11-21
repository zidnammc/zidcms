const SECRET_KEYS = /secret|token|password|authorization|cookie|hmac|base64/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function redact(value: unknown, key = ''): unknown {
  if (SECRET_KEYS.test(key)) return '[redacted]';
  if (typeof value === 'string') return value.replace(EMAIL, '$1***@$2');
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (level === 'debug' && process.env.LOG_LEVEL !== 'debug') return;
  const line = JSON.stringify({ level, msg, at: new Date().toISOString(), ...(redact(fields) as object) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

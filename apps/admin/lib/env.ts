import { ZidError } from '@zidcms/core';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ZidError('INTERNAL_ERROR', `Konfigurasi server ${name} belum diatur.`);
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  adminEmails(): string[] {
    return optional('ADMIN_EMAILS')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  adminUrl: () => required('ADMIN_URL').replace(/\/+$/, ''),
  publicSiteUrl: () => required('PUBLIC_SITE_URL').replace(/\/+$/, ''),
  gasUrl: () => required('GAS_WEBAPP_URL'),
  gasSecret: () => required('GAS_HMAC_SECRET'),
  publishTarget: (): 'github' | 'local' => (optional('PUBLISH_TARGET', 'github') === 'local' ? 'local' : 'github'),
  githubToken: () => required('GITHUB_TOKEN'),
  githubRepo: () => required('GITHUB_REPO'),
  githubBranch: () =>
    optional('GITHUB_BRANCH', optional('ZIDCMS_ENV', 'dev').toLowerCase() === 'prod' ? 'release' : 'main'),
  contentRoot: () =>
    optional(
      'CONTENT_ROOT',
      `apps/web/content/${optional('ZIDCMS_ENV', 'dev').toLowerCase() === 'prod' ? 'prod' : 'dev'}`,
    ).replace(/^\/+|\/+$/g, ''),
  vercelStatusContext: () => optional('VERCEL_STATUS_CONTEXT', 'Vercel'),
  environment: (): 'DEV' | 'PROD' => (optional('ZIDCMS_ENV', 'dev').toLowerCase() === 'prod' ? 'PROD' : 'DEV'),
  devLoginEnabled: () =>
    process.env.NODE_ENV === 'development' && !process.env.VERCEL && optional('ZIDCMS_DEV_LOGIN') === 'true',
};

export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.adminEmails().includes(email.trim().toLowerCase());
}

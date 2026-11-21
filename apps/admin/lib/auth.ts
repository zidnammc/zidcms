import { ZidError } from '@zidcms/core';
import { redirect } from 'next/navigation';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { allowSignIn } from './auth-policy';
import { env, isAllowedAdmin } from './env';

const providers = [
  Google({ authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } } }),
  ...(env.devLoginEnabled()
    ? [
        Credentials({
          id: 'dev-login',
          name: 'Dev login (lokal saja)',
          credentials: { email: { label: 'Email', type: 'email' } },
          authorize(credentials) {
            const email = String(credentials?.email ?? '').toLowerCase();
            return isAllowedAdmin(email) ? { id: email, email, name: email } : null;
          },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    signIn({ account, profile, user }) {
      return allowSignIn({
        provider: account?.provider,
        email: account?.provider === 'google' ? profile?.email : user.email,
        emailVerified: profile?.email_verified as boolean | undefined,
      });
    },
  },
});

export interface Admin {
  email: string;
}

export async function requireAdmin(): Promise<Admin> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) throw new ZidError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.');
  if (!isAllowedAdmin(email)) throw new ZidError('FORBIDDEN', 'Akun ini tidak diizinkan.');
  return { email };
}

export async function requireAdminPage(): Promise<Admin> {
  try {
    return await requireAdmin();
  } catch (err) {
    if (err instanceof ZidError && (err.code === 'UNAUTHENTICATED' || err.code === 'FORBIDDEN')) {
      redirect(err.code === 'FORBIDDEN' ? '/login?error=AccessDenied' : '/login');
    }
    throw err;
  }
}

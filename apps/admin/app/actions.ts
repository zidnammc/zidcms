'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/lib/auth';
import { env } from '@/lib/env';

export async function signInWithGoogle() {
  await signIn('google', { redirectTo: '/' });
}

export async function signInDev(formData: FormData) {
  if (!env.devLoginEnabled()) return;
  try {
    await signIn('dev-login', { email: String(formData.get('email') ?? ''), redirectTo: '/' });
  } catch (err) {
    if (err instanceof AuthError) redirect(`/login?error=${err.type}`);
    throw err;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}

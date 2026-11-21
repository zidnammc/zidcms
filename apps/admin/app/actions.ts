'use server';

import { signIn, signOut } from '@/lib/auth';
import { env } from '@/lib/env';

export async function signInWithGoogle() {
  await signIn('google', { redirectTo: '/' });
}

export async function signInDev(formData: FormData) {
  if (!env.devLoginEnabled()) return;
  await signIn('dev-login', { email: String(formData.get('email') ?? ''), redirectTo: '/' });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}

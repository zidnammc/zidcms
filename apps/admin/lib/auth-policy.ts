import { env, isAllowedAdmin } from './env';

export interface SignInAttempt {
  provider: string | undefined;
  email: string | null | undefined;
  emailVerified?: boolean | null;
}

export function allowSignIn(attempt: SignInAttempt): boolean {
  if (attempt.provider === 'google') return attempt.emailVerified === true && isAllowedAdmin(attempt.email);
  if (attempt.provider === 'dev-login') return env.devLoginEnabled() && isAllowedAdmin(attempt.email);
  return false;
}

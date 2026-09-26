import type { AuthError } from '@supabase/supabase-js';

/** Supabase auth error → the translation key the UI should show. */
export function authErrorKey(error: AuthError | null | undefined): string {
  switch (error?.code) {
    case 'invalid_credentials':
      return 'errorCredentials';
    case 'email_not_confirmed':
      return 'errorNotConfirmed';
    case 'weak_password':
      return 'errorPassword';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'errorEmail';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'errorRateLimit';
    default:
      return 'errorGeneric';
  }
}

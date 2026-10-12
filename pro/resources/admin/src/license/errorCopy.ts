import { __, _n, sprintf } from '@wordpress/i18n';
import type { LicenseError } from './api';

/**
 * What a refusal from the store, the SDK or the route means to a person, and
 * the one or two ways forward from it.
 *
 * The codes are the store's and the SDK's own (`LicenseErrorCode`); several
 * name one situation, so they share words. **An unknown code is never blank**
 * (P6): it is shown with its code, beside Try again and Contact support, so a
 * future store's new refusal still reads as something and can be reported.
 */
export type Way = 'sign_in' | 'find_key' | 'renew' | 'sites' | 'upgrade' | 'retry' | 'support';

export interface ErrorCopy { text: string; ways: Way[] }

/**
 * @param fromConfig The key came from wp-config.php (P3): the refusal is about
 *        that key, and the fix is in the file, not in a field on this page.
 */
export function errorCopy(error: LicenseError, { host = 'my.wconvert.io', fromConfig = false }: { host?: string; fromConfig?: boolean } = {}): ErrorCopy {
  if (fromConfig && ['invalid_key', 'not_found', 'wrong_product'].includes(error.code)) {
    return { text: __('The key in wp-config.php wasn’t found. Check WCONVERT_LICENSE_KEY against your purchase email.', 'wconvert-pro'), ways: [] };
  }

  switch (error.code) {
    case 'empty':
      return { text: __('Enter your license key.', 'wconvert-pro'), ways: [] };
    case 'invalid_key':
    case 'not_found':
      return { text: __('That key wasn’t found.', 'wconvert-pro'), ways: ['sign_in'] };
    case 'wrong_product':
      return { text: __('This key is for another product.', 'wconvert-pro'), ways: ['find_key'] };
    case 'license_expired':
      return { text: __('This license expired.', 'wconvert-pro'), ways: ['renew'] };
    case 'activation_limit_reached':
    case 'not_enough_seats':
      return { text: __('All sites on this license are in use. Free one in your account, then try again.', 'wconvert-pro'), ways: ['sites', 'upgrade', 'retry'] };
    case 'key_disabled':
    case 'license_suspended':
      return { text: __('This license was turned off.', 'wconvert-pro'), ways: ['support'] };
    case 'rate_limited': {
      const minutes = Math.max(1, Math.ceil((error.data?.retry_after ?? 60) / 60));
      return { text: sprintf(_n('Too many tries. Try again in %d minute.', 'Too many tries. Try again in %d minutes.', minutes, 'wconvert-pro'), minutes), ways: [] };
    }
    case 'network_error':
    case 'server_error':
    case 'invalid_response':
      return { text: sprintf(__('Couldn’t reach the license server. Some hosts block outgoing connections. Ask yours to allow %s.', 'wconvert-pro'), host), ways: ['retry'] };
    case 'account_expired':
    case 'token_expired':
      return { text: __('Your sign-in timed out. Sign in again.', 'wconvert-pro'), ways: [] };
    case 'key_from_constant':
      return { text: __('The license key is set in wp-config.php. Change it there.', 'wconvert-pro'), ways: [] };
    case 'sign_in_other_user':
      return { text: __('Another administrator is signing in to the account. Try again when they’re done.', 'wconvert-pro'), ways: [] };
    case 'license_not_on_account':
      return { text: __('That license isn’t on this account any more.', 'wconvert-pro'), ways: ['retry'] };
    default:
      /* translators: %s: the error code, for support */
      return { text: sprintf(__('Something went wrong (%s).', 'wconvert-pro'), error.code), ways: ['retry', 'support'] };
  }
}

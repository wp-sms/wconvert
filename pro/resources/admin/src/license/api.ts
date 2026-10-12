import apiFetch from '@wordpress/api-fetch';
import type { LicensePayload } from './describeLicense';

/**
 * The License page's one door: `wconvert/v1/license` (`LicenseController`).
 *
 * Every change answers with the whole licence again, so the page re-renders
 * from one shape and the header badge is redrawn from the same answer. A
 * refusal rejects with WordPress's REST error body — `{ code, message, data }`
 * — and the page maps the code to words (`errorCopy`).
 */
const PATH = '/wconvert/v1/license';

export interface Released { removed_remotely: boolean; error_code: string | null }
export type Changed = LicensePayload & { released?: Released };

export interface AccountLicense {
  id: number;
  plan: string;
  status: string;
  key_masked: string;
  ends_at: string | null;
  auto_renews: boolean | null;
  used: number;
  max: number | null;
  here: boolean;
  full: boolean;
}

export interface Account {
  signed_in: boolean;
  email_masked: string | null;
  licenses: AccountLicense[];
  error_code: string | null;
  message: string | null;
}

/** A refusal as the server sent it. */
export interface LicenseError { code: string; message?: string; data?: { status?: number; retry_after?: number | null } }

export const readLicense = (check = false) =>
  apiFetch<LicensePayload>({ path: check ? `${PATH}?check=1` : PATH });

export const activateKey = (key: string) =>
  apiFetch<Changed>({ path: `${PATH}/activate`, method: 'POST', data: { key } });

export const replaceKey = (key: string) =>
  apiFetch<Changed>({ path: `${PATH}/replace`, method: 'POST', data: { key } });

/** Activate the stored key here again (the store no longer lists this site). */
export const reactivate = () =>
  apiFetch<Changed>({ path: `${PATH}/reactivate`, method: 'POST' });

export const removeLicense = () =>
  apiFetch<Changed>({ path: PATH, method: 'DELETE' });

export const removeSite = (domain: string) =>
  apiFetch<Changed>({ path: `${PATH}/sites/${encodeURIComponent(domain)}`, method: 'DELETE' });

/** Leaving `keepOld` out lets the SDK decide, which never frees a live site for a copy. */
export const moveLicense = (keepOld?: boolean) =>
  apiFetch<Changed>({ path: `${PATH}/move`, method: 'POST', data: keepOld === undefined ? {} : { keep_old: keepOld } });

export const checkUpdates = () =>
  apiFetch<{ updates: LicensePayload['updates'] }>({ path: `${PATH}/updates/check`, method: 'POST' });

export const signIn = () =>
  apiFetch<{ url: string }>({ path: `${PATH}/account/sign-in`, method: 'POST' });

export const readAccount = () =>
  apiFetch<Account>({ path: `${PATH}/account` });

export const chooseLicense = (licenseId: number) =>
  apiFetch<Changed>({ path: `${PATH}/account/choose`, method: 'POST', data: { license_id: licenseId } });

export const signOut = () =>
  apiFetch<{ signed_in: false }>({ path: `${PATH}/account`, method: 'DELETE' });

/** Leaves for the store's sign-in; it brings the merchant back to `#license`. */
export function goSignIn(onError: (error: LicenseError) => void): void {
  signIn().then(({ url }) => { window.location.assign(url); }, (cause) => onError(asLicenseError(cause)));
}

export function asLicenseError(cause: unknown): LicenseError {
  if (typeof cause === 'object' && cause !== null && 'code' in cause && typeof cause.code === 'string') {
    return cause as LicenseError;
  }

  return { code: 'unknown', message: cause instanceof Error ? cause.message : undefined };
}

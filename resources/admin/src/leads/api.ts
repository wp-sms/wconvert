import apiFetch from '@wordpress/api-fetch';
import { adminSettings } from '../settings';

/** One [[Lead]] — one capture event, as `GET /wconvert/v1/leads` returns it. */
export interface Lead {
  id: string;
  optin_id: string;
  email: string | null;
  phone: string | null;
  fields: Record<string, string>;
  created_at: string;
}

/**
 * The Leads sharing one identifier, collapsed for reading.
 *
 * **It is not a person, and `submissions` is not a count of people.**
 * Identifiers are optional and one person may submit under two of them, so
 * the number of groups is a count of identifiers seen — a different quantity
 * wearing the same clothes. Nothing in this file reports it as a total.
 */
export interface LeadGroup {
  identifier: string;
  submissions: number;
  latest_id: string;
  latest_at: string | null;
}

/**
 * **One total, and it is `submissions`.**
 *
 * The toggle changes what a row is and nothing else. That is a property of the
 * server's payload rather than of this type — see `WConvert\Lead\LeadLog` —
 * and the type is written to match so that a component cannot reach for a
 * second number that is not there.
 */
export interface LeadLog {
  submissions: number;
  grouped: boolean;
  leads: Lead[];
  groups: LeadGroup[];
}

export interface Retention {
  days: number | null;
  max_days: number;
}

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const readLog = (optinId: string, grouped: boolean) =>
  apiFetch<LeadLog>({
    path: `/wconvert/v1/leads?${query({
      ...(optinId === '' ? {} : { optin_id: optinId }),
      grouped: grouped ? '1' : '0',
    })}`,
  });

export const readRetention = () => apiFetch<Retention>({ path: '/wconvert/v1/leads/retention' });

export const saveRetention = (days: number | null) =>
  apiFetch<Retention>({ path: '/wconvert/v1/leads/retention', method: 'POST', data: { days } });

/**
 * The CSV download, as a URL rather than a fetch.
 *
 * A download is a navigation: the browser needs the `Content-Disposition` the
 * server sends, and `apiFetch` would read the file into memory and then have
 * to turn it back into one. The nonce is bound to the action, so appending a
 * filter here does not invalidate it.
 */
export const exportUrl = (optinId: string): string | null => {
  const base = adminSettings()?.exportUrl;

  if (base === undefined) {
    return null;
  }

  return optinId === '' ? base : `${base}&optin_id=${encodeURIComponent(optinId)}`;
};

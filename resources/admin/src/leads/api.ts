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
 * server's payload rather than of this type — see `WConvert\Lead\LeadLog`.
 * Optional purpose counts describe the same submission events under each
 * purpose; neither those counts nor grouping count people.
 */
export interface LeadLog {
  purpose_counts?: { all: number; subscribers: number; enquiries: number };
  submissions: number;
  grouped: boolean;
  leads: Lead[];
  groups: LeadGroup[];
  next_cursor: string | null;
  snapshot: string;
}

/** Shareable filters. Grouping and paging change the view, not this search scope. */
export interface LeadQuery {
  order?: 'oldest';
  search?: string;
  purpose?: 'subscribers' | 'enquiries';
  optinId?: string;
  identifier?: string;
  leadId?: string;
  from?: string;
  to?: string;
}

export interface LeadPage extends LeadQuery {
  includeCounts?: boolean;
  grouped?: boolean;
  cursor?: string;
  snapshot?: string;
  groupIdentifier?: string;
}

export interface Retention {
  days: number | null;
  max_days: number;
}

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const leadParams = (filter: LeadPage): Record<string, string> => Object.fromEntries(
  Object.entries({ optin_id: filter.optinId, identifier: filter.identifier, lead_id: filter.leadId,
    search: filter.search, purpose: filter.purpose, order: filter.order,
    from: filter.from, to: filter.to, cursor: filter.cursor, snapshot: filter.snapshot,
    group_identifier: filter.groupIdentifier }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''),
);

export const readLog = (filter: LeadPage = {}) =>
  apiFetch<LeadLog>({
    path: `/wconvert/v1/leads?${query({
      ...leadParams(filter),
      grouped: filter.grouped ? '1' : '0',
      ...(filter.includeCounts ? { include_counts: '1' } : {}),
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
export const exportUrl = (filter: LeadPage = {}): string | null => {
  const base = adminSettings()?.exportUrl;

  if (base === undefined) {
    return null;
  }

  const params = leadParams({ ...filter, cursor: undefined });
  return Object.keys(params).length === 0 ? base : `${base}&${query(params)}`;
};

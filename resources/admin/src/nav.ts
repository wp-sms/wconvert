import { __ } from '@wordpress/i18n';
import type { LeadQuery } from './leads/api';

/**
 * The admin's sections, and the translation between one and a URL hash.
 *
 * **The v1 map decided "conventional nav in v1"** and the screen shipped
 * without any: the goal picker, the Optin list, analytics, the lead log and
 * Destinations were five headings in one scroll, so "create an Optin" occupied
 * the top of the screen on every visit and everything below it moved further
 * down as a site accumulated real data. This is that decision, built.
 *
 * **Hash, not a query parameter.** WordPress owns the query string on
 * `admin.php` — `page=wconvert` is how the screen is reached at all — and a
 * second parameter beside it is a round trip to PHP to render a screen React
 * already holds. A hash changes no request, survives a reload and a bookmark,
 * and gives the browser's back button something real to do. It is what WSMS's
 * admin does for the same reason.
 *
 * The mapping lives here rather than in the tab strip because it is not
 * chrome. #29 drew that line — *"Not a TDD seam: React component structure,
 * panel layout, gallery chrome"* — and which section a URL names sits on the
 * other side of it: a bookmark, a reload and an unknown hash are behaviour.
 */
export type SectionId = 'optins' | 'analytics' | 'leads' | 'settings';
export type SettingsGroup = 'experience' | 'connections' | 'data';

export interface Section {
  id: SectionId;
  label: string;
}

/**
 * Ordered as a merchant meets them: what exists, how it is doing, what it
 * captured, shared site setup. Settings groups frequency, destinations and
 * retention; the daily screens retain contextual shortcuts (ADR 0091).
 */
export const SECTIONS: readonly Section[] = [
  { id: 'optins', label: __('Campaigns', 'wconvert') },
  { id: 'analytics', label: __('Analytics', 'wconvert') },
  { id: 'leads', label: __('Leads', 'wconvert') },
  { id: 'settings', label: __('Settings', 'wconvert') },
];

/**
 * **The Optin list, not the creation flow.**
 *
 * The screen a merchant reaches most often is the one showing what they
 * already have; creation is a thing they do a handful of times. Landing on the
 * goal picker is what the single-scroll layout did by accident, and it put the
 * rarest task in the most expensive position.
 */
export const DEFAULT_SECTION: SectionId = 'optins';

const IDS: ReadonlySet<string> = new Set(SECTIONS.map((section) => section.id));

/**
 * Which section a hash names, or the default.
 *
 * **Falls back rather than rendering nothing.** A hash is user-editable and
 * outlives a release: a bookmark saved against a section since renamed would
 * otherwise open a blank screen, which reads as a broken plugin rather than as
 * a stale link.
 *
 * Accepts the hash with or without its `#`, because `location.hash` carries
 * one and a hand-written link may not.
 */
export function sectionFrom(hash: string): SectionId {
  const id = hash.replace(/^#/, '').split('?')[0];

  if (id === 'destinations') return 'settings';

  return IDS.has(id) ? (id as SectionId) : DEFAULT_SECTION;
}

/**
 * The hash that names a section, for an `href` a browser will navigate to.
 *
 * A real `href` rather than a click handler on a `<span>`: it is what makes
 * the tabs middle-clickable, copyable and reachable by keyboard without any
 * of that being re-implemented.
 */
export function hashFor(id: SectionId): string {
  return `#${id}`;
}

/** Read-state links stay inside WordPress's existing admin page. */
export interface ReportQuery {
  month?: string;
  days?: number;
  goal?: string;
  optinId?: string;
  impact?: string;
  experiment?: string;
  compare?: boolean;
}

export interface AdminRoute {
  section: SectionId;
  editId?: string;
  returnTo: string;
  report: ReportQuery;
  leads: LeadQuery;
  destinationId?: string;
  settingsGroup: SettingsGroup;
  leadsView: 'submissions' | 'issues';
}

function withQuery(
  section: SectionId,
  values: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return hashFor(section) + (query.size > 0 ? `?${query.toString()}` : '');
}

function returnHref(value: string | null): string {
  if (!value?.startsWith('#') || value.length > 2048) return hashFor('optins');
  const [section, ...query] = value.slice(1).split('?');
  // Returning to another editor can form an endless nested back-link chain.
  return (IDS.has(section) || section === 'destinations') && !new URLSearchParams(query.join('?')).has('edit')
    ? value
    : hashFor('optins');
}

export const editorHref = (id: string, returnTo?: string): string =>
  withQuery('optins', {
    edit: id,
    back: returnTo ? returnHref(returnTo) : undefined,
  });
export const reportHref = (query: ReportQuery = {}): string =>
  withQuery('analytics', {
    month: query.month,
    days: query.month ? undefined : query.days,
    goal: query.goal,
    optin: query.optinId,
    impact: query.impact,
    experiment: query.experiment,
    compare: query.compare === false ? '0' : undefined,
  });
export const leadsHref = (query: LeadQuery = {}): string =>
  withQuery('leads', {
    order: query.order,
    purpose: query.purpose,
    optin: query.optinId,
    lead: query.leadId,
    from: query.from,
    to: query.to,
  });
export const destinationHref = (id?: string): string =>
  withQuery('settings', { group: 'connections', destination: id });
export const settingsHref = (group: SettingsGroup = 'experience'): string =>
  withQuery('settings', { group });
export const sendingIssuesHref = (): string => withQuery('leads', { view: 'issues' });

export function routeFrom(hash: string): AdminRoute {
  const section = sectionFrom(hash);
  const params = new URLSearchParams(hash.split('?').slice(1).join('?'));
  const value = (key: string) => params.get(key) || undefined;
  const days = Number(params.get('days'));
  return {
    section,
    editId: section === 'optins' ? value('edit') : undefined,
    returnTo: returnHref(params.get('back')),
    report: {
      ...(value('month') &&
      /^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/.test(value('month')!)
        ? { month: value('month') }
        : {}),
      days:
        Number.isInteger(days) && days >= 1 && days <= 366 ? days : undefined,
      goal: value('goal'),
      optinId: value('optin'),
      ...(value('impact') ? { impact: value('impact') } : {}),
      ...(value('experiment') ? { experiment: value('experiment') } : {}),
      ...(value('compare') === '0' ? { compare: false } : {}),
    },
    leads: {
      ...(value('order') === 'oldest' ? { order: 'oldest' as const } : {}),
      ...(value('purpose') === 'subscribers' || value('purpose') === 'enquiries' ? { purpose: value('purpose') as LeadQuery['purpose'] } : {}),
      optinId: value('optin'),
      leadId: value('lead'),
      from: value('from'),
      to: value('to'),
    },
    destinationId: value('destination'),
    settingsGroup: hash.replace(/^#/, '').split('?')[0] === 'destinations' || value('group') === 'connections'
      ? 'connections' : value('group') === 'data' ? 'data' : 'experience',
    leadsView: value('view') === 'issues' ? 'issues' : 'submissions',
  };
}

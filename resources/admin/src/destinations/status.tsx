import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Lock } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { isFreeInstall, tierName, tierProductName } from '../goals/availability';
import { settingsProblems } from './requirements';
import type { Connection, Destination, DestinationType } from './api';

export type DestinationState = 'failing' | 'not_available' | 'locked' | 'paused' | 'needs_setup' | 'not_used' | 'success';

export interface DestinationStatus {
  readonly state: DestinationState;
  readonly badge: ReactNode;
  /** Why it cannot send, in one sentence — null where nothing is wrong. */
  readonly issue: string | null;
}

/**
 * What stops this route sending that the merchant can fix in its settings: an
 * empty required setting, or an account it has no connection to.
 *
 * Read from SAVED settings. The Settings screen also lists the problems of its
 * unsaved draft, beside the fields; the badge describes what dispatch sees.
 */
export function setupProblems(destination: Destination, type: DestinationType | undefined, connections: readonly Connection[]): string[] {
  const problems = settingsProblems(destination.requirements ?? type?.requirements, destination.settings);
  if (connectionMissing(destination, type, connections)) {
    problems.unshift(__('Connect an account before this destination can send.', 'wconvert'));
  }
  return problems;
}

/** A type that runs over an account, saved with none of that type's accounts. */
export function connectionMissing(destination: Destination, type: DestinationType | undefined, connections: readonly Connection[]): boolean {
  return type?.needs_connection === true
    && !connections.some((connection) => connection.id === destination.connection && connection.type === destination.type);
}

/**
 * **One badge, one order, on both screens that show a route's health.**
 *
 * Settings drew this inline and the Campaign editor drew nothing, so the two
 * could only drift. The order is what a merchant needs to act on first: an
 * outage outranks a missing plugin, which outranks an unfinished setup, and
 * "not used yet" is never said about a route that could not be used.
 *
 * `locked` and `unavailable` stay two states with two sentences (ADR 0026),
 * and a free install names no product for a route saved under Pro (ADR 0116).
 */
export function destinationStatus(destination: Destination, type: DestinationType | undefined, problems: readonly string[]): DestinationStatus {
  const failures = destination.health.consecutive_failures;
  if (failures > 0) {
    return {
      state: 'failing',
      badge: <Badge variant="destructive">{__('Failing', 'wconvert')}</Badge>,
      issue: sprintf(
        /* translators: 1: number of failures in a row, 2: the last error. */
        _n('%1$d failure in a row. Last error: %2$s', '%1$d failures in a row. Last error: %2$s', failures, 'wconvert'),
        failures,
        destination.health.last_error ?? '',
      ),
    };
  }
  if (destination.availability === 'locked' && isFreeInstall()) {
    return {
      state: 'not_available',
      badge: <Badge variant="secondary">{__('Not available', 'wconvert')}</Badge>,
      issue: __('This destination type isn’t available on this site, so captures are kept here, not sent.', 'wconvert'),
    };
  }
  if (destination.availability === 'locked') {
    return {
      state: 'locked',
      badge: <Badge variant="secondary"><Lock aria-hidden="true" />{tierName(type?.tier)}</Badge>,
      issue: sprintf(
        /* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */
        __('Needs %s, so captures are kept here, not sent. Re-push from Destinations once it runs.', 'wconvert'),
        tierProductName(type?.tier),
      ),
    };
  }
  if (destination.availability === 'unavailable') {
    return {
      state: 'paused',
      badge: <Badge variant="warning">{__('Paused', 'wconvert')}</Badge>,
      issue: sprintf(
        /* translators: %s: the plugin or platform it needs, e.g. “WP SMS”. */
        __('Needs %s on this site, so captures are kept here, not sent. Re-push from Destinations once it runs.', 'wconvert'),
        type?.requires_label ?? __('something this site does not have', 'wconvert'),
      ),
    };
  }
  if (problems.length > 0) {
    return { state: 'needs_setup', badge: <Badge variant="warning">{__('Needs setup', 'wconvert')}</Badge>, issue: problems[0] };
  }
  return destination.health.last_success_at === null
    ? { state: 'not_used', badge: <Badge variant="secondary">{__('Not used yet', 'wconvert')}</Badge>, issue: null }
    : { state: 'success', badge: <Badge variant="success">{__('Success recorded', 'wconvert')}</Badge>, issue: null };
}

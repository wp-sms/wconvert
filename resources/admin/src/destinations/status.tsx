import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { CircleAlert, CircleCheck, Info, Lock, type LucideIcon } from 'lucide-react';
import { Alert, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { isFreeInstall, tierName, tierProductName } from '../goals/availability';
import { formatCount } from '../lib/format';
import { cn } from '../lib/utils';
import { settingsProblems } from './requirements';
import type { Connection, Destination, DestinationType, TestReport } from './api';

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
 * "no sends yet" is never said about a route that could not be used.
 *
 * `locked` and `unavailable` stay two states with two sentences (ADR 0026),
 * and a free install names no product for a route saved under Pro (ADR 0116).
 *
 * **These sentences are written nowhere else.** The Settings card used to
 * carry its own copies ("…are not being sent") beside these ("…are kept here,
 * not sent"), which is the drift this function exists to stop.
 */
/** `bound`: drawn inside a campaign that chose it, saved or not, so it is in a campaign by definition. */
export function destinationStatus(destination: Destination, type: DestinationType | undefined, problems: readonly string[], bound = false): DestinationStatus {
  const failures = destination.health.consecutive_failures;
  if (failures > 0) {
    return {
      state: 'failing',
      badge: <Badge variant="destructive">{__('Failing', 'wconvert')}</Badge>,
      issue: sprintf(
        /* translators: 1: number of failures in a row, 2: the last error, in the provider's words. */
        _n('%1$s failure in a row. Last error: %2$s', '%1$s failures in a row. Last error: %2$s', failures, 'wconvert'),
        formatCount(failures),
        destination.health.last_error ?? '',
      ),
    };
  }
  if (destination.availability === 'locked' && isFreeInstall()) {
    return {
      state: 'not_available',
      badge: <Badge variant="secondary">{__('Not available', 'wconvert')}</Badge>,
      issue: __('This destination type isn’t available on this site, so submissions are kept in WConvert and not sent.', 'wconvert'),
    };
  }
  if (destination.availability === 'locked') {
    return {
      state: 'locked',
      badge: <Badge variant="secondary"><Lock aria-hidden="true" />{tierName(type?.tier)}</Badge>,
      issue: sprintf(
        /* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */
        __('Needs %s, so submissions are kept in WConvert and not sent until it runs.', 'wconvert'),
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
        __('Needs %s on this site, so submissions are kept in WConvert and not sent until it runs.', 'wconvert'),
        type?.requires_label ?? __('something this site does not have', 'wconvert'),
      ),
    };
  }
  if (problems.length > 0) {
    return { state: 'needs_setup', badge: <Badge variant="warning">{__('Needs setup', 'wconvert')}</Badge>, issue: problems[0] };
  }
  /*
   * **"Not used yet" said two different things**, and neither was a fault: a
   * route no campaign has chosen, and one a campaign feeds that has simply had
   * no submission. `usage` is the saved bindings, so an empty list is the first
   * and anything else — including a usage read that failed — the second, which
   * is the one that stays true either way.
   */
  if (destination.health.last_success_at === null) {
    return {
      state: 'not_used',
      badge: <Badge variant="secondary">{!bound && Array.isArray(destination.usage) && destination.usage.length === 0
        ? __('Not in a campaign', 'wconvert') : __('No sends yet', 'wconvert')}</Badge>,
      issue: null,
    };
  }
  // "Working", not "Success recorded": the badge answers the merchant's
  // question, and the record is the "Last sent" line beside it.
  return { state: 'success', badge: <Badge variant="success">{__('Working', 'wconvert')}</Badge>, issue: null };
}

/**
 * Why a send to this route would be refused before it is pressed, or null
 * where it can run. One sentence for every place that offers a test or a
 * send, so Settings and the campaign editor refuse alike (ADR 0042).
 */
export function sendRefusal(destination: Destination, problems: readonly string[]): string | null {
  if (destination.availability !== 'ready') return __('Not running on this site.', 'wconvert');
  return problems.length > 0 ? __('Finish setup first.', 'wconvert') : null;
}

/**
 * **One rendering for what a test answered**, wherever it is shown — the
 * route's card, the Send a test dialog and an account's check drew the same
 * report three ways, and only one of them used colour.
 *
 * `skipped` is NEUTRAL: a route whose type this install cannot run has not
 * failed, and red would tell a merchant with no WP SMS that their WP SMS route
 * is broken when the plugin is simply not installed (ADR 0026). The message is
 * the provider's own words where it supplied any; React escapes it.
 */
const TEST_RENDERING: Record<TestReport['outcome'], { className: string; icon: LucideIcon }> = {
  success: { className: 'border-success/30 bg-success-surface text-success', icon: CircleCheck },
  skipped: { className: 'border-border bg-surface text-muted-foreground', icon: Info },
  failed: { className: 'border-destructive/30 bg-destructive-surface text-destructive', icon: CircleAlert },
};

export function TestReportAlert({ report, className }: { report: TestReport; className?: string }) {
  const { className: tone, icon: Icon } = TEST_RENDERING[report.outcome];
  return (
    <Alert role={report.outcome === 'failed' ? 'alert' : 'status'} className={cn(tone, '[overflow-wrap:anywhere]', className)}>
      <Icon />
      <AlertTitle className="line-clamp-none">{report.message}</AlertTitle>
    </Alert>
  );
}

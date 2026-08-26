import apiFetch from '@wordpress/api-fetch';
import type { Availability } from '../goals/availability';

/**
 * The three states, and how a surface renders them, come from
 * `../goals/availability` — **one spelling and one cascade**, because a
 * condition written out per screen is how `unavailable` eventually renders as
 * an upsell on the screen nobody re-read (ADR 0026).
 */
export type { Availability } from '../goals/availability';

/** One field a Destination type offers, from its `settingsSchema()`. */
export interface SettingsField {
  type: string;
  label: string;
  description?: string;
}

/** A kind of [[Destination]] this install can reach — WSMS, and Pro's ESPs. */
export interface DestinationType {
  id: string;
  label: string;
  icon: string;
  tier: 'free' | 'pro';
  /** The slug — never copy. Use `requires_label`. */
  requires: string | null;
  /** What the site is missing, in words the merchant can act on. */
  requires_label: string | null;
  availability: Availability;
  needs_connection: boolean;
  settings_schema: Record<string, SettingsField>;
}

/**
 * **Delivery state, at the only grain WConvert keeps it.**
 *
 * There is no per-[[Lead]] delivery record and there is not going to be one:
 * `push()` is idempotent, so exact per-Lead state buys efficiency rather than
 * correctness (ADR 0008). What a merchant reads is this.
 */
export interface DestinationHealth {
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  /** **Outages only.** A terminal per-Lead failure leaves this at zero. */
  consecutive_failures: number;
  /**
   * Captures that were never enqueued, because this Destination's type is not
   * `ready` here — a deactivated plugin, a lapsed licence.
   *
   * **Neither a failure nor a success**, which is why it is its own number:
   * nothing was attempted, so counting it as an outage would be a lie, and
   * saying nothing at all is how a merchant loses a fortnight of pushes with
   * an Optin that looks like it is working (#4).
   */
  skipped_captures: number;
  last_skipped_at: string | null;
}

export interface Destination {
  id: string;
  type: string;
  label: string;
  connection: string | null;
  settings: Record<string, unknown>;
  availability: Availability;
  health: DestinationHealth;
}

/** Credentials come back masked and never as values (#4). */
export interface Connection {
  id: string;
  type: string;
  label: string;
  credentials: Record<string, string>;
}

/**
 * One terminal failure — **a Lead id and an error, never Lead data.** This
 * option outlives WConvert's own retention policy, so personal data in it
 * would be personal data with no expiry (ADR 0008, ADR 0018).
 */
export interface DeliveryFailure {
  destination: string;
  lead: string;
  error: string;
  at: string;
}

export interface DestinationsPayload {
  types: DestinationType[];
  destinations: Destination[];
  connections: Connection[];
  failures: DeliveryFailure[];
}

export interface RePushReport {
  jobs: number;
  /** A truncated replay must never read as a complete one. */
  capped: boolean;
  since: string | null;
}

const path = (suffix = '') => `/wconvert/v1/destinations${suffix}`;

export const readDestinations = () => apiFetch<DestinationsPayload>({ path: path() });

export const saveDestination = (destination: {
  id?: string;
  type: string;
  label: string;
  connection?: string | null;
  settings?: Record<string, unknown>;
}) =>
  apiFetch<{ destinations: Destination[] }>({ path: path(), method: 'POST', data: destination });

export const deleteDestination = (id: string) =>
  apiFetch<{ destinations: Destination[] }>({ path: path(`/${id}`), method: 'DELETE' });

/**
 * Replay every Lead for Optins bound to this Destination since its last
 * success — **merchant-driven, never automatic** (ADR 0008).
 */
export const rePush = (id: string) =>
  apiFetch<RePushReport>({ path: path(`/${id}/repush`), method: 'POST' });

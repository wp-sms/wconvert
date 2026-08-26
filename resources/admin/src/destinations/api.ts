import apiFetch from '@wordpress/api-fetch';

/**
 * Three states, and the distinction between the last two is load-bearing: a
 * missing tier is buyable from us and a missing plugin is not (ADR 0026).
 */
export type Availability = 'ready' | 'locked' | 'unavailable';

/** A kind of [[Destination]] this install can reach — WSMS, and Pro's ESPs. */
export interface DestinationType {
  id: string;
  label: string;
  icon: string;
  tier: 'free' | 'pro';
  requires: string | null;
  availability: Availability;
  needs_connection: boolean;
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

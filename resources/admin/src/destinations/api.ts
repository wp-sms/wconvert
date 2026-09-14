import apiFetch from '@wordpress/api-fetch';
import type { Availability } from '../goals/availability';

/**
 * The three states, and how a surface renders them, come from
 * `../goals/availability` — **one spelling and one cascade**, because a
 * condition written out per screen is how `unavailable` eventually renders as
 * an upsell on the screen nobody re-read (ADR 0026).
 */
export type { Availability } from '../goals/availability';

/**
 * One field a Destination type offers, from its `settingsSchema()`.
 *
 * **`type` picks the control**, as of #31. It was documentation until then —
 * declared here and read nowhere, while the screen hard-coded WSMS's one field
 * — which meant the second type to declare a field would have rendered none of
 * them. `Destinations.tsx` switches on it and falls back to a text input, so
 * a kind this bundle does not know is a degraded control rather than an
 * invisible one.
 *
 * The kinds in use: `ids` (a list, held as `string[]`), `url`, `text` and
 * `multiline` and `select`. It is a `string` rather than a union because the server is the
 * authority — a Pro type shipping a kind free has never heard of must render
 * as something, and a union here would make it a type error instead.
 *
 * **`options` is the answer to a different question from `type`.** `type` says
 * what SHAPE the value is; `options` says whether the server was able to
 * enumerate the legal values. An `ids` field with options is a set of
 * checkboxes and one without is a comma-separated text input — the same stored
 * `string[]` either way, which is what lets the round trip in `toDraft` and
 * `fromDraft` stay one code path.
 *
 * It is what makes the MailPoet [[Destination]] pick a list **by name** rather
 * than by a segment id read off a URL (#87), and it arrives empty on a site
 * whose provider cannot be reached — so the control degrades to the text input
 * rather than to nothing.
 */
export interface SettingsField {
  type: string;
  label: string;
  description?: string;
  options?: { value: string; label: string }[];
}

export interface DestinationRequirements {
  audience_channels?: readonly string[];
  capture_any_of: readonly string[];
  settings: Readonly<Record<string, { label: string; type: string }>>;
  fields: readonly string[];
  mapped_fields: Readonly<Record<string, { setting: string; label: string; scope: string }>>;
}

export interface DestinationUsage {
  id: string;
  name: string;
  draft: boolean;
  live: boolean;
}

/** A kind of [[Destination]] this install can reach — WSMS, MailPoet or lead-magnet email. */
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
  requirements?: DestinationRequirements;
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
  /**
   * **The merchant's own name for this route**, and the only thing that tells
   * two Destinations of one type apart.
   *
   * A Destination is configured once, site-wide, and *includes whatever
   * selects the target inside the remote system* (CONTEXT.md, Destination) —
   * so *"Newsletter signups"* and *"Product updates"* are two MailPoet
   * Destinations over one MailPoet, and this is what an [[Optin]] is bound
   * against on screen. It is renameable, and renaming breaks nothing: the
   * binding is by ULID.
   */
  label: string;
  connection: string | null;
  settings: Record<string, unknown>;
  /**
   * Where this route lands, in the merchant's words — **and three states, not
   * two.**
   *
   * `null` is *say nothing*: the type selects nothing at all (the lead-magnet
   * email, a webhook), or its schema could not be read because the provider
   * was having a bad time. `''` is *it selects something and nothing is
   * chosen*, which is the only one of the three that is a fault. A string is
   * where it lands.
   *
   * **Derived on the server and never posted back.** `ConfiguredTarget` is the
   * one spelling of the rule, and it resolves ids against THIS Destination's
   * own Connection — which the browser cannot do, because `settings_schema`
   * travels per TYPE and is built from the first Connection of that type.
   * {@see targetSaid} in `./settings` turns it into the sentence.
   */
  target: string | null;
  availability: Availability;
  health: DestinationHealth;
  requirements?: DestinationRequirements | null;
  usage?: readonly DestinationUsage[] | null;
  mapping_issues?: readonly string[];
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
  /** Suggested visible sample only. Sending always requires an explicit address. */
  test_sample?: { email: string | null; fields: readonly ['email'] };
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

/**
 * What a *Test* answered — **a sentence, and three outcomes rather than a
 * boolean.**
 *
 * `skipped` is the one that earns the third state: a Destination whose type
 * this install cannot run has not FAILED, and rendering that in red tells a
 * merchant with no WP SMS that their WP SMS Destination is broken when the
 * plugin is simply not installed. It is the `locked`/`unavailable`
 * distinction one layer up, and the same reason it is not one word (ADR 0026).
 *
 * The message is the provider's own words wherever the provider supplied any.
 * React escapes on the way to the DOM, which is why nothing escapes it on the
 * way here.
 */
export interface TestReport {
  outcome: 'success' | 'skipped' | 'failed';
  message: string;
}

/**
 * **Are these credentials good?** — the useful question on a [[Connection]]
 * the merchant has just pasted a key into.
 */
export const testConnection = (id: string) =>
  apiFetch<TestReport>({ path: path(`/${id}/test-connection`), method: 'POST' });

/**
 * **Does a push land?** — the useful question when the connection is fine and
 * the [[Lead]] is not arriving.
 *
 * It really sends: the lead-magnet email delivers, and a real subscriber
 * appears. It writes no Lead, queues nothing and moves no counter (ADR 0008,
 * ADR 0031).
 */
export const testSend = (id: string, email: string, interest?: string) =>
  apiFetch<TestReport>({ path: path(`/${id}/test-send`), method: 'POST', data: { email, ...(interest === undefined ? {} : { interest }) } });

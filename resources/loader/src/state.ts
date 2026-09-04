import type { OptinRecord, VisitorState } from './types';
import type { Store } from './storage';

/**
 * What this device remembers, and the four events that change it.
 *
 * The reducers are pure and the store is passed in, which is what lets
 * frequency capping across days be tested without a browser and without a
 * clock. `day` is whole days since the epoch — all `cooldownDays` can ask
 * about, and a good deal less identifying than a millisecond (ADR 0017).
 *
 * **This storage is `functional` and is never withheld.** It records a choice
 * the visitor made by clicking the close button, and withholding it means the
 * popup reappears after they closed it — worse for them on every axis
 * (CONTEXT.md, Storage Consent). So it is deliberately NOT behind the consent
 * gate in `consent.ts`; that gate is for rules whose storage falls in a
 * stricter category.
 */

export const STATE_KEY = 'wcv1';

/**
 * The site-wide allowance's slot, inside the one key.
 *
 * ============================================================================
 * A RESERVED ENTRY IN `wcv1`, AND EMPHATICALLY NOT A SECOND KEY.
 * ============================================================================
 * ADR 0047's diagram drew `wc_o_<optinId>` and `wc_site` as two `localStorage`
 * keys, and neither has ever existed — the notation spread from that diagram
 * into three other documents before anyone read it against this file. So the
 * site's four fields are one more entry in the map already here: one read, one
 * write, one rung on the `localStorage → cookie → in-memory` ladder, and no
 * second consent call.
 *
 * `site` is lower case and four characters, so **no ULID can take it**
 * (`Ulid::PATTERN` is 26 characters of Crockford base32, upper case) and it
 * cannot collide with an Optin id however many Optins a site has.
 */
export const SITE_SLOT = 'site';

/** Whole days since the epoch. */
export const dayOf = (now: number): number => Math.floor(now / 86_400_000);

/**
 * Read the state, or an empty one.
 *
 * A blob that will not parse is discarded rather than repaired. It is a few
 * bytes of frequency state; the cost of being wrong is one extra impression,
 * and the cost of trusting a half-parsed shape is a loader that throws on a
 * page it was supposed to leave alone.
 */
export function loadState(store: Store): VisitorState {
  const raw = store.read();

  if (raw === null) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as VisitorState)
      : {};
  } catch {
    return {};
  }
}

export function saveState(store: Store, state: VisitorState): void {
  store.write(JSON.stringify(state));
}

const touch = (state: VisitorState, id: string, change: OptinRecord): VisitorState => ({
  ...state,
  [id]: { ...state[id], ...change },
});

export function withImpression(state: VisitorState, id: string, day: number): VisitorState {
  return touch(state, id, { i: (state[id]?.i ?? 0) + 1, l: day });
}

export function withDismissal(state: VisitorState, id: string): VisitorState {
  return touch(state, id, { d: 1 });
}

export function withConversion(state: VisitorState, id: string): VisitorState {
  return touch(state, id, { c: 1 });
}

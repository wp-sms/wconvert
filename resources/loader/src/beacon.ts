import type { OptinControls } from './types';

/**
 * The analytics beacon: three acts, one endpoint, and nothing about the
 * visitor.
 *
 * **Stateless, by decision.** No visitor id, no device id, no hashed
 * fingerprint, no dedup key — WConvert mints none, and the beacon is the place
 * one would have been reintroduced (ADR 0017). What is lost is unique visitors;
 * what is kept is impressions, conversions, dismissals and therefore conversion
 * rate, which are all counts and need no identity.
 *
 * **The Impression sends immediately and the rest coalesce.** A bounce is the
 * common case, and a visitor who leaves before `pagehide` fires cleanly would
 * take their Impression with them — which makes conversion rate's denominator
 * too small and the rate too high. That is the one direction of error that
 * flatters us, so it is the one that is engineered against. The Conversion and
 * the Dismissal are safe to hold: neither happens without the visitor still
 * being there, and both are cheap to send with whatever else is waiting.
 */

/** What the endpoint accepts. `lead_magnet_delivered` is PHP's and never travels here. */
export type BeaconKind = 'impression' | 'conversion' | 'dismiss';

interface BeaconEvent {
  readonly optin_id: string;
  readonly kind: BeaconKind;
}

export interface Beacon {
  /** Report an act. Sends now for an Impression, queues otherwise. */
  report(optinId: string, kind: BeaconKind): void;
  /** Send whatever is waiting. Called on `pagehide`; safe to call with nothing queued. */
  flush(): void;
  /** Detach the listeners. */
  stop(): void;
}

/** A beacon that does nothing, for a page carrying nowhere to post. */
const SILENT: Beacon = {
  report: () => undefined,
  flush: () => undefined,
  stop: () => undefined,
};

export function createBeacon(endpoint: string | null): Beacon {
  if (endpoint === null) {
    return SILENT;
  }

  // Bound to a const so the narrowing survives into the closures below — a
  // parameter is a mutable binding and TypeScript will not carry a null check
  // across one.
  const url = endpoint;

  let queued: BeaconEvent[] = [];
  let stopped = false;

  /**
   * A page being PRERENDERED has not been seen by anybody.
   *
   * Nothing leaves while this is true — which is the server-side
   * `Sec-Purpose` filter's other half, done where it costs a request rather
   * than where it costs a round trip. But the events are HELD rather than
   * dropped: a prerender the visitor goes on to open is a page they looked at,
   * and an Impression by every definition the glossary offers. `prerendering`
   * flips to false on activation, and `prerenderingchange` is when it does.
   */
  const prerendering = (): boolean => (document as { prerendering?: boolean }).prerendering === true;

  function send(events: readonly BeaconEvent[]): void {
    if (events.length === 0) {
      return;
    }

    const body = JSON.stringify({ events });

    // `sendBeacon` is the only send that survives the page going away: the
    // browser owns the request from here, and it is neither cancelled by
    // unload nor blocked on by it. A Blob carries the content type, because
    // the two-argument string form posts `text/plain`.
    if (typeof navigator.sendBeacon === 'function') {
      // A queue the browser refuses — it is full, or the payload is over its
      // limit — is a false return rather than a throw, and there is no second
      // chance worth taking on a page that is closing.
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));

      return;
    }

    // The long tail. `keepalive` is what lets a fetch outlive the document;
    // without it this is a request the browser cancels on the way out, which
    // is still better than not trying.
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // A count that did not arrive is a count that did not arrive. It is not
      // a reason to throw on a page WConvert was asked to leave alone
      // (ADR 0004).
    });
  }

  function flush(): void {
    if (stopped || prerendering() || queued.length === 0) {
      return;
    }

    const events = queued;

    // Emptied BEFORE the send, so a `pagehide` that fires twice — bfcache
    // restores do that — cannot post the same events again.
    queued = [];
    send(events);
  }

  function report(optinId: string, kind: BeaconKind): void {
    if (stopped) {
      return;
    }

    queued.push({ optin_id: optinId, kind });

    if (kind === 'impression') {
      flush();
    }
  }

  // `pagehide` rather than `unload`: `unload` makes a page ineligible for the
  // bfcache in every browser that has one, so listening for it would slow down
  // every back-navigation on the site to collect a number.
  const onPageHide = (): void => flush();
  // And on activation, for the events held through a prerender.
  const onActivated = (): void => flush();

  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('prerenderingchange', onActivated, { once: true });

  return {
    report,
    flush,
    stop() {
      stopped = true;
      queued = [];
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('prerenderingchange', onActivated);
    },
  };
}

/**
 * The three acts a shown Optin reports, wired to one Optin's id.
 *
 * Beside the shell's own recording rather than instead of it: the device's
 * record and the site's counters answer different questions and neither is
 * derivable from the other. The record is per-device and functional — it is
 * why a dismissed popup stays dismissed — and the counters are per-site and
 * anonymous.
 */
export function reporting(beacon: Beacon, optinId: string, controls: OptinControls): OptinControls {
  return {
    impression() {
      controls.impression();
      beacon.report(optinId, 'impression');
    },
    dismiss() {
      controls.dismiss();
      beacon.report(optinId, 'dismiss');
    },
    convert() {
      controls.convert();
      beacon.report(optinId, 'conversion');
    },
  };
}

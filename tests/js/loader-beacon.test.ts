import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Beacon } from '@loader/beacon';
import { createBeacon, reporting } from '@loader/beacon';
import { BEACON_ATTRIBUTE, CAPTURE_ATTRIBUTE, PAYLOAD_ELEMENT_ID, beaconEndpoint } from '@loader/payload';
import type { OptinControls } from '@loader/types';

/**
 * The analytics beacon.
 *
 * **Stateless.** Every assertion about the wire here is also an assertion that
 * nothing about the visitor is on it: no id, no cookie value, no timestamp
 * (ADR 0017). {@link itCarriesNothingAboutTheVisitor} is the one that says so
 * directly.
 *
 * **The Impression sends immediately and the rest coalesce**, because a bounce
 * is the common case and an Impression lost to one makes conversion rate's
 * denominator too small — the one direction of error that flatters us.
 */

const ENDPOINT = 'https://example.test/wp-json/wconvert/v1/beacon';
const OPTIN = '01JQ0000000000000000000001';
const OTHER = '01JQ0000000000000000000002';

interface Sent {
  readonly url: string;
  readonly events: readonly { optin_id: string; kind: string }[];
}

/** One batch per `sendBeacon` call, still being read off its Blob. */
let batches: Promise<Sent>[] = [];

/**
 * The body, out of the Blob.
 *
 * `FileReader` rather than `Blob.text()`, because jsdom's Blob has `size`,
 * `type` and `slice` and nothing else. The real one has `text()`; this is a
 * property of the test environment, not of the code.
 */
function bodyOf(payload: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(payload);
  });
}

/** Every batch sent so far, in order. */
const sent = (): Promise<Sent[]> => Promise.all(batches);

beforeEach(() => {
  batches = [];

  // `sendBeacon` does not exist in jsdom at all, so this is a definition
  // rather than a spy over one.
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: (url: string, payload?: BodyInit | null): boolean => {
      batches.push(
        bodyOf(payload as Blob).then((text: string) => ({
          url,
          events: (JSON.parse(text) as { events: Sent['events'] }).events,
        })),
      );

      return true;
    },
  });
});

/**
 * A beacon that is torn down after the test.
 *
 * A real one lives as long as the page and holds a `pagehide` listener for
 * exactly that reason — so a test that left one attached would have its events
 * flushed by the NEXT test's `pagehide`, which is a false pass waiting to
 * happen and was a real failure before this helper existed.
 */
function beaconFor(endpoint: string | null): Beacon {
  const beacon = createBeacon(endpoint);

  live.push(beacon);

  return beacon;
}

let live: Beacon[] = [];

afterEach(() => {
  for (const beacon of live) {
    beacon.stop();
  }

  live = [];
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'prerendering');
});

/** A macrotask, for the fetch fallback's own promise chain. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const pagehide = (): void => void window.dispatchEvent(new Event('pagehide'));

describe('when each act is sent', () => {
  it('sends the Impression at once, because a bounce would take it away', async () => {
    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'impression');

    const batches = await sent();

    expect(batches).toHaveLength(1);
    expect(batches[0].events).toEqual([{ optin_id: OPTIN, kind: 'impression' }]);
  });

  it('holds the Conversion and the Dismissal until the page goes away', async () => {
    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'conversion');
    beacon.report(OTHER, 'dismiss');

    expect(await sent()).toHaveLength(0);

    pagehide();

    const batches = await sent();

    expect(batches).toHaveLength(1);
    expect(batches[0].events).toEqual([
      { optin_id: OPTIN, kind: 'conversion' },
      { optin_id: OTHER, kind: 'dismiss' },
    ]);
  });

  /**
   * The Impression flushes whatever is already waiting with it. One request
   * rather than two is the point of coalescing at all.
   */
  it('takes anything already queued along with an Impression', async () => {
    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'dismiss');
    beacon.report(OTHER, 'impression');

    const batches = await sent();

    expect(batches).toHaveLength(1);
    expect(batches[0].events).toHaveLength(2);
  });

  /**
   * A `pagehide` that fires twice — a bfcache restore does that — must not
   * post the same acts again. Each one would be a second increment on a
   * counter that can never be recomputed (ADR 0019).
   */
  it('does not send the same act twice when pagehide fires again', async () => {
    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'conversion');
    pagehide();
    pagehide();

    expect(await sent()).toHaveLength(1);
  });

  it('sends nothing when there is nothing to send', async () => {
    beaconFor(ENDPOINT);

    pagehide();

    expect(await sent()).toHaveLength(0);
  });
});

describe('what travels', () => {
  it('carries nothing about the visitor', async () => {
    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'impression');

    // The whole batch, as JSON: an Optin id that is already public, and one of
    // three words. There is nowhere in this shape for an identifier to be,
    // which is the point (ADR 0017).
    expect(JSON.stringify((await sent())[0].events)).toBe(`[{"optin_id":"${OPTIN}","kind":"impression"}]`);
  });

  it('posts to where the payload said, and nowhere else', async () => {
    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'impression');

    expect((await sent())[0].url).toBe(ENDPOINT);
  });
});

describe('a prerendered page', () => {
  /**
   * A page being prerendered has not been seen by anybody, so nothing leaves
   * while it is — which is the server-side `Sec-Purpose` filter's other half,
   * done where it costs a request rather than a round trip.
   */
  it('sends nothing while it is being prerendered', async () => {
    Object.defineProperty(document, 'prerendering', { configurable: true, value: true });

    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'impression');
    pagehide();

    expect(await sent()).toHaveLength(0);
  });

  /**
   * **But the acts are HELD, not dropped.** A prerender the visitor goes on to
   * open is a page they looked at, and an Impression by every definition the
   * glossary offers (CONTEXT.md, Impression). Dropping it would undercount the
   * denominator of conversion rate on every site running speculation rules.
   */
  it('flushes what it held when the visitor activates it', async () => {
    Object.defineProperty(document, 'prerendering', { configurable: true, value: true });

    const beacon = beaconFor(ENDPOINT);

    beacon.report(OPTIN, 'impression');

    expect(await sent()).toHaveLength(0);

    Object.defineProperty(document, 'prerendering', { configurable: true, value: false });
    document.dispatchEvent(new Event('prerenderingchange'));

    const batches = await sent();

    expect(batches).toHaveLength(1);
    expect(batches[0].events).toEqual([{ optin_id: OPTIN, kind: 'impression' }]);
  });
});

describe('when the browser has no sendBeacon', () => {
  /**
   * The long tail. `keepalive` is what lets a fetch outlive the document;
   * without it this is a request the browser cancels on the way out.
   */
  it('falls back to a keepalive fetch', async () => {
    Reflect.deleteProperty(navigator, 'sendBeacon');

    const fetched = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    vi.stubGlobal('fetch', fetched);

    beaconFor(ENDPOINT).report(OPTIN, 'impression');
    await settled();

    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fetched.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true });

    vi.unstubAllGlobals();
  });

  /**
   * A count that did not arrive is a count that did not arrive. It is not a
   * reason to throw on a page WConvert was asked to leave alone (ADR 0004).
   */
  it('swallows a failed send rather than throwing on somebody else\'s page', async () => {
    Reflect.deleteProperty(navigator, 'sendBeacon');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(() => beaconFor(ENDPOINT).report(OPTIN, 'impression')).not.toThrow();
    await settled();

    vi.unstubAllGlobals();
  });
});

describe('when sendBeacon refuses a batch', () => {
  it.each(['false', 'throw'])('tries fetch once after %s', async (kind) => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: kind === 'false' ? () => false : () => { throw new Error('blocked'); },
    });
    const fetched = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetched);
    beaconFor(ENDPOINT).report(OPTIN, 'impression');
    await settled();
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fetched.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true });
    vi.unstubAllGlobals();
  });
});

it('flushes queued actions when the page becomes hidden, without repeating on pagehide', async () => {
  const beacon = beaconFor(ENDPOINT);
  beacon.report(OPTIN, 'dismiss');
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  pagehide();
  const batchesSent = await sent();
  expect(batchesSent).toHaveLength(1);
  expect(batchesSent[0].events).toEqual([{ optin_id: OPTIN, kind: 'dismiss' }]);
});

describe('a page with nowhere to post', () => {
  /**
   * An optimizer that rewrote the payload tag, or a page carrying no payload
   * at all. Null is a real answer and the beacon treats it as one rather than
   * queuing forever or throwing.
   */
  it('reports nothing and throws nothing', async () => {
    const beacon = beaconFor(null);

    beacon.report(OPTIN, 'impression');
    beacon.report(OPTIN, 'conversion');
    pagehide();

    expect(await sent()).toHaveLength(0);
  });

  it('reads null off a page whose tag carries no beacon attribute', () => {
    document.body.innerHTML =
      `<script type="application/json" id="${PAYLOAD_ELEMENT_ID}" ${CAPTURE_ATTRIBUTE}="/capture">[]</script>`;

    expect(beaconEndpoint()).toBeNull();
  });

  it('reads the endpoint off the payload element where there is one', () => {
    document.body.innerHTML =
      `<script type="application/json" id="${PAYLOAD_ELEMENT_ID}" ${BEACON_ATTRIBUTE}="${ENDPOINT}">[]</script>`;

    expect(beaconEndpoint()).toBe(ENDPOINT);
  });
});

describe('the three acts a shown Optin reports', () => {
  function spyControls(): OptinControls & { calls: string[] } {
    const calls: string[] = [];

    return {
      calls,
      impression: () => void calls.push('impression'),
      dismiss: () => void calls.push('dismiss'),
      convert: () => void calls.push('convert'),
    };
  }

  /**
   * **Two records, one act.** The device's own record answers "should this
   * Optin show again here" and the site's counters answer "how is it doing";
   * neither is derivable from the other, and the first is `functional` storage
   * while the second is no storage on the device at all (ADR 0017).
   */
  it('records on the device AND counts on the site', async () => {
    const beacon = beaconFor(ENDPOINT);
    const inner = spyControls();
    const controls = reporting(beacon, OPTIN, inner);

    controls.impression();
    controls.convert();
    controls.dismiss();
    pagehide();

    expect(inner.calls).toEqual(['impression', 'convert', 'dismiss']);
    expect((await sent()).flatMap((batch) => batch.events.map((event) => event.kind))).toEqual([
      'impression',
      'conversion',
      'dismiss',
    ]);
  });

  /**
   * The device record happens FIRST. A beacon that threw — it cannot, but the
   * ordering is the guarantee — must not cost the visitor their dismissal.
   */
  it('writes the device record before it reports', () => {
    const order: string[] = [];
    const beacon = {
      report: () => void order.push('beacon'),
      flush: () => undefined,
      stop: () => undefined,
    };

    reporting(beacon, OPTIN, {
      impression: () => void order.push('record'),
      dismiss: () => undefined,
      convert: () => undefined,
    }).impression();

    expect(order).toEqual(['record', 'beacon']);
  });
});

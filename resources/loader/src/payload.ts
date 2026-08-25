import type { PayloadEntry } from './types';

/**
 * Reading the inlined payload.
 *
 * It travels as `<script type="application/json">` because every JS optimizer
 * tested — Autoptimize, LiteSpeed, Flying Scripts — selects on `script[!type]`
 * or `type="text/javascript"`, so this tag is invisible to all of them and
 * stays where PHP printed it; HTML minifiers left it parseable (ADR 0004).
 *
 * **This never assumes document position.** Autoptimize's aggregate + force-in-
 * head moves the loader ABOVE the payload and strips its `defer`, so the
 * element may genuinely not be in the DOM yet when this is first called. That
 * is the retry in `boot.ts`, and it is why this returns null rather than
 * throwing.
 */

export const PAYLOAD_ELEMENT_ID = 'wconvert-payload';

/**
 * Where the capture endpoint is on this site.
 *
 * The reasoning for it being an attribute rather than a JSON field is written
 * once, on `PayloadTag::CAPTURE_ATTRIBUTE`, which is the side that prints it.
 * What matters here: the loader cannot compute this. It is a raw IIFE with no
 * `wp-api-fetch` and no `wpApiSettings`, deliberately (ADR 0004), so the full
 * route arrives from PHP and a route name is never spelled in TypeScript.
 */
export const CAPTURE_ATTRIBUTE = 'data-capture';

/**
 * Where the analytics beacon is on this site.
 *
 * A second attribute for the same reasons as the first, and passed as a FULL
 * route rather than as a namespace root: half a URL in an attribute plus half
 * in TypeScript is "a route name is spelled in PHP and nowhere else" broken
 * while looking like it is kept.
 */
export const BEACON_ATTRIBUTE = 'data-beacon';

/**
 * Where to post a capture, or null where this page carries nowhere.
 *
 * Read on demand rather than threaded through `boot`, because it is needed at
 * the moment an Optin is SHOWN and the element it lives on is the one the
 * payload was already read from. Null is a real answer: an optimizer that
 * rewrote the tag, or a page that has no payload at all.
 */
export function captureEndpoint(): string | null {
  return endpointAt(CAPTURE_ATTRIBUTE);
}

/**
 * Where to post a beacon, or null where this page carries nowhere.
 *
 * Null is a real answer and the beacon treats it as one: it becomes a beacon
 * that reports nothing rather than a throw or a queue that grows forever. An
 * optimizer that rewrote the tag must not take the page down with it
 * (ADR 0004).
 */
export function beaconEndpoint(): string | null {
  return endpointAt(BEACON_ATTRIBUTE);
}

function endpointAt(attribute: string): string | null {
  const endpoint = document.getElementById(PAYLOAD_ELEMENT_ID)?.getAttribute(attribute) ?? '';

  return endpoint === '' ? null : endpoint;
}

export function readPayload(): readonly PayloadEntry[] | null {
  const element = document.getElementById(PAYLOAD_ELEMENT_ID);

  if (element === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(element.textContent ?? '');

    // An entry with no id cannot be capped, beaconed against or shown twice
    // safely, so it is dropped rather than carried — the same rule the server
    // applies to a corrupted projection.
    return Array.isArray(parsed)
      ? (parsed.filter(
          (entry: unknown) =>
            typeof entry === 'object' && entry !== null && typeof (entry as PayloadEntry).id === 'string',
        ) as PayloadEntry[])
      : [];
  } catch {
    // A payload that will not parse is a payload this page cannot act on. It
    // is not a reason to throw on a page WConvert was supposed to leave alone.
    return [];
  }
}

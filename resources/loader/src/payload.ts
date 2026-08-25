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

import type { Frequency, PayloadEntry } from './types';

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
 * The allowance the whole site shares, as the same four fields an entry
 * carries.
 *
 * An attribute rather than a member of the JSON for the reason
 * {@link CAPTURE_ATTRIBUTE} gives: this is **one fact about the site** and the
 * JSON is a list of facts about Optins, so putting it inside would mean either
 * repeating it per entry or turning the list into an object with a list in it.
 *
 * It is absent on every site that has configured nothing, which is every site
 * until a merchant asks — all four fields default OFF at this scope
 * (ADR 0047) — so the common case costs the page zero bytes.
 */
export const SITE_ALLOWANCE_ATTRIBUTE = 'data-allowance';

/**
 * The site's own timezone — an IANA name, or a fixed offset.
 *
 * A third attribute for {@link CAPTURE_ATTRIBUTE}'s reason: it is **one fact
 * about the site**, and the JSON beside it is a list of facts about Optins.
 *
 * The loader cannot compute it, and must not guess: the visitor's clock is not
 * the site's clock, and a rule about opening hours answered against the
 * visitor's zone is the one wrong answer that would look right. It is printed
 * unconditionally rather than only where a rule needs it, because PHP
 * deliberately reasons about no client rule type at all (ADR 0005) — and
 * because it is about twenty bytes beside two full route URLs.
 */
export const TIMEZONE_ATTRIBUTE = 'data-tz';

/**
 * Where to post a capture, or null where this page carries nowhere.
 *
 * Read on demand rather than threaded through `boot`, because it is needed at
 * the moment an Optin is SHOWN and the element it lives on is the one the
 * payload was already read from. Null is a real answer: an optimizer that
 * rewrote the tag, or a page that has no payload at all.
 */
export function captureEndpoint(): string | null {
  return attributeAt(CAPTURE_ATTRIBUTE);
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
  return attributeAt(BEACON_ATTRIBUTE);
}

/**
 * The site's own allowance, or **undefined where this page carries none**.
 *
 * Undefined is the shipped default and not an error: the attribute is printed
 * only where the merchant has configured something to spend, so its absence is
 * a site that has asked for nothing rather than a page that lost it.
 *
 * A blob that will not parse is undefined too, which fails OPEN — the same
 * direction {@link readPayload} fails in, and the same one the storage ladder
 * takes. A visitor meeting one extra popup because an optimiser rewrote an
 * attribute is annoying; a visitor meeting nothing at all is broken.
 */
export function siteAllowance(): Frequency | undefined {
  const raw = document.getElementById(PAYLOAD_ELEMENT_ID)?.getAttribute(SITE_ALLOWANCE_ATTRIBUTE) ?? '';

  if (raw === '') {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Frequency)
      : undefined;
  } catch {
    return undefined;
  }
}


/**
 * The site's timezone, or **null where this page carries none**.
 *
 * Null is a real answer — an optimiser that rewrote the tag, or a page with no
 * payload at all — and `time_of_day` treats it as one: a rule that cannot be
 * answered does not hold, which is the same fail-shut rule `decide.ts` gives a
 * rule that throws. Showing nothing is the safe direction here; showing at the
 * wrong hour is not.
 */
export function siteTimezone(): string | null {
  return attributeAt(TIMEZONE_ATTRIBUTE);
}

/**
 * One attribute off the payload element, or null where it is empty or absent.
 *
 * It was `endpointAt` while both of its callers wanted a URL. A timezone is
 * not an endpoint, and a name that describes two of three callers is a name
 * the next reader has to correct for.
 */
function attributeAt(attribute: string): string | null {
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

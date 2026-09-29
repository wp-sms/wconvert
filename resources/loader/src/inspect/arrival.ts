import { PAYLOAD_ELEMENT_ID } from '../payload';

/**
 * Did the loader and its payload actually reach this page, and in what order?
 *
 * ============================================================================
 * ADR 0004's THREE FAILURE MODES, NAMED ON SCREEN INSTEAD OF DEBUGGED.
 * ============================================================================
 * Autoptimize's *Aggregate JS-files* + *Force JavaScript in `<head>`* — two
 * checkboxes on its main screen — move the loader ABOVE the payload it reads
 * and strip its `defer`. `boot.ts` survives that by retrying after
 * `DOMContentLoaded`, and the whole point of ADR 0004 is that the failure it
 * would otherwise cause is **silent, total, and leaves nothing in any log**.
 *
 * A merchant with a JS optimiser in front of this has no way to find out. This
 * is what tells them, on the page, in words — and it is the one part of the
 * inspector that reports on the loader's DELIVERY rather than on its decision.
 *
 * It reads the DOM and nothing else: no timing, no network, no guesses about
 * which plugin did it. Naming a specific optimiser would be a guess, and the
 * observation is the same whichever one it was.
 */

export interface Arrival {
  /** The payload tag is in the DOM. Absent is NORMAL where no Optin matched. */
  readonly payloadFound: boolean;
  /** How many Optins the server put on this page. */
  readonly entries: number;
  /**
   * A `<script>` whose `src` is still our own loader.
   *
   * False does not mean the loader is missing: an aggregator concatenates it
   * into a bundle of its own and the tag is gone while the code runs. That is
   * exactly the state worth reporting, because it is also the state in which
   * `defer` and document order stop being ours.
   */
  readonly loaderFound: boolean;
  /**
   * The loader tag sits BEFORE the payload it reads.
   *
   * The force-in-head symptom. Harmless on its own — `boot.ts` retries — and
   * worth naming, because it is the thing a merchant would otherwise be
   * looking for.
   */
  readonly loaderBeforePayload: boolean;
  /** The loader still carries `defer`, as PHP enqueued it. */
  readonly deferred: boolean;
  readonly loaderStatus: 'unobserved' | 'entered' | 'completed';
}

/** How we recognise our own script among everything else on the page. */
const LOADER_SRC = '/loader/loader.js';

export function readArrival(): Arrival {
  const payload = document.getElementById(PAYLOAD_ELEMENT_ID);
  const loader = [...document.querySelectorAll('script[src]')].find((script) =>
    (script.getAttribute('src') ?? '').includes(LOADER_SRC),
  ) as HTMLScriptElement | undefined;

  return {
    payloadFound: payload !== null,
    entries: countIn(payload),
    loaderFound: loader !== undefined,
    // `Node.DOCUMENT_POSITION_FOLLOWING` is 4: the payload FOLLOWS the loader,
    // which is the force-in-head arrangement.
    loaderBeforePayload:
      loader !== undefined &&
      payload !== null &&
      (loader.compareDocumentPosition(payload) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    deferred: loader?.defer === true,
    loaderStatus: document.documentElement.dataset.wconvertLoader === 'completed' ? 'completed'
      : document.documentElement.dataset.wconvertLoader === 'entered' ? 'entered' : 'unobserved',
  };
}

/**
 * How many entries the payload carries.
 *
 * Parsed rather than taken from the entries the inspector is already handed,
 * because this file's job is to report what is ON THE PAGE — an optimiser that
 * mangled the JSON produces a payload that is present and unreadable, and
 * saying "0 Optins" about it is the honest answer.
 */
function countIn(payload: HTMLElement | null): number {
  if (payload === null) {
    return 0;
  }

  try {
    const parsed: unknown = JSON.parse(payload.textContent ?? '');

    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

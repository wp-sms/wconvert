import type { Loader, PayloadEntry, Presenter } from './types';
import { readPayload } from './payload';
import { start } from './shell';

/**
 * Starting, possibly late.
 *
 * **This is the most important ten lines in the loader** and they are invisible
 * until someone installs a cache plugin. Autoptimize's *Aggregate JS-files* +
 * *Force JavaScript in `<head>`* — two checkboxes on its main screen, and
 * force-in-head is exactly what people tick when a theme misbehaves — moves the
 * loader ABOVE the payload it reads and STRIPS its `defer`. A loader that reads
 * the DOM at execution time then finds nothing and dies: every popup on the
 * site, silently, on every page, with nothing in any log (ADR 0004).
 *
 * So: try; if the payload element is not in the DOM, wait for
 * `DOMContentLoaded` and try again; if it is genuinely absent, **do nothing and
 * throw nothing**. Never assume document position.
 *
 * The last clause is not politeness. A payload is absent on every page where no
 * published Optin matched — which on most sites is most pages — so throwing
 * there would put an error in the console of a page WConvert was asked to leave
 * alone.
 */
/**
 * A last chance to decide which of this page's entries are in play, applied
 * once between reading the payload and starting the shell.
 *
 * =============================================================================
 * IT IS A COMPOSITION PARAMETER, EXACTLY AS {@link Presenter} IS.
 * =============================================================================
 * ADR 0014 refuses a registration seam — a second script that must register
 * before the first evaluates is the silent failure ADR 0004 catalogues — and
 * this is not one. It is decided in SOURCE, in the entry file, on the same call
 * that already hands `boot` a presenter it does not choose: one script, one
 * bundle, nothing on the page to reorder.
 *
 * Free passes nothing and pays nothing. Pro's [[Variant]] arms are what asked
 * for it: two published arms of one test arrive as two entries, and choosing
 * between them is a decision to make BEFORE the engine is asked anything —
 * `decide()` answers about a list, and teaching it that two of its entries are
 * one choice would put experiment code in free's engine (ADR 0029).
 */
export type PayloadNarrowing = (
  entries: readonly PayloadEntry[],
) => readonly PayloadEntry[];

export function boot(loader: Loader, presenter: Presenter, narrow?: PayloadNarrowing): void {
  document.documentElement.dataset.wconvertLoader = 'entered';
  document.dispatchEvent(new Event('wconvert-loader-status'));
  if (payloadWasInTheDom(loader, presenter, narrow)) {
    return;
  }

  // Only worth waiting if the document is still being parsed. Past that, an
  // absent element is absent, not late.
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => void payloadWasInTheDom(loader, presenter, narrow),
      { once: true },
    );
  }
}

/**
 * Read the payload and, if there is one, start.
 *
 * Named for what it ANSWERS rather than for what it does, because the answer is
 * the only thing the caller acts on — and "did it work" would be the wrong
 * question: a payload with nothing in it is found, handled and shows nothing.
 */
function payloadWasInTheDom(
  loader: Loader,
  presenter: Presenter,
  narrow?: PayloadNarrowing,
): boolean {
  const read = readPayload();

  if (read === null) {
    return false;
  }

  const entries = narrow === undefined ? read : narrow(read);

  if (entries.length > 0) {
    start({ loader, entries, presenter });
  }

  document.documentElement.dataset.wconvertLoader = 'completed';
  document.dispatchEvent(new Event('wconvert-loader-status'));

  return true;
}

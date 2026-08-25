import type { Loader, Presenter } from './types';
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
export function boot(loader: Loader, presenter: Presenter): void {
  if (payloadWasInTheDom(loader, presenter)) {
    return;
  }

  // Only worth waiting if the document is still being parsed. Past that, an
  // absent element is absent, not late.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void payloadWasInTheDom(loader, presenter), {
      once: true,
    });
  }
}

/**
 * Read the payload and, if there is one, start.
 *
 * Named for what it ANSWERS rather than for what it does, because the answer is
 * the only thing the caller acts on — and "did it work" would be the wrong
 * question: a payload with nothing in it is found, handled and shows nothing.
 */
function payloadWasInTheDom(loader: Loader, presenter: Presenter): boolean {
  const entries = readPayload();

  if (entries === null) {
    return false;
  }

  if (entries.length > 0) {
    start({ loader, entries, presenter });
  }

  return true;
}

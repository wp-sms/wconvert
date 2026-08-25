import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '@loader/boot';
import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import { PAYLOAD_ELEMENT_ID } from '@loader/payload';
import type { PayloadEntry, Presenter } from '@loader/types';

/**
 * The late-start path — the most important ten lines in the loader, and the
 * ones that are invisible until someone installs a cache plugin.
 *
 * Autoptimize's *Aggregate JS-files* + *Force JavaScript in `<head>`* moves the
 * loader ABOVE the payload it reads and strips its `defer`. Under the naive
 * shape that kills every popup on the site, silently, on every page, with
 * nothing in any log (ADR 0004).
 */

const loader = createLoader(FREE_MODULES);

function recordingPresenter(): Presenter & { shown: string[] } {
  const shown: string[] = [];

  return { shown, show: (entry) => void shown.push(entry.id) };
}

function inlinePayload(entries: readonly PayloadEntry[], text?: string): void {
  const element = document.createElement('script');
  element.type = 'application/json';
  element.id = PAYLOAD_ELEMENT_ID;
  element.textContent = text ?? JSON.stringify(entries);
  document.body.appendChild(element);
}

const showsAtOnce = (id: string): PayloadEntry => ({
  id,
  display_type: 'popup',
  triggers: [{ type: 'page_load' }],
  conditions: [],
});

function pretendDocumentIsStillParsing(): void {
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('boot', () => {
  it('starts when the payload is already in the DOM', () => {
    const presenter = recordingPresenter();
    inlinePayload([showsAtOnce('a')]);

    boot(loader, presenter);

    expect(presenter.shown).toEqual(['a']);
  });

  /**
   * THE HAZARD. The loader ran above its own payload, with `defer` stripped.
   * Nothing is in the DOM yet, and nothing may throw — the retry is what has to
   * catch it.
   */
  it('starts after DOMContentLoaded when the payload was not there yet', () => {
    const presenter = recordingPresenter();
    pretendDocumentIsStillParsing();

    boot(loader, presenter);

    expect(presenter.shown).toEqual([]);

    // The parser reaches the payload tag, then finishes.
    inlinePayload([showsAtOnce('a')]);
    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(presenter.shown).toEqual(['a']);
  });

  /**
   * A payload is absent on every page where no published Optin matched — which
   * on most sites is most pages. Throwing there would put an error in the
   * console of a page WConvert was asked to leave alone.
   */
  it('does nothing and throws nothing when the payload is genuinely absent', () => {
    const presenter = recordingPresenter();

    expect(() => boot(loader, presenter)).not.toThrow();
    expect(presenter.shown).toEqual([]);
  });

  it('throws nothing when the payload is still absent after DOMContentLoaded', () => {
    const presenter = recordingPresenter();
    pretendDocumentIsStillParsing();

    boot(loader, presenter);

    expect(() => document.dispatchEvent(new Event('DOMContentLoaded'))).not.toThrow();
    expect(presenter.shown).toEqual([]);
  });

  it('throws nothing on a payload it cannot parse', () => {
    const presenter = recordingPresenter();
    inlinePayload([], '{ this is not json');

    expect(() => boot(loader, presenter)).not.toThrow();
    expect(presenter.shown).toEqual([]);
  });

  /**
   * Past `loading` the document is parsed, so an absent element is absent
   * rather than late. Waiting for an event that has already fired would leave
   * the listener attached for the life of the page on every page with no
   * Optins on it.
   */
  it('does not wait for DOMContentLoaded once the document has finished parsing', () => {
    const listen = vi.spyOn(document, 'addEventListener');

    boot(loader, recordingPresenter());

    expect(listen).not.toHaveBeenCalledWith('DOMContentLoaded', expect.anything(), expect.anything());
  });
});

/**
 * ADR 0004's third rule. Delay-JS plugins execute the loader seconds after
 * navigation; a loader that clocks from its own execution silently DOUBLES
 * every time-based rule. Measured under Flying Scripts' 5s fallback: from
 * navigation start the 5-second rule fired at 5,142 ms, from script start it
 * did not fire inside a 9-second window.
 */
describe('time on page, when the loader executes seconds late', () => {
  it('fires a five-second rule immediately for a loader that started at seven', () => {
    // `performance.now()` measures from NAVIGATION START regardless of when
    // this script ran, so seven seconds have already passed on arrival.
    vi.spyOn(performance, 'now').mockReturnValue(7_000);

    const presenter = recordingPresenter();
    inlinePayload([
      { id: 'a', display_type: 'popup', triggers: [{ type: 'time_on_page', seconds: 5 }], conditions: [] },
    ]);

    boot(loader, presenter);

    expect(presenter.shown).toEqual(['a']);
  });

  it('does not fire a rule whose seconds have not passed since navigation start', () => {
    vi.spyOn(performance, 'now').mockReturnValue(4_000);

    const presenter = recordingPresenter();
    inlinePayload([
      { id: 'a', display_type: 'popup', triggers: [{ type: 'time_on_page', seconds: 5 }], conditions: [] },
    ]);

    boot(loader, presenter);

    expect(presenter.shown).toEqual([]);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRO_MODULES } from '../../resources/loader/src/modules';
import type { LoaderModule } from '@loader/types';

/**
 * What Pro's two modules actually answer.
 *
 * The manifest-parity file next door proves each one is declared where its
 * `tier` says; this proves each one DOES what its declaration promises — the
 * same division `tests/js/loader-modules.test.ts` draws for free's four.
 *
 * Both decisions worth asserting here are ones prose alone would leave
 * unchecked: a blank `click_element` selector never fires, and a
 * `query_param` with no wanted value means "present with any value".
 */

const moduleFor = (id: string): LoaderModule => {
  const found = PRO_MODULES.find((module) => module.id === id);

  if (found === undefined) {
    throw new Error(`Pro ships no ${id} module`);
  }

  return found;
};

afterEach(() => {
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
});

describe('click_element', () => {
  const clickOn = (html: string, selector: string): { fired: boolean; stop: () => void } => {
    document.body.innerHTML = html;

    const evaluator = moduleFor('click_element').create(vi.fn());

    document.querySelector('#target')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    return { fired: evaluator.holds({ type: 'click_element', selector }), stop: () => evaluator.stop?.() };
  };

  it('fires once the visitor clicks something the selector matches', () => {
    expect(clickOn('<button id="target" class="buy">Buy</button>', '.buy').fired).toBe(true);
  });

  /**
   * A click on a child of the named element counts, which is what `closest`
   * buys: a merchant naming `.buy` means the button, and a visitor clicking
   * the word inside it has clicked the button.
   */
  it('fires when the click lands inside what the selector matches', () => {
    expect(clickOn('<button class="buy"><span id="target">Buy</span></button>', '.buy').fired).toBe(true);
  });

  it('does not fire on a click somewhere else', () => {
    expect(clickOn('<a id="target" href="#x">Elsewhere</a><button class="buy">Buy</button>', '.buy').fired).toBe(false);
  });

  /**
   * **The selector is author-only, and a blank one never fires** (ADR 0012).
   * The alternatives are "fires on any click", which is a popup on the first
   * click anywhere, and refusing to save, which would refuse the very state
   * prefill hands the merchant to complete.
   */
  it('never fires while the selector is blank', () => {
    document.body.innerHTML = '<button id="target">Buy</button>';

    const evaluator = moduleFor('click_element').create(vi.fn());

    document.querySelector('#target')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(evaluator.holds({ type: 'click_element' })).toBe(false);
    expect(evaluator.holds({ type: 'click_element', selector: '   ' })).toBe(false);
  });

  /**
   * A selector a merchant typed, which `closest` throws on rather than
   * returning null for. False, not a crash that takes every other Optin on
   * the page down with it.
   */
  it('answers false for a selector that is not one, rather than throwing', () => {
    expect(clickOn('<button id="target" class="buy">Buy</button>', '((').fired).toBe(false);
  });

  /**
   * Capture phase, so a theme handler that stops propagation on the
   * merchant's own button cannot make the Trigger it was chosen for
   * unfireable.
   */
  it('fires even where the page stops the click propagating', () => {
    document.body.innerHTML = '<button id="target" class="buy">Buy</button>';

    const button = document.querySelector('#target') as HTMLElement;

    button.addEventListener('click', (event) => event.stopPropagation());

    const evaluator = moduleFor('click_element').create(vi.fn());

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(evaluator.holds({ type: 'click_element', selector: '.buy' })).toBe(true);
  });

  it('asks the shell to decide again when something is clicked, and detaches when told to', () => {
    document.body.innerHTML = '<button id="target" class="buy">Buy</button>';

    const changed = vi.fn();
    const evaluator = moduleFor('click_element').create(changed);
    const button = document.querySelector('#target') as HTMLElement;

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(changed).toHaveBeenCalledTimes(1);

    evaluator.stop?.();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('query_param', () => {
  const holds = (search: string, rule: Record<string, unknown>): boolean => {
    window.history.replaceState({}, '', `/${search}`);

    return moduleFor('query_param').create(vi.fn()).holds({ type: 'query_param', ...rule });
  };

  it('holds where the parameter carries one of the wanted values', () => {
    expect(holds('?utm_source=google', { key: 'utm_source', value: ['google', 'bing'] })).toBe(true);
  });

  /**
   * **Set-valued, on ONE rule.** "From Google or Bing" is two values on one
   * rule and never two rules under an `or` — ADR 0005 names this exact case
   * and records the nesting ceiling as permanent.
   */
  it('does not hold where it carries a value that is not wanted', () => {
    expect(holds('?utm_source=facebook', { key: 'utm_source', value: ['google', 'bing'] })).toBe(false);
  });

  /**
   * An empty or absent `value` means **present with any value** — "they
   * arrived from some campaign" is a question worth asking, and the
   * alternative reading, "matches the empty string", is a rule nobody would
   * write on purpose.
   */
  it('holds on presence alone where no value is wanted', () => {
    expect(holds('?utm_source=anything', { key: 'utm_source' })).toBe(true);
    expect(holds('?utm_source=anything', { key: 'utm_source', value: [] })).toBe(true);
    expect(holds('?utm_source=', { key: 'utm_source' })).toBe(true);
  });

  it('does not hold where the parameter is absent', () => {
    expect(holds('?utm_medium=cpc', { key: 'utm_source', value: ['google'] })).toBe(false);
    expect(holds('', { key: 'utm_source' })).toBe(false);
  });

  /** A rule naming no parameter asks nothing, so it answers no. */
  it('does not hold where the rule names no parameter', () => {
    expect(holds('?utm_source=google', {})).toBe(false);
    expect(holds('?utm_source=google', { key: '  ' })).toBe(false);
  });

  /** A Condition reads live, so a history navigation is answered as it is now. */
  it('reads the query string at the moment it is asked', () => {
    const evaluator = moduleFor('query_param').create(vi.fn());

    window.history.replaceState({}, '', '/?utm_source=google');
    expect(evaluator.holds({ type: 'query_param', key: 'utm_source' })).toBe(true);

    window.history.replaceState({}, '', '/');
    expect(evaluator.holds({ type: 'query_param', key: 'utm_source' })).toBe(false);
  });
});

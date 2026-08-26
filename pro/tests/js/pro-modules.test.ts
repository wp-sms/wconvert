import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRO_MODULES } from '../../resources/loader/src/modules';
import type { LoaderModule } from '@loader/types';

/**
 * What Pro's modules actually answer.
 *
 * The manifest-parity file next door proves each one is declared where its
 * `tier` says; this proves each one DOES what its declaration promises — the
 * same division `tests/js/loader-modules.test.ts` draws for free's four.
 *
 * The decisions worth asserting here are ones prose alone would leave
 * unchecked: a blank `click_element` selector never fires, a `query_param`
 * with no wanted value means "present with any value", and **`exit_intent`
 * and `scroll_up` are two types rather than one with two meanings** — the
 * specific mistake this pair exists not to make.
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
  vi.restoreAllMocks();
});

/** The pointer leaving through the top of the viewport, to nothing. */
const leaveThroughTheTop = (): void =>
  void document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: null }));

/** Where the visitor is on the page, before any listener is attached. */
const scrolledTo = (y: number): void => void vi.spyOn(window, 'scrollY', 'get').mockReturnValue(y);

/** A scroll to `y`, as the browser reports one. */
const scrollTo = (y: number): void => {
  scrolledTo(y);
  window.dispatchEvent(new Event('scroll'));
};

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

describe('exit_intent', () => {
  /**
   * The gesture is the pointer leaving through the TOP of the viewport — the
   * direction the tab strip, the address bar and the close button are in.
   * Leaving through a side or the bottom is reaching for a scrollbar or the
   * dock.
   */
  it('fires once the pointer leaves through the top of the viewport', () => {
    const evaluator = moduleFor('exit_intent').create(vi.fn());

    expect(evaluator.holds({ type: 'exit_intent' })).toBe(false);

    leaveThroughTheTop();

    expect(evaluator.holds({ type: 'exit_intent' })).toBe(true);
    evaluator.stop?.();
  });

  /**
   * `mouseout` fires on every move between two elements on the page, which is
   * most of what a mouse does. A move that has somewhere to go is not a
   * departure, and reading it as one would fire on the first hover.
   */
  it('does not fire on a move from one element to another', () => {
    const evaluator = moduleFor('exit_intent').create(vi.fn());

    document.body.innerHTML = '<a id="link" href="#x">Elsewhere</a>';
    document.dispatchEvent(
      new MouseEvent('mouseout', { clientY: 0, relatedTarget: document.querySelector('#link') }),
    );

    expect(evaluator.holds({ type: 'exit_intent' })).toBe(false);
    evaluator.stop?.();
  });

  it('does not fire on the pointer leaving through a side or the bottom', () => {
    const evaluator = moduleFor('exit_intent').create(vi.fn());

    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 400, relatedTarget: null }));

    expect(evaluator.holds({ type: 'exit_intent' })).toBe(false);
    evaluator.stop?.();
  });

  /**
   * The same high-water posture `scroll_depth` takes, for the same reason:
   * coming back does not un-intend leaving, and a Trigger that un-fired would
   * be answerable differently depending on where the mouse happened to be at
   * the instant a Condition became true.
   */
  it('stays fired once it has fired', () => {
    const evaluator = moduleFor('exit_intent').create(vi.fn());

    leaveThroughTheTop();
    document.dispatchEvent(new MouseEvent('mouseover', {}));

    expect(evaluator.holds({ type: 'exit_intent' })).toBe(true);
    evaluator.stop?.();
  });

  /**
   * Once, on the transition. `scroll_depth` asks on every scroll because each
   * rule carries its own threshold; this one is a boolean with no params, so
   * a second ask has nothing new to answer.
   */
  it('asks the shell to decide again on the gesture, and detaches when told to', () => {
    const changed = vi.fn();
    const evaluator = moduleFor('exit_intent').create(changed);

    leaveThroughTheTop();
    leaveThroughTheTop();
    expect(changed).toHaveBeenCalledTimes(1);

    evaluator.stop?.();
    leaveThroughTheTop();
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('scroll_up', () => {
  it('does not fire while the visitor is still going down', () => {
    scrolledTo(0);
    const evaluator = moduleFor('scroll_up').create(vi.fn());

    scrollTo(600);
    scrollTo(1_200);

    expect(evaluator.holds({ type: 'scroll_up' })).toBe(false);
    evaluator.stop?.();
  });

  it('fires once they turn back and rise far enough from the deepest point', () => {
    scrolledTo(0);
    const evaluator = moduleFor('scroll_up').create(vi.fn());

    scrollTo(1_200);
    scrollTo(900);

    expect(evaluator.holds({ type: 'scroll_up' })).toBe(true);
    evaluator.stop?.();
  });

  /**
   * A few pixels back up is reading, not leaving. Without a rise threshold
   * this fires on the first overshoot of a tap-scroll, which on a phone is
   * every scroll.
   */
  it('does not fire on a small correction', () => {
    scrolledTo(0);
    const evaluator = moduleFor('scroll_up').create(vi.fn());

    scrollTo(1_200);
    scrollTo(1_150);

    expect(evaluator.holds({ type: 'scroll_up' })).toBe(false);
    evaluator.stop?.();
  });

  /**
   * Near the top there is nothing to come back FROM. A visitor who has barely
   * entered the page and nudges up is arriving, and firing there makes this a
   * page-load Trigger wearing a gesture's name.
   */
  it('does not fire for a visitor who never went deep', () => {
    scrolledTo(0);
    const evaluator = moduleFor('scroll_up').create(vi.fn());

    scrollTo(250);
    scrollTo(0);

    expect(evaluator.holds({ type: 'scroll_up' })).toBe(false);
    evaluator.stop?.();
  });

  /**
   * Read at instantiation, before any listener is attached — the same finding
   * `scroll_depth` is built on. Under delayed JS the visitor is already deep
   * when the loader runs, and the scrolls we missed are never replayed, so a
   * module starting from 0 would read their first rise as a descent.
   */
  it('starts from where the visitor already is, not from the top', () => {
    scrolledTo(1_500);
    const evaluator = moduleFor('scroll_up').create(vi.fn());

    scrollTo(1_200);

    expect(evaluator.holds({ type: 'scroll_up' })).toBe(true);
    evaluator.stop?.();
  });

  it('stays fired once it has fired', () => {
    scrolledTo(0);
    const evaluator = moduleFor('scroll_up').create(vi.fn());

    scrollTo(1_200);
    scrollTo(900);
    scrollTo(1_600);

    expect(evaluator.holds({ type: 'scroll_up' })).toBe(true);
    evaluator.stop?.();
  });

  it('asks the shell to decide again on the gesture, and detaches when told to', () => {
    scrolledTo(0);
    const changed = vi.fn();
    const evaluator = moduleFor('scroll_up').create(changed);

    scrollTo(1_200);
    scrollTo(900);
    scrollTo(600);
    expect(changed).toHaveBeenCalledTimes(1);

    evaluator.stop?.();
    scrollTo(1_600);
    scrollTo(1_000);
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

/**
 * ============================================================================
 * TWO TYPES, NOT ONE TYPE WITH TWO MEANINGS.
 * ============================================================================
 * `scroll_up` is `exit_intent`'s **distinct mobile sibling** (#32), and the
 * specific mistake this pair exists not to make is a single `exit_intent`
 * type that quietly means `mouseout` on a desktop and an upward scroll on a
 * phone. That type would be unreportable — "why didn't my popup show" has no
 * per-rule answer when one row means two things — and unpairable, because a
 * merchant could never ask for one without the other.
 *
 * So they evaluate independently, and both may sit on one Optin: the gesture
 * a visitor's device can actually make is the one that fires, and the other
 * simply never does. Neither is device-guarded, deliberately — a merchant who
 * wants one confined to a phone pairs it with the `device` Condition, which is
 * what the second client axis is for (ADR 0005).
 */
describe('exit_intent and scroll_up on one Optin', () => {
  it('evaluate independently, and each answers only for its own gesture', () => {
    scrolledTo(0);
    const exit = moduleFor('exit_intent').create(vi.fn());
    const up = moduleFor('scroll_up').create(vi.fn());

    leaveThroughTheTop();

    expect(exit.holds({ type: 'exit_intent' })).toBe(true);
    expect(up.holds({ type: 'scroll_up' })).toBe(false);

    scrollTo(1_200);
    scrollTo(900);

    expect(up.holds({ type: 'scroll_up' })).toBe(true);

    exit.stop?.();
    up.stop?.();
  });

  it('are two entries in the module set, with two ids', () => {
    const ids = PRO_MODULES.map((module) => module.id);

    expect(ids).toContain('exit_intent');
    expect(ids).toContain('scroll_up');
  });
});

/**
 * =============================================================================
 * THE TWO CART CONDITIONS: ONE COOKIE, TWO READS, NO WRITES.
 * =============================================================================
 * `WConvert\Pro\WooCommerce\CartCookie` writes `<count>:<total>` on
 * `woocommerce_cart_updated`. These two read it, synchronously, at the instant
 * a Trigger fires — which is what keeps the rule engine pure and what makes
 * "all Conditions hold at that instant" something the engine can state
 * (CONTEXT.md, Condition).
 *
 * The decisions worth asserting are the ones that decide whether an Optin
 * LIES: no cookie is false rather than true, a malformed cookie is false, and
 * `cart_has_items` reads the COUNT so a fully-discounted cart still counts as
 * a full one.
 */
describe('the cart conditions', () => {
  const withCookie = (value: string | null): void => {
    // jsdom's `document.cookie` setter appends, so an expiry is how one goes.
    document.cookie = 'wconvert_cart=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';

    if (value !== null) {
      document.cookie = `wconvert_cart=${encodeURIComponent(value)}; path=/`;
    }
  };

  const hasItems = (): boolean => moduleFor('cart_has_items').create(vi.fn()).holds({ type: 'cart_has_items' });

  const worthAtLeast = (amount: unknown): boolean =>
    moduleFor('cart_value_min').create(vi.fn()).holds({ type: 'cart_value_min', amount });

  afterEach(() => withCookie(null));

  it('reads a cart the server put on the device', () => {
    withCookie('3:45.00');

    expect(hasItems()).toBe(true);
    expect(worthAtLeast(40)).toBe(true);
  });

  /**
   * **No cookie is FALSE, never true.** A visitor with no cart is exactly the
   * person an Optin saying "you left something in your cart" would be lying
   * to, so the absent case must fail closed — the opposite of the storage
   * ladder's fail-open posture, which is about a frequency cap rather than
   * about a claim.
   */
  it('holds for nobody when there is no cart on the device', () => {
    withCookie(null);

    expect(hasItems()).toBe(false);
    expect(worthAtLeast(0)).toBe(false);
  });

  it('holds for nobody when the cart has been emptied', () => {
    withCookie('0:0.00');

    expect(hasItems()).toBe(false);
    expect(worthAtLeast(0)).toBe(false);
  });

  /**
   * A malformed cookie is not a cart. `Number('')` is 0 and
   * `Number(undefined)` is NaN, so both halves are checked rather than
   * trusted.
   */
  it('treats a cookie it cannot parse as no cart at all', () => {
    for (const nonsense of ['', 'three items', '3', ':', 'x:y', '3:']) {
      withCookie(nonsense);

      expect(hasItems(), nonsense).toBe(false);
      expect(worthAtLeast(1), nonsense).toBe(false);
    }
  });

  /**
   * **`cart_has_items` reads the COUNT and not the total**, which is what
   * keeps the rule named for what it measures: a cart holding three fully
   * discounted items is worth nothing and still has three items in it.
   */
  it('counts a fully discounted cart as a full one', () => {
    withCookie('3:0.00');

    expect(hasItems()).toBe(true);
    expect(worthAtLeast(1)).toBe(false);
  });

  it('compares the threshold inclusively, because "at least" includes it', () => {
    withCookie('1:45.00');

    expect(worthAtLeast(45)).toBe(true);
    expect(worthAtLeast(45.01)).toBe(false);
  });

  /**
   * **A blank threshold holds for nobody**, not for everybody. The opposite
   * reading turns a rule the merchant left half-configured into one that
   * holds for every visitor, which is the direction that makes an Optin lie —
   * and a Condition that never holds is the failure they can see, because
   * they are looking at the row they left blank.
   */
  it('holds for nobody when the merchant has not set a threshold', () => {
    withCookie('2:99.00');

    for (const blank of [undefined, null, '', '50', NaN]) {
      expect(worthAtLeast(blank), String(blank)).toBe(false);
    }
  });

  /**
   * **Read live, never at instantiation.** A visitor can add to their cart in
   * another tab, or through WooCommerce's own AJAX on this page, between a
   * timer being armed and firing — and the answer that matters is the one at
   * the moment it fires.
   */
  it('answers for right now rather than for when it was created', () => {
    withCookie(null);

    const evaluator = moduleFor('cart_has_items').create(vi.fn());

    expect(evaluator.holds({ type: 'cart_has_items' })).toBe(false);

    withCookie('1:10.00');

    expect(evaluator.holds({ type: 'cart_has_items' })).toBe(true);
  });

  /** No listener to attach, so there is nothing to detach. */
  it('attaches nothing, so neither has anything to stop', () => {
    expect(moduleFor('cart_has_items').create(vi.fn()).stop).toBeUndefined();
    expect(moduleFor('cart_value_min').create(vi.fn()).stop).toBeUndefined();
  });

  /**
   * Both declare `functional`, which is never withheld — the judgement call
   * behind that is argued where the cookie is written. A category the manifest
   * and the module disagreed about would be caught next door; what this pins
   * is that neither is `null`, since a rule that READS the visitor's device
   * and declares nothing would be exempt from consent by omission.
   */
  it('both declare the storage they read', () => {
    expect(moduleFor('cart_has_items').consentCategory).toBe('functional');
    expect(moduleFor('cart_value_min').consentCategory).toBe('functional');
  });
});

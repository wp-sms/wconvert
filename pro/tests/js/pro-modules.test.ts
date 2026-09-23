import { afterEach, describe, expect, it, vi } from 'vitest';
import manifest from '../../../resources/rules/manifest.json';
import { ELITE_MODULES } from '../../resources/loader/src/modules';
import type { LoaderModule, Rule } from '@loader/types';

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
  const found = ELITE_MODULES.find((module) => module.id === id);

  if (found === undefined) {
    throw new Error(`Pro's top rung ships no ${id} module`);
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

/** Observe during the synchronous gesture, then prove it cannot be replayed. */
function pulse(type: string, rule: Rule = { type }) {
  const answers: boolean[] = [];
  const evaluator = moduleFor(type).create(() => answers.push(evaluator.holds(rule)));
  return { answers, evaluator };
}
describe('click_element', () => {
  it.each([
    ['<button id="target" class="buy">Buy</button>', '.buy', true],
    ['<button class="buy"><span id="target">Buy</span></button>', '.buy', true],
    ['<button id="target">Elsewhere</button>', '.buy', false],
    ['<button id="target">Buy</button>', '', false],
    ['<button id="target">Buy</button>', '   ', false],
    ['<button id="target">Buy</button>', '((', false],
  ])('evaluates selector %s %s only during the click', (html, selector, expected) => {
    document.body.innerHTML = html;
    const rule = { type: 'click_element', selector };
    const { answers, evaluator } = pulse('click_element', rule);
    const button = document.querySelector('#target')!;
    button.addEventListener('click', event => event.stopPropagation());
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(answers).toEqual([expected]);
    expect(evaluator.holds(rule)).toBe(false);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(answers).toEqual([expected, expected]);
    evaluator.stop?.();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(answers).toHaveLength(2);
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

describe('fresh exit and scroll-up gestures', () => {
  it('signals each top exit, never a side exit or movement between elements', () => {
    const { answers, evaluator } = pulse('exit_intent');
    document.body.innerHTML = '<button id="inside">Inside</button>';
    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, relatedTarget: document.querySelector('#inside') }));
    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 400, relatedTarget: null }));
    expect(answers).toEqual([]);
    leaveThroughTheTop(); leaveThroughTheTop();
    expect(answers).toEqual([true, true]);
    expect(evaluator.holds({ type: 'exit_intent' })).toBe(false);
    evaluator.stop?.(); leaveThroughTheTop();
    expect(answers).toHaveLength(2);
  });
  it('requires a substantial upward movement after reaching depth', () => {
    scrolledTo(0);
    const { answers, evaluator } = pulse('scroll_up');
    scrollTo(250); scrollTo(0); scrollTo(1200); scrollTo(1150);
    expect(answers).toEqual([]);
    scrollTo(900);
    expect(answers).toEqual([true]);
    expect(evaluator.holds({ type: 'scroll_up' })).toBe(false);
    scrollTo(600);
    expect(answers).toEqual([true, true]);
    evaluator.stop?.(); scrollTo(1600); scrollTo(1000);
    expect(answers).toHaveLength(2);
  });
  it('uses the existing depth when delayed scripts attach', () => {
    scrolledTo(1500);
    const { answers, evaluator } = pulse('scroll_up');
    scrollTo(1200);
    expect(answers).toEqual([true]);
    evaluator.stop?.();
  });
  it('does not replay exit on a later scroll gesture', () => {
    scrolledTo(0);
    const exit = pulse('exit_intent'); const up = pulse('scroll_up');
    leaveThroughTheTop();
    expect(exit.answers).toEqual([true]); expect(up.answers).toEqual([]);
    scrollTo(1200); scrollTo(900);
    expect(up.answers).toEqual([true]); expect(exit.evaluator.holds({ type: 'exit_intent' })).toBe(false);
    exit.evaluator.stop?.(); up.evaluator.stop?.();
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

describe('referrer', () => {
  const cameFrom = (referrer: string): void => void vi.spyOn(document, 'referrer', 'get').mockReturnValue(referrer);

  const holds = (referrer: string, wanted: unknown): boolean => {
    cameFrom(referrer);

    return moduleFor('referrer').create(vi.fn()).holds({ type: 'referrer', in: wanted });
  };

  it('counts a visit with no referring page as direct', () => {
    expect(holds('', ['direct'])).toBe(true);
  });

  it('does not count a visit that came from somewhere as direct', () => {
    expect(holds('https://example.com/blog', ['direct'])).toBe(false);
  });

  it('matches a domain the merchant named', () => {
    expect(holds('https://example.com/blog', ['example.com'])).toBe(true);
    expect(holds('https://elsewhere.test/blog', ['example.com'])).toBe(false);
  });

  it('counts a referrer from the site itself as direct, not as a referring domain', () => {
    const own = `https://${window.location.hostname}/pricing`;

    expect(holds(own, ['direct'])).toBe(true);
    expect(holds(own, [window.location.hostname])).toBe(false);
  });

  it('counts a known search engine as search, whatever its country domain or subdomain', () => {
    expect(holds('https://www.google.com/', ['search'])).toBe(true);
    expect(holds('https://www.google.co.uk/', ['search'])).toBe(true);
    expect(holds('https://news.google.com/', ['search'])).toBe(true);
    expect(holds('https://duckduckgo.com/', ['search'])).toBe(true);
  });

  it('still matches a known host the merchant named outright', () => {
    expect(holds('https://www.google.com/', ['google.com'])).toBe(true);
  });

  it('counts a known social network as social', () => {
    expect(holds('https://l.facebook.com/', ['social'])).toBe(true);
    expect(holds('https://t.co/abc', ['social'])).toBe(true);
    expect(holds('https://www.linkedin.com/feed/', ['social'])).toBe(true);
    expect(holds('https://www.google.com/', ['social'])).toBe(false);
  });

  it('leaves an unknown host unclassified, so only a named domain reaches it', () => {
    expect(holds('https://forum.example.test/thread/9', ['direct', 'search', 'social'])).toBe(false);
    expect(holds('https://forum.example.test/thread/9', ['example.test'])).toBe(true);
  });

  it('reads a referrer it cannot parse as direct rather than throwing', () => {
    for (const nonsense of ['not a url', 'https://', '://example.com', ' ']) {
      expect(holds(nonsense, ['direct']), nonsense).toBe(true);
      expect(holds(nonsense, ['search', 'social', 'example.com']), nonsense).toBe(false);
    }
  });

  it('holds for nobody while the merchant has chosen nothing', () => {
    for (const blank of [undefined, null, [], '', ['']]) {
      expect(holds('https://www.google.com/', blank), String(blank)).toBe(false);
      expect(holds('', blank), String(blank)).toBe(false);
    }
  });

  it('reads the referrer at the moment it is asked', () => {
    const evaluator = moduleFor('referrer').create(vi.fn());

    cameFrom('https://www.google.com/');
    expect(evaluator.holds({ type: 'referrer', in: ['search'] })).toBe(true);

    cameFrom('');
    expect(evaluator.holds({ type: 'referrer', in: ['search'] })).toBe(false);
  });

  it('attaches nothing, so it has nothing to stop', () => {
    expect(moduleFor('referrer').create(vi.fn()).stop).toBeUndefined();
  });

  /**
   * ==========================================================================
   * NOTHING ABOUT THE REFERRER IS STORED, AND THIS IS WHAT SAYS SO LATER.
   * ==========================================================================
   * The obvious next feature request is a FIRST-TOUCH source — "they
   * originally arrived from Google" — and the only way to answer it is to hold
   * the first referrer across page views. That is a per-visitor fact with a
   * lifetime, which is the shape ADR 0017 refuses, and it would need a Storage
   * Consent category this rule declares none of.
   *
   * So the assertion is on the WRITE, not on the declaration: a later change
   * that starts caching a source fails here rather than shipping a rule whose
   * `consentCategory: null` has quietly become a lie.
   */
  /**
   * ==========================================================================
   * EVERY CHANNEL THE MANIFEST DECLARES HAS A BRANCH, AND A FOURTH WOULD FAIL.
   * ==========================================================================
   * The closed half of `in` is spelled in two places — `options` on the
   * manifest entry, which is what draws the checkboxes, and the branches here,
   * which are what answer them. A channel declared with no branch falls
   * through to hostname matching and holds only for a visitor arriving from a
   * site literally called "social", which is a control that draws correctly
   * and answers for nobody.
   *
   * Asserted behaviourally rather than as a list against a list: a channel
   * name is not a hostname, so a referrer from a host of exactly that name
   * must NOT match it. That is false under a branch and true without one.
   */
  it.each(manifest.conditions.referrer.params.in.options)(
    'answers the manifest channel %s as a channel rather than as a hostname',
    (channel) => {
      expect(holds(`https://${channel}/`, [channel])).toBe(false);
    },
  );

  it('stores nothing about where the visitor came from', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const cookie = vi.spyOn(document, 'cookie', 'set');

    const evaluator = moduleFor('referrer').create(vi.fn());

    for (const from of ['https://www.google.com/', 'https://l.facebook.com/', 'https://example.com/', '']) {
      cameFrom(from);
      evaluator.holds({ type: 'referrer', in: ['search', 'social', 'direct', 'example.com'] });
    }

    evaluator.stop?.();

    expect(local).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

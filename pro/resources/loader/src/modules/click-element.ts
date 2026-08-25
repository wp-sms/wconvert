import type { LoaderModule } from '@loader/types';

/**
 * `click_element` — fires when the visitor clicks something the merchant named.
 *
 * **The selector is author-only** (ADR 0012). A CSS selector names markup only
 * one site has, so the rule manifest marks the param `authored` and
 * `PlaybookLibrary` refuses any [[Playbook]] supplying one — which is why a
 * Playbook-prefilled Optin carries this Trigger blank rather than pointing at
 * a class that exists on somebody else's theme.
 *
 * A blank selector never fires, deliberately. The alternative readings are
 * "fires on any click", which is a popup on the first click anywhere, and
 * "cannot be saved", which would refuse the very state prefill hands the
 * merchant to fill in.
 *
 * One document-level listener rather than one per rule: the module is
 * instantiated once for however many Optins name this type, and does not know
 * their selectors. It records what was clicked and each rule asks its own
 * question of the record — the same high-water shape `scroll_depth` has, and
 * for the same reason: clicking elsewhere afterwards does not un-click what
 * was clicked.
 */

/**
 * How many clicked elements are remembered.
 *
 * A cap rather than an unbounded list, because the entries are DOM nodes and a
 * long-lived page — an infinite-scroll archive, a single-page checkout — would
 * otherwise pin every one of them for the session. Twenty is far past any
 * plausible rule: a visitor who clicked twenty things and matched none of them
 * on the way is not about to.
 */
const REMEMBERED = 20;

export const clickElement: LoaderModule = {
  id: 'click_element',
  kind: 'trigger',
  consentCategory: null,
  create: (changed) => {
    const clicked: Element[] = [];

    const onClick = (event: Event): void => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      clicked.push(target);
      clicked.splice(0, clicked.length - REMEMBERED);
      changed();
    };

    // Capture, so a handler that stops propagation on the merchant's own
    // button cannot make the Trigger it was chosen for unfireable.
    document.addEventListener('click', onClick, true);

    return {
      holds: (rule) => {
        const selector = typeof rule.selector === 'string' ? rule.selector.trim() : '';

        if (selector === '') {
          return false;
        }

        try {
          return clicked.some((element) => element.closest(selector) !== null);
        } catch {
          // A selector a merchant typed, which `closest` throws on rather than
          // returning null for. False, not a crash that takes every other
          // Optin on the page down with it.
          return false;
        }
      },
      stop: () => document.removeEventListener('click', onClick, true),
    };
  },
};

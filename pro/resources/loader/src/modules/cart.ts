/**
 * The cart, as the browser is allowed to know it.
 *
 * ============================================================================
 * ONE COOKIE, TWO READS, NO WRITES.
 * ============================================================================
 * `WConvert\Pro\WooCommerce\CartCookie` writes `<count>:<total>` on
 * `woocommerce_cart_updated`; these two Conditions read it. That is the entire
 * traffic between WConvert and WooCommerce (ADR 0025) — no fetch, no Store
 * API call, nothing asynchronous. A Condition is answered at the instant a
 * Trigger fires, so the answer has to already be on the device: a rule that
 * had to ask the server would make the rule engine asynchronous, and "all
 * Conditions hold at that instant" would stop being something the engine can
 * state (CONTEXT.md, Condition).
 *
 * **Read live, never at instantiation**, which is the posture every Condition
 * takes. A visitor can add to their cart in another tab, or on this page
 * through WooCommerce's own AJAX, between a ten-second timer being armed and
 * firing — and the answer that matters is the one at the moment it fires.
 *
 * **No listener and no state**, so neither module returns a `stop()`. Reading
 * `document.cookie` attaches nothing there is anything to detach.
 *
 * ============================================================================
 * THE COOKIE IS THE WHOLE OF WHAT IS KNOWABLE HERE, DELIBERATELY.
 * ============================================================================
 * Two numbers, never contents: no product ids, no SKUs, no names. So there is
 * nothing in this file that could answer *"is there a jacket in the cart"*,
 * and that is the point — a cart-contents Condition is a later decision to be
 * argued on its own, not one this file settles by having the data lying
 * around.
 *
 * Both declare `functional` Storage Consent, matching the manifest, and both
 * READ rather than write the visitor's device. The judgement call behind that
 * category is argued where the cookie is written, since that is where the
 * storage actually happens.
 *
 * **Two modules in one file**, unlike every other entry in this tree, because
 * they share a reader rather than merely a subject: one cookie, one parse,
 * one place that knows its format. Splitting them would put that parse in a
 * third file imported by two, which is the same indirection with an extra
 * name — and `exit-intent` and `scroll-up` are separate files precisely
 * because they share nothing at all.
 */

import type { LoaderModule } from '@loader/types';

const COOKIE = 'wconvert_cart';

/** What the cookie says right now, or null where there is nothing to read. */
function cart(): { count: number; total: number } | null {
  let raw: string | null = null;

  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));

    raw = match === null ? null : decodeURIComponent(match[1]);
  } catch {
    // Some embedded contexts throw on `document.cookie`. No cart is knowable,
    // which is the FALSE direction for both rules below — an Optin asserting
    // "you left items in your cart" must never show on a guess.
    return null;
  }

  if (raw === null) {
    return null;
  }

  // **A malformed cookie is not a cart, and half of one is not half a cart.**
  // The writer only ever produces `<count>:<total>`, so anything else has been
  // truncated or rewritten — and an Optin asserting "you left something in
  // your cart" off corrupted data is precisely the lie ADR 0027 exists to
  // prevent. Fail closed on all of it rather than trusting the half that
  // parsed.
  //
  // The empty-segment check is the one that matters and the one that is easy
  // to miss: `Number('')` is 0, not NaN, so `"3:"` would otherwise read as a
  // three-item cart worth nothing — true for `cart_has_items`, on a cookie
  // nothing wrote.
  const parts = raw.split(':');

  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    return null;
  }

  const parsed = { count: Number(parts[0]), total: Number(parts[1]) };

  return Number.isFinite(parsed.count) && Number.isFinite(parsed.total) ? parsed : null;
}

/**
 * `cart_has_items` — the Condition the cart [[Goal]]'s copy leans on.
 *
 * It takes no params: "there is something in the cart" is a predicate, not a
 * threshold. The threshold spelling is `cart_value_min` below, which is a
 * different question about a different number rather than this one with an
 * argument.
 *
 * **It reads the COUNT and not the total**, which is what keeps the rule named
 * for what it measures. A cart holding three fully-discounted items is worth
 * nothing and still has three items in it, and the Optin that says so is
 * telling the truth.
 */
export const cartHasItems: LoaderModule = {
  id: 'cart_has_items',
  kind: 'condition',
  consentCategory: 'functional',
  create: () => ({
    holds: () => (cart()?.count ?? 0) > 0,
  }),
};

/**
 * `cart_value_min` — the cart is worth at least this much.
 *
 * The threshold is in the store's own currency and is therefore site-local,
 * which is why its param is marked `authored` in the manifest: a [[Playbook]]
 * may not supply one, so this rule is reachable **only by hand** and appears
 * in none of the bundled cart entries (ADR 0013).
 *
 * An absent or unparseable threshold is **false rather than "any cart"**. The
 * opposite reading would turn a half-configured rule into one that holds for
 * everybody, which is the direction that makes an Optin lie; and a Condition
 * that never holds is the safe failure, since the merchant is looking at a
 * rule row they left blank.
 */
export const cartValueMin: LoaderModule = {
  id: 'cart_value_min',
  kind: 'condition',
  consentCategory: 'functional',
  create: () => ({
    holds: (rule) => {
      // A NUMBER, not a numeric string. `PublishedProjection` ships the param
      // exactly as the builder's `amount` control stored it, and coercing a
      // string here would quietly accept a hand-written `"49.99"` from one
      // install and a `"49,99"` from another as different rules.
      // `typeof NaN` is `'number'`, so both halves are asked.
      if (typeof rule.amount !== 'number' || !Number.isFinite(rule.amount)) {
        return false;
      }

      const wanted = rule.amount;
      const found = cart();

      // The count matters here too: a cart with nothing in it and a threshold
      // of zero would otherwise hold, and "spend at least nothing" is not a
      // rule anybody wrote.
      return found !== null && found.count > 0 && found.total >= wanted;
    },
  }),
};

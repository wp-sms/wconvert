import { describe, expect, it } from 'vitest';
import manifest from '../../../resources/rules/manifest.json';
import { parityProblems } from '../../../tests/js/support/manifest-parity';
import type { Manifest } from '../../../tests/js/support/manifest-parity';
import {
  CART_MODULES,
  DISPLAY_TYPE_MODULES,
  PREMIUM_TRIGGER_MODULES,
} from '../../resources/loader/src/modules';

/**
 * The manifest and the modules say the same thing — Pro's half.
 *
 * This file lives under pro/ rather than under tests/js/, and that placement is
 * the point: it imports Pro's tree, so putting it in free's tree would make the
 * test itself the leak `bin/verify-source-contract.sh` exists to catch.
 *
 * It is the assertion that decides WHERE a premium entry may land: a
 * `tier: pro` entry added to the manifest without a Pro module fails here on
 * the same pull request, which is what keeps ADR 0029's "every entry resolves
 * to an implementation on the side its tier names" from being a sentence
 * nobody runs. That is why `exit_intent` and `scroll_up` could not arrive with
 * the manifest half of #22 and arrive here instead, with the modules that
 * implement them.
 */
describe("Pro's modules against the manifest", () => {
  /**
   * ==========================================================================
   * ONE RUNG AT A TIME, BECAUSE THE LADDER IS CUMULATIVE AND THE MANIFEST IS
   * NOT.
   * ==========================================================================
   * A tier SHIPS everything below it, so `ELITE_MODULES` carries the premium
   * Triggers as well as the cart Conditions — but each manifest entry declares
   * exactly one `tier`, which is the LOWEST rung that supplies it. Asking
   * parity of the cumulative set would report every inherited module as
   * "implemented on the wrong side".
   *
   * So each module's own set is checked against its own rung, and the three
   * cases together are the whole of Pro's half. That is also the finer
   * assertion: it says which MODULE a premium entry belongs to, so an
   * `exit_intent` moved to the cart module without moving its manifest entry
   * fails here rather than shipping a Pro build that cannot fire it
   * (ADR 0056).
   */
  it.each([
    ['basic', 'display-types', DISPLAY_TYPE_MODULES],
    ['pro', 'premium-triggers', PREMIUM_TRIGGER_MODULES],
    ['elite', 'cart-recovery', CART_MODULES],
  ] as const)('implements exactly what the manifest files under %s', (tier, _module, modules) => {
    expect(parityProblems(manifest as Manifest, tier, modules)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import tiers from '../../../tiers.json';
import {
  AB_TESTING_MODULES,
  CART_MODULES,
  DISPLAY_TYPE_MODULES,
  INLINE_PLACEMENT_MODULES,
  CONTENT_LOCK_MODULES,
  JOURNEY_MODULES,
  PRO_MODULES,
  PREMIUM_TRIGGER_MODULES,
} from '../../resources/loader/src/modules';
import type { LoaderModule } from '@loader/types';

/**
 * =============================================================================
 * WHAT PRO'S BUNDLE COMPOSES IS WHAT `tiers.json` SAYS PRO SHIPS.
 * =============================================================================
 * The module set is declared twice and it has to be: `tiers.json` is what PHP
 * and the release build read, and the bundler needs a STATIC import graph.
 *
 * So the two declarations are checked against each other here. The failure this
 * catches is the quiet one: a module added to `tiers.json` and not to
 * `PRO_MODULES` ships in a Pro ZIP whose contract says it should be there, in a
 * Pro BUNDLE that cannot evaluate it. Every Optin holding that rule would leave
 * the payload unsuspended, reach the page, and never fire, with nothing in any
 * log — the silent total loss of function ADR 0012 names as this category's
 * defining support ticket.
 *
 * This file lives under pro/ rather than under tests/js/, and that placement is
 * the point: it imports Pro's tree, so putting it in free's tree would make the
 * test itself the leak `bin/verify-source-contract.sh` exists to catch.
 */

/**
 * Which loader modules each MODULE DIRECTORY contributes.
 *
 * The one hand-written map in this arrangement, and it is written in the test
 * rather than in the product deliberately: it is the thing being asserted. The
 * product never needs it — Pro's entry names its set directly, and the bundler
 * cuts on that — so putting it in `src/` would be a list that
 * exists only to be checked, which is the cross-cutting list ADR 0015 refuses.
 */
const MODULE_DIRECTORIES: Readonly<Record<string, readonly LoaderModule[]>> = {
  'spam-filters': [],
  'display-types': DISPLAY_TYPE_MODULES,
  'inline-placement': INLINE_PLACEMENT_MODULES,
  'content-lock': CONTENT_LOCK_MODULES,
  'journeys': JOURNEY_MODULES,
  'premium-triggers': PREMIUM_TRIGGER_MODULES,
  'ab-testing': AB_TESTING_MODULES,
  'cart-recovery': CART_MODULES,
  'analytics': [], // Optional transport, no rule evaluators.
  'destinations': [], // PHP-only module; no visitor-side loader code.
};

const idsOf = (modules: readonly LoaderModule[]): string[] => modules.map((module) => module.id);

describe('Pro composes what tiers.json says it ships', () => {
  it('has one paid tier, and it is pro (ADR 0146)', () => {
    expect(tiers.premium.tiers.map((tier) => tier.slug)).toEqual(['pro']);
  });

  it('composes exactly the modules tiers.json names, in order', () => {
    const [pro] = tiers.premium.tiers;
    const declared = pro.modules.flatMap((module) => {
      expect(MODULE_DIRECTORIES, `pro declares an unknown module "${module}"`).toHaveProperty(module);

      return idsOf(MODULE_DIRECTORIES[module]);
    });

    expect(idsOf(PRO_MODULES).sort()).toEqual(declared.sort());
  });

  /**
   * Nothing is stranded: a module directory Pro does not ship is code that is
   * built, tested and delivered to nobody.
   */
  it('leaves no module directory out of Pro', () => {
    const shipped = new Set(tiers.premium.tiers.flatMap((tier) => tier.modules));

    for (const module of Object.keys(MODULE_DIRECTORIES)) {
      expect(shipped, `${module} is shipped by no tier`).toContain(module);
    }
  });
});

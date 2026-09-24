import { describe, expect, it } from 'vitest';
import ladder from '../../../tiers.json';
import {
  AB_TESTING_MODULES,
  CART_MODULES,
  DISPLAY_TYPE_MODULES,
  INLINE_PLACEMENT_MODULES,
  CONTENT_LOCK_MODULES,
  JOURNEY_MODULES,
  MODULES_AT,
  PREMIUM_TRIGGER_MODULES,
} from '../../resources/loader/src/modules';
import type { LoaderModule } from '@loader/types';

/**
 * =============================================================================
 * WHAT A TIER'S BUNDLE COMPOSES IS WHAT `tiers.json` SAYS THAT TIER SHIPS.
 * =============================================================================
 * The ladder is declared twice and it has to be: `tiers.json` is what PHP and
 * the release build read, and the bundler needs a STATIC import graph to cut on
 * — a module set read out of JSON at runtime is a bundle carrying every tier's
 * code, which is the byte-identical `main.js` ADR 0056 measures WSMS by.
 *
 * So the two declarations are checked against each other here. The failure this
 * catches is the quiet one: a module added to `tiers.json` at the Pro rung and
 * to `ELITE_MODULES` only ships in a Pro ZIP whose contract says it should be
 * there, in a Pro BUNDLE that cannot evaluate it. Every Optin holding that rule
 * would leave the payload unsuspended, reach the page, and never fire, with
 * nothing in any log — the silent total loss of function ADR 0012 names as this
 * category's defining support ticket.
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
 * product never needs it — a tier entry names its cumulative set directly, and
 * the bundler cuts on that — so putting it in `src/` would be a list that
 * exists only to be checked, which is the cross-cutting list ADR 0015 refuses.
 */
const MODULE_DIRECTORIES: Readonly<Record<string, readonly LoaderModule[]>> = {
  'display-types': DISPLAY_TYPE_MODULES,
  'inline-placement': INLINE_PLACEMENT_MODULES,
  'content-lock': CONTENT_LOCK_MODULES,
  'journeys': JOURNEY_MODULES,
  'premium-triggers': PREMIUM_TRIGGER_MODULES,
  'ab-testing': AB_TESTING_MODULES,
  'cart-recovery': CART_MODULES,
};

const idsOf = (modules: readonly LoaderModule[]): string[] => modules.map((module) => module.id);

describe('each tier composes what the ladder says it ships', () => {
  it.each(ladder.premium.tiers.map((tier) => [tier.slug, tier.modules] as const))(
    '%s',
    (slug, modules) => {
      const declared = modules.flatMap((module) => {
        expect(MODULE_DIRECTORIES, `${slug} declares an unknown module "${module}"`).toHaveProperty(
          module,
        );

        return idsOf(MODULE_DIRECTORIES[module]);
      });

      expect(idsOf(MODULES_AT[slug as keyof typeof MODULES_AT])).toEqual(declared);
    },
  );

  /**
   * And the ladder is a ladder: each rung's set contains the one below it. The
   * assertion above would pass on three rungs that each happened to match a
   * `tiers.json` which was itself not cumulative.
   */
  it('is cumulative, so a higher rung carries everything a lower one does', () => {
    const rungs = ladder.premium.tiers.map(
      (tier) => new Set(idsOf(MODULES_AT[tier.slug as keyof typeof MODULES_AT])),
    );

    for (let above = 1; above < rungs.length; above++) {
      for (const id of rungs[above - 1]) {
        expect(rungs[above], `${ladder.premium.tiers[above].slug} dropped ${id}`).toContain(id);
      }
    }
  });

  /**
   * **No rung claims everything with a wildcard.** `tiers.json` says why in as
   * many words: against `"*"` the artifact contract's completeness half asserts
   * nothing, so the rung every customer buys today would be the one rung with
   * no check that it is complete.
   */
  it('has every rung name its own modules rather than claim all of them', () => {
    for (const tier of ladder.premium.tiers) {
      expect(Array.isArray(tier.modules), `${tier.slug} does not name its modules`).toBe(true);
      expect(tier.modules.length).toBeGreaterThan(0);
    }
  });

  /**
   * Nothing is stranded: a module directory that no rung ships is code that is
   * built, tested and delivered to nobody.
   */
  it('leaves no module directory outside the ladder', () => {
    const shipped = new Set(ladder.premium.tiers.flatMap((tier) => tier.modules));

    for (const module of Object.keys(MODULE_DIRECTORIES)) {
      expect(shipped, `${module} is shipped by no tier`).toContain(module);
    }
  });
});

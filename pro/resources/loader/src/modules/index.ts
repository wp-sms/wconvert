import type { LoaderModule } from '@loader/types';
import { DISPLAY_TYPE_MODULES } from '../../../../modules/display-types/loader';
import { PREMIUM_TRIGGER_MODULES } from '../../../../modules/premium-triggers/loader';
import { AB_TESTING_MODULES } from '../../../../modules/ab-testing/loader';
import { CART_MODULES } from '../../../../modules/cart-recovery/loader';

/**
 * What each tier's build ships, named once so the three entries and the parity
 * test read the same list.
 *
 * =============================================================================
 * A TIER IS THE UNION OF ITS MODULES, AND THE LADDER IS SPELLED AS ONE.
 * =============================================================================
 * `tiers.json` is where a tier's module set is declared for PHP and for the
 * build; this is the same declaration for the bundler, and
 * `pro/tests/js/tier-modules.test.ts` is what asserts the two agree. They
 * cannot be one file: the bundler needs a static import graph to cut on, and a
 * set read out of JSON at runtime is a bundle carrying every tier's code — the
 * byte-identical `main.js` ADR 0056 measures WSMS by.
 *
 * Each rung is written as the one below it PLUS its own, rather than as a fresh
 * list, so "higher supplies everything lower does" is a property of this file
 * rather than three lists somebody keeps in step. `WConvert\Support\Tier`'s
 * `includes()` is the same statement in PHP.
 *
 * `DISPLAY_TYPE_MODULES` and `AB_TESTING_MODULES` are empty and are spread
 * anyway: those modules' contributions are a PRESENTER and a payload narrowing
 * rather than rules, and dropping either here because it is empty today is how
 * a rule added to it later ships nowhere.
 */
export { DISPLAY_TYPE_MODULES, PREMIUM_TRIGGER_MODULES, AB_TESTING_MODULES, CART_MODULES };

export const BASIC_MODULES: readonly LoaderModule[] = [...DISPLAY_TYPE_MODULES];

export const PRO_MODULES: readonly LoaderModule[] = [
  ...BASIC_MODULES,
  ...PREMIUM_TRIGGER_MODULES,
  ...AB_TESTING_MODULES,
];

export const ELITE_MODULES: readonly LoaderModule[] = [...PRO_MODULES, ...CART_MODULES];

/** Every paid tier, by slug, ascending — read by the parity tests. */
export const MODULES_AT = {
  basic: BASIC_MODULES,
  pro: PRO_MODULES,
  elite: ELITE_MODULES,
} as const;

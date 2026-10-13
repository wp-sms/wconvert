import type { LoaderModule } from '@loader/types';
import { DISPLAY_TYPE_MODULES } from '../../../../modules/display-types/loader';
import { PREMIUM_TRIGGER_MODULES } from '../../../../modules/premium-triggers/loader';
import { AB_TESTING_MODULES } from '../../../../modules/ab-testing/loader';
import { CART_MODULES } from '../../../../modules/cart-recovery/loader';
import { CONTENT_LOCK_MODULES } from '../../../../modules/content-lock/loader';
import { INLINE_PLACEMENT_MODULES } from '../../../../modules/inline-placement/loader';
import { JOURNEY_MODULES } from '../../../../modules/journeys/loader';

/**
 * What Pro's build ships, named once so the loader, the inspector and the
 * parity test read the same list.
 *
 * `tiers.json` is where Pro's module set is declared for PHP and for the
 * build; this is the same declaration for the bundler, and
 * `pro/tests/js/tier-modules.test.ts` is what asserts the two agree. They
 * cannot be one file: the bundler needs a static import graph.
 *
 * `DISPLAY_TYPE_MODULES` and `AB_TESTING_MODULES` are empty and are spread
 * anyway: those modules' contributions are a PRESENTER and a payload narrowing
 * rather than rules, and dropping either here because it is empty today is how
 * a rule added to it later ships nowhere.
 */
export { DISPLAY_TYPE_MODULES, PREMIUM_TRIGGER_MODULES, AB_TESTING_MODULES, CART_MODULES, INLINE_PLACEMENT_MODULES, CONTENT_LOCK_MODULES, JOURNEY_MODULES };

export const PRO_MODULES: readonly LoaderModule[] = [
  ...DISPLAY_TYPE_MODULES,
  ...INLINE_PLACEMENT_MODULES,
  ...CONTENT_LOCK_MODULES,
  ...JOURNEY_MODULES,
  ...PREMIUM_TRIGGER_MODULES,
  ...AB_TESTING_MODULES,
  ...CART_MODULES,
];

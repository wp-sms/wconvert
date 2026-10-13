import { boot } from '@loader/boot';
import { registerQuizProducts } from '../../../modules/cart-recovery/loader/result-products';
import { narrowToArms } from '../../../modules/ab-testing/loader';
import { presenter, proLoaderFor } from './compose';
import { PRO_MODULES } from './modules';

/**
 * WConvert Pro's shipped loader: every module Pro ships, composed, then booted.
 *
 * The composition is `compose.ts`'s and is shared with the inspector; the
 * `boot` is only ever the loader's, and keeping it here is what keeps
 * `@loader/inspect/run` out of the loader's import graph (see that file).
 *
 * `boot` is free's, imported rather than forked: it is shared engine, and it is
 * the part that must survive being run at the wrong moment — an optimiser may
 * have moved this script above the payload it reads (ADR 0004).
 *
 * `pro/tests/js/tier-modules.test.ts` asserts the module set is exactly the
 * union of the modules `tiers.json` declares for Pro.
 */
registerQuizProducts();
const loader = proLoaderFor(PRO_MODULES);

// Insertion and manual precedence need the whole document, including a
// manually placed sidebar/footer anchor when an optimizer moves JS to head.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => boot(loader, presenter, narrowToArms), { once: true });
} else {
  boot(loader, presenter, narrowToArms);
}

/**
 * What this entry composed, stated rather than only used. Nothing at runtime
 * reads either export; the boundary tests do.
 */
export { presenter };

/**
 * And the payload narrowing, for the same reason: the `ab-testing` module
 * chooses one arm of each test before the engine is asked anything.
 */
export const narrowing = narrowToArms;

export default loader;

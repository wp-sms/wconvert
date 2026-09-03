import { bootProLoader, presenter as proPresenter } from './tier';
import { ELITE_MODULES } from './modules';

/**
 * WConvert Pro's shipped loader at the **elite** tier.
 *
 * The top rung, and what a source checkout runs: everything, including the
 * two cart Conditions whose guarantee the cart [[Goal]]'s own copy asserts
 * (ADR 0026).
 *
 * The whole content of this file is one choice — which module set — and
 * `pro/tests/js/tier-modules.test.ts` is what stops it being made wrongly:
 * the set named here must be exactly the union of the modules `tiers.json`
 * declares for this tier, and the built bundle must carry no identifier from a
 * higher one (`bin/check-loader.mjs`, `bin/verify-artifact-contract.sh`).
 *
 * Everything else — free's modules first, Pro's presenter, the boot that
 * survives being run at the wrong moment (ADR 0004) — is `tier.ts`'s, shared
 * so it cannot be got right at two rungs and wrong at the third.
 */
const loader = bootProLoader(ELITE_MODULES);

/**
 * What this entry composed, stated rather than only used. Nothing at runtime
 * reads either export; the boundary tests do.
 */
export const presenter = proPresenter;

export default loader;

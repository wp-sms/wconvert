import { bootProLoader, presenter as proPresenter } from './tier';
import { BASIC_MODULES } from './modules';

/**
 * WConvert Pro's shipped loader at the **basic** tier.
 *
 * The bottom rung: the two Display Types free has no container for, and the
 * eight designs that come with them. It ships no premium rule module at all,
 * so its module list is free's plus nothing — which is exactly what a Basic
 * customer bought, and what the artifact contract proves the ZIP contains.
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
const loader = bootProLoader(BASIC_MODULES);

/**
 * What this entry composed, stated rather than only used. Nothing at runtime
 * reads either export; the boundary tests do.
 */
export const presenter = proPresenter;

export default loader;

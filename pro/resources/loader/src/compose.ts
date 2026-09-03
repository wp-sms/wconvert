import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import type { LoaderModule } from '@loader/types';
import { proPresenter } from '../../../modules/display-types/loader';

/**
 * What every tier's entry has in common — which is everything except **which
 * modules it names**.
 *
 * =============================================================================
 * THERE IS ONE ENTRY PER TIER, IN SOURCE, AND NO BUILD FLAG ANYWHERE.
 * =============================================================================
 * ADR 0028 refused a mode flag one layer up, and the reason transfers exactly:
 * *"the difference between the free loader and Pro's is which modules their
 * entries import, decided in source, not by a build-time branch."* A tier is
 * the same kind of difference, so `basic.ts`, `pro.ts` and `elite.ts` each name
 * their own module set and this file holds the part that would otherwise be
 * copied three times.
 *
 * A flag would also have put every tier's code in every tier's bundle and asked
 * a `define()` to hide it, which is the thing ADR 0056 measures WSMS by: all
 * three of its tiers ship a byte-identical `main.js`, so a Basic customer holds
 * the Elite UI behind a client-readable switch. Under possession-gating that is
 * not a weaker gate, it is no gate.
 *
 * =============================================================================
 * FREE'S MODULES ARE ALWAYS FIRST, AT EVERY TIER.
 * =============================================================================
 * Pro REPLACES free's loader rather than augmenting it (ADR 0014), so a free
 * module missing from any paid build is a capability a merchant loses by
 * paying. Composed here rather than in each entry so that cannot be forgotten
 * at one rung — and free's first, so a duplicate id fails at composition rather
 * than resolving by array order.
 *
 * The presenter is here for the same reason and it is the half most easily done
 * by halves: an entry that composed every premium MODULE and then booted free's
 * presenter would decide a floating bar, count it as shown, and draw nothing
 * (`pro/tests/js/loader-boundary.test.ts`).
 *
 * =============================================================================
 * AND IT BOOTS NOTHING, WHICH IS WHY IT IS ITS OWN FILE.
 * =============================================================================
 * The loader's `boot` and the inspector's `runInspector` live in `tier.ts` and
 * `inspect/tier.ts`, one each. A single shared file importing both put
 * `@loader/inspect/run` in the LOADER's static import graph — the panel, its
 * CSS and the report inside the 12KB budget, which is precisely the silent
 * regression `tests/js/inspector-parity.test.ts` exists to catch, and it caught
 * it. Composition is what the two halves share; booting is not.
 */

/** Free's engine, free's modules, this tier's, and Pro's presenter. */
export function proLoaderFor(modules: readonly LoaderModule[]) {
  return createLoader([...FREE_MODULES, ...modules]);
}

/** The presenter every tier boots. Exported so an entry can state it. */
export const presenter = proPresenter;

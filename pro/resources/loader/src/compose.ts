import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import type { LoaderModule } from '@loader/types';
import { proPresenter } from '../../../modules/display-types/loader';

/**
 * What Pro's loader and inspector have in common — the composition.
 *
 * =============================================================================
 * NO BUILD FLAG ANYWHERE.
 * =============================================================================
 * ADR 0028 refused a mode flag, and the reason stands: *"the difference between
 * the free loader and Pro's is which modules their entries import, decided in
 * source, not by a build-time branch."*
 *
 * =============================================================================
 * FREE'S MODULES ARE ALWAYS FIRST.
 * =============================================================================
 * Pro REPLACES free's loader rather than augmenting it (ADR 0014), so a free
 * module missing from Pro's build is a capability a merchant loses by paying.
 * Free's go first, so a duplicate id fails at composition rather than resolving
 * by array order.
 *
 * The presenter is here for the same reason and it is the half most easily done
 * by halves: an entry that composed every premium MODULE and then booted free's
 * presenter would decide a floating bar, count it as shown, and draw nothing
 * (`pro/tests/js/loader-boundary.test.ts`).
 *
 * =============================================================================
 * AND IT BOOTS NOTHING, WHICH IS WHY IT IS ITS OWN FILE.
 * =============================================================================
 * The loader's `boot` and the inspector's `runInspector` live in `main.ts` and
 * `inspect/main.ts`, one each. A single shared file importing both put
 * `@loader/inspect/run` in the LOADER's static import graph — the panel, its
 * CSS and the report inside the loader budget, which is precisely the silent
 * regression `tests/js/inspector-parity.test.ts` exists to catch, and it caught
 * it. Composition is what the two halves share; booting is not.
 */

/** Free's engine, free's modules, then Pro's. */
export function proLoaderFor(modules: readonly LoaderModule[]) {
  return createLoader([...FREE_MODULES, ...modules]);
}

/** The presenter Pro boots. Exported so an entry can state it. */
export const presenter = proPresenter;

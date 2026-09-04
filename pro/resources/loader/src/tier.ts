import { boot } from '@loader/boot';
import type { PayloadNarrowing } from '@loader/boot';
import type { LoaderModule } from '@loader/types';
import { presenter, proLoaderFor } from './compose';

/**
 * One tier's shipped loader: composed, then booted.
 *
 * The composition is `compose.ts`'s and is shared with the inspector; the
 * `boot` is only ever the loader's, and keeping it here is what keeps
 * `@loader/inspect/run` out of the loader's import graph (see that file).
 *
 * `boot` is free's, imported rather than forked: it is shared engine, and it is
 * the part that must survive being run at the wrong moment — an optimiser may
 * have moved this script above the payload it reads (ADR 0004).
 *
 * **The narrowing is the entry's, not this file's**, and that is the same rule
 * the module set follows one line up. `compose.ts` is shared by all three
 * rungs, so a narrowing imported there would put the `ab-testing` module's
 * code in the Basic bundle — the byte-identical failure ADR 0056 measures WSMS
 * by, arriving through a shared helper instead of through a flag. Each entry
 * names both of its choices; Rollup cuts on what the entry imported.
 */
export function bootProLoader(modules: readonly LoaderModule[], narrow?: PayloadNarrowing) {
  const loader = proLoaderFor(modules);

  boot(loader, presenter, narrow);

  return loader;
}

export { presenter };

import { boot } from '@loader/boot';
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
 */
export function bootProLoader(modules: readonly LoaderModule[]) {
  const loader = proLoaderFor(modules);

  boot(loader, presenter);

  return loader;
}

export { presenter };

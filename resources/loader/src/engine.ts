import type { Loader, LoaderModule } from './types';

/**
 * Compose a module set into a loader.
 *
 * This is the shared engine, and it lives in FREE's tree — Pro's entry imports
 * it rather than carrying a copy (ADR 0028). The dependency runs one way and
 * only one way: nothing under this tree may import a `pro/` path, which is what
 * `bin/verify-source-contract.sh` asserts on every pull request.
 *
 * Composition is pure and touches no DOM, so an entry may call it at module
 * scope without violating ADR 0004's "the loader does no work at module scope"
 * — that rule is about reading a payload element an optimizer may have moved,
 * and there is nothing to read here.
 */
export function createLoader(modules: readonly LoaderModule[]): Loader {
  const seen = new Set<string>();

  for (const module of modules) {
    if (seen.has(module.id)) {
      // Pro's entry is free's modules PLUS its own (ADR 0028), so a Pro module
      // reusing a free id would silently shadow — or be shadowed by — the free
      // one depending on array order, and which of the two ran would be a
      // property of a spread expression. Fail at composition instead: it is a
      // build-time mistake and this throws at build time.
      throw new Error(`WConvert loader: duplicate module id "${module.id}".`);
    }

    seen.add(module.id);
  }

  return { modules: [...modules] };
}

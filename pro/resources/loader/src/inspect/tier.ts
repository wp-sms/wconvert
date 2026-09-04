import { runInspector } from '@loader/inspect/run';
import type { PayloadNarrowing } from '@loader/boot';
import type { LoaderModule } from '@loader/types';
import { proLoaderFor } from '../compose';

/**
 * One tier's eligibility inspector: **the same module set as that tier's
 * loader**, and the same `decide()`.
 *
 * Composing a different set would report a different engine than the one the
 * page ran, which is the worst possible failure in a diagnostic — free's
 * inspector on a Pro install reports every `exit_intent` Optin as `inert` while
 * it works perfectly (ADR 0048, `ProInspectorEnqueue`). Per tier that hazard is
 * one rung finer: an Elite inspector on a Basic install would report the cart
 * Conditions as evaluable on a build that cannot evaluate them.
 *
 * **And the same NARROWING**, which is the same hazard read once more. Pro's
 * loader shows one arm of a [[Variant]] test and an inspector that showed both
 * would report an arm this page never considered — so each rung's inspector
 * entry names whatever its loader entry names.
 *
 * It shares `proLoaderFor` with the loader and nothing else, which is the whole
 * reason `compose.ts` exists apart from `tier.ts`: this import must never run
 * the other way.
 *
 * **The DOM is not read at module scope.** Same rule as the loader's entry
 * (ADR 0004): composition is pure, and everything that touches the page waits
 * until the document is ready — an optimiser may have moved this script above
 * the tags it reads.
 */
export function bootProInspector(modules: readonly LoaderModule[], narrow?: PayloadNarrowing) {
  const loader = proLoaderFor(modules);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => runInspector(loader, narrow), {
      once: true,
    });
  } else {
    runInspector(loader, narrow);
  }

  return loader;
}

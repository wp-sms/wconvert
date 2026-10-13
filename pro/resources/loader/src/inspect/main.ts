import { runInspector } from '@loader/inspect/run';
import { presenter, proLoaderFor } from '../compose';
import { PRO_MODULES } from '../modules';
import { narrowToArms } from '../../../../modules/ab-testing/loader';
import { contentLockExplanation } from '../../../../modules/content-lock/loader/inspect';
import { recoveryExplanation } from '../../../../modules/display-types/loader/recovery-inspect';
import { automaticPlacementState } from '../../../../modules/inline-placement/loader';

/**
 * Pro's eligibility inspector: **the same module set as Pro's loader**, and the
 * same `decide()`.
 *
 * =============================================================================
 * PRO HAS ITS OWN, BECAUSE FREE'S WOULD BE CONFIDENTLY WRONG.
 * =============================================================================
 * Pro dequeues free's inspector and enqueues its own, because free's has no
 * `exit_intent` module and would report every exit-intent Optin as `inert` —
 * *"it has no trigger this site can fire"* — about Optins that work perfectly
 * (ADR 0048). A diagnostic that is confidently wrong is worse than none,
 * because the merchant acts on it and goes and rewrites correct rules.
 *
 * **And the same NARROWING**, which is the same hazard read once more. Pro's
 * loader shows one arm of a [[Variant]] test and an inspector that showed both
 * would report an arm this page never considered.
 *
 * It shares `proLoaderFor` with the loader and nothing else, which is the whole
 * reason `compose.ts` exists apart from `main.ts`: this import must never run
 * the other way.
 *
 * **The DOM is not read at module scope.** Same rule as the loader's entry
 * (ADR 0004): composition is pure, and everything that touches the page waits
 * until the document is ready — an optimiser may have moved this script above
 * the tags it reads.
 */
const loader = proLoaderFor(PRO_MODULES);
const presentation = { select: presenter.select, placement: automaticPlacementState, recovery: (entry: Parameters<typeof recoveryExplanation>[0], decision: Parameters<typeof recoveryExplanation>[1]) => contentLockExplanation(entry) ?? recoveryExplanation(entry, decision) };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => runInspector(loader, narrowToArms, presentation), {
    once: true,
  });
} else {
  runInspector(loader, narrowToArms, presentation);
}

export default loader;

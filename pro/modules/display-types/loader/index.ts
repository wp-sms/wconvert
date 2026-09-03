import type { LoaderModule } from '@loader/types';

export { proPresenter } from './present';

/**
 * The `display-types` module's loader half.
 *
 * =============================================================================
 * IT SUPPLIES A PRESENTER RATHER THAN RULE MODULES, AND THE EMPTY LIST IS REAL.
 * =============================================================================
 * Every other module answers "which rules can fire". This one answers "what can
 * be drawn": `floating_bar` and `slide_in` are the two Display Types free has no
 * container for, and `popover.ts` is the container (ADR 0011). No rule type is
 * involved, so the module set below is empty — stated rather than omitted, so
 * that a tier entry composing every installed module's rules cannot silently
 * skip a module whose contribution is not a rule.
 *
 * **The presenter is the load-bearing export.** Pro dequeues free's loader and
 * runs its own (ADR 0014), so on every paid install this is what draws the
 * popups and the inline Optins too — it delegates to free's presenter for
 * everything that is not a popover. An entry composing this module's rules and
 * booting free's presenter would decide and count a floating bar and then draw
 * nothing, because free's `mount()` has no container for the type.
 *
 * That is why `display-types` sits at the BOTTOM rung and every higher tier
 * carries it (`tiers.json`): a build without it is a Pro that draws no bar.
 */
export const DISPLAY_TYPE_MODULES: readonly LoaderModule[] = [];

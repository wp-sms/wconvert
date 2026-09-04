import type { LoaderModule } from '@loader/types';
import type { PayloadNarrowing } from '@loader/boot';
import { persistentStore } from '@loader/storage';
import { STATE_KEY } from '@loader/state';
import { assignArms } from './arms';

/**
 * The `ab-testing` module's loader half.
 *
 * =============================================================================
 * IT SHIPS NO RULE MODULE, AND THAT IS THE DESIGN RATHER THAN A GAP.
 * =============================================================================
 * An arm is not a [[Condition]]. Filing it as one would put *"which variant is
 * this"* in the builder's rule rows for a merchant to add, edit and delete by
 * hand — and it would make a free install answer `ineligible` for every arm of
 * every test, taking the whole campaign off the site the day somebody
 * deactivated Pro.
 *
 * What it contributes instead is one payload narrowing, composed in the tier
 * entries that ship this module ({@link PayloadNarrowing} says why that is not
 * a registration seam). `display-types` already sets the precedent one
 * directory over: its contribution is a PRESENTER rather than a rule, and its
 * module list is empty and spread anyway.
 *
 * =============================================================================
 * WHAT A BUILD WITHOUT THIS MODULE DOES, WHICH IS NOT NOTHING.
 * =============================================================================
 * Free's loader, and a Basic build's, carry no narrowing at all — so both arms
 * of a published test reach `decide()` as two entries. For the three overlay
 * [[Display Type]]s `arbitrate()` then shows exactly one, deterministically:
 * priority first, then id, and a variant copies its parent's priority, so the
 * PARENT wins on its lower ULID. An `inline` arm renders at its parent's
 * anchor and the parent renders there too, so the same anchor is claimed once.
 *
 * The test therefore **freezes on arm A** rather than breaking, which is
 * ADR 0012's "degrade rather than stop" arriving without a substitution table:
 * the counters stay interpretable, nothing is destroyed, and it starts
 * splitting again the moment Pro is back. A merchant who deactivates Pro
 * mid-test loses the split, not the campaign.
 */
export const AB_TESTING_MODULES: readonly LoaderModule[] = [];

/**
 * Show one arm of each test, drawn against the visitor's own record.
 *
 * The store is built here rather than passed in, for the reason free's shell
 * builds its own: `boot` starts with what it read off the page and nothing
 * else. It is the same `wcv1` key and the same ladder — a fifth field on a
 * record that already exists, not a second store (ADR 0045).
 */
export const narrowToArms: PayloadNarrowing = (entries) =>
  assignArms(entries, persistentStore(STATE_KEY));

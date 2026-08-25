import type { LoaderModule } from '../types';
import { device } from './device';
import { pageLoad } from './page-load';
import { scrollDepth } from './scroll-depth';
import { timeOnPage } from './time-on-page';

/**
 * Free's loader modules — one per rule type free's tier owns.
 *
 * Three Triggers and one Condition, which is exactly the free/premium line
 * issue #3 drew: all of Targeting and the three cheap Triggers are free,
 * "advanced targeting" means the Condition set, and `device` is the one argued
 * exception on that side.
 *
 * `exit_intent`, `scroll_up`, `click_element` and the other twelve Conditions
 * live under Pro's module tree and ONLY there. Free's source never imports
 * them, and nothing under free's tree may — that is the invariant
 * `bin/verify-source-contract.sh` proves without a build, on every pull request
 * (ADR 0028, ADR 0029).
 */
export const FREE_MODULES: readonly LoaderModule[] = [pageLoad, timeOnPage, scrollDepth, device];

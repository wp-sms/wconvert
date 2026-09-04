import type { LoaderModule } from '../types';
import { device } from './device';
import { pageLoad } from './page-load';
import { scrollDepth } from './scroll-depth';
import { timeOfDay } from './time-of-day';
import { timeOnPage } from './time-on-page';

/**
 * Free's loader modules — one per rule type free's tier owns.
 *
 * Three Triggers and two Conditions. Issue #3 drew the line as "all of
 * Targeting and the three cheap Triggers are free, advanced targeting means
 * the Condition set", with `device` as the one argued exception on that side.
 * `time_of_day` is the second, argued the same way (#92): a merchant who
 * cannot say *"only during opening hours"* has a popup that greets people at
 * three in the morning, and an annoyance safeguard behind a paywall is the
 * exact complaint the review corpus records against competitors.
 *
 * `exit_intent`, `scroll_up`, `click_element` and the other twelve Conditions
 * live under Pro's module tree and ONLY there. Free's source never imports
 * them, and nothing under free's tree may — that is the invariant
 * `bin/verify-source-contract.sh` proves without a build, on every pull request
 * (ADR 0028, ADR 0029).
 */
export const FREE_MODULES: readonly LoaderModule[] = [pageLoad, timeOnPage, scrollDepth, device, timeOfDay];

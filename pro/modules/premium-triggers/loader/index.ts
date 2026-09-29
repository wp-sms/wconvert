import type { LoaderModule } from '@loader/types';
import { clickElement } from './click-element';
import { exitIntent } from './exit-intent';
import { queryParam } from './query-param';
import { referrer } from './referrer';
import { adBlocking } from './ad-blocking';
import { scrollUp } from './scroll-up';

/**
 * The `premium-triggers` module's loader half.
 *
 * `click_element` and `query_param` are the two the builder needs a general
 * form for: a Trigger whose param is author-only, and the Condition the
 * campaign presets are shortcuts over (ADR 0005).
 *
 * `referrer` is `query_param`'s other half and is filed here for that reason
 * (#91). `query_param` reads a UTM tag the merchant put there themselves, so
 * it only ever describes traffic they already tagged; `referrer` covers
 * everything they did not. It sees ONE HOP and stores nothing — the argument
 * is in `referrer.ts`, against ADR 0017.
 *
 * `exit_intent` and `scroll_up` are the first two premium rules that are
 * premium for their own sake (#32). They are two entries here rather than one,
 * and `scroll-up.ts` is where that is argued.
 *
 * =============================================================================
 * THE MODULE IS THE DIRECTORY, AND THAT IS WHAT THE TIER LADDER CUTS ON.
 * =============================================================================
 * Everything under `pro/modules/premium-triggers/` is this module and nothing
 * outside it is, so a Basic build ships none of it by DELETING the directory —
 * not by a build flag, and not by a list of paths somebody maintains
 * (ADR 0056). `pro/modules/premium-triggers/module.json` is what a running
 * install reads back to infer that it is at least a Pro one
 * (`WConvert\Support\WpProPresence`), and `tiers.json` is the only place the
 * slug is related to a tier.
 *
 * Which tier ships it is therefore stated twice and asserted once: here on
 * disk, and as `tier: "pro"` on each of these five types in
 * `resources/rules/manifest.json`. `pro/tests/js/manifest-parity.test.ts` is
 * what stops the two drifting — an entry declared at a tier whose module set
 * does not carry its implementation suspends Optins at runtime for a reason
 * that is a bug rather than a missing dependency (ADR 0029).
 */
export const PREMIUM_TRIGGER_MODULES: readonly LoaderModule[] = [
  clickElement,
  exitIntent,
  scrollUp,
  queryParam,
  referrer,
  adBlocking,
];

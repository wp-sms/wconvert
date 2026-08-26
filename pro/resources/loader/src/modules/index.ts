import type { LoaderModule } from '@loader/types';
import { cartHasItems, cartValueMin } from './cart';
import { clickElement } from './click-element';
import { exitIntent } from './exit-intent';
import { queryParam } from './query-param';
import { scrollUp } from './scroll-up';

/**
 * Pro's loader modules.
 *
 * Premium rule types live here, and only here. Free's tree never imports this
 * file, and nothing under free's tree may — that is the invariant
 * `bin/verify-source-contract.sh` proves without a build, on every pull
 * request (ADR 0029).
 *
 * `click_element` and `query_param` are the two the builder needs a general
 * form for: a Trigger whose param is author-only, and the Condition the
 * campaign presets are shortcuts over (ADR 0005).
 *
 * `exit_intent` and `scroll_up` are the first two premium rules that are
 * premium for their own sake (#32). They are two entries here rather than one,
 * and `scroll-up.ts` is where that is argued.
 *
 * `cart_has_items` and `cart_value_min` are the first two rules premium for a
 * reason that is not packaging at all (#36): the cart [[Goal]]'s copy ASSERTS
 * what they guarantee, so a free tier able to drop them would ship a popup
 * that lies (ADR 0026). They are also the first to depend on something the
 * SITE supplies rather than on a tier, which is why they are registered only
 * where there is a store — see `ProServiceProvider::boot()`.
 */
export const PRO_MODULES: readonly LoaderModule[] = [
  clickElement,
  exitIntent,
  scrollUp,
  queryParam,
  cartHasItems,
  cartValueMin,
];

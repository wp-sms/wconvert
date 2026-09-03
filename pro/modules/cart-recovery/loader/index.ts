import type { LoaderModule } from '@loader/types';
import { cartHasItems, cartValueMin } from './cart';

/**
 * The `cart-recovery` module's loader half.
 *
 * `cart_has_items` and `cart_value_min` are the first two rules premium for a
 * reason that is not packaging at all (#36): the cart [[Goal]]'s copy ASSERTS
 * what they guarantee, so a tier able to drop them would ship a popup that
 * lies (ADR 0026). They are also the first to depend on something the SITE
 * supplies rather than on a tier, which is why they are registered only where
 * there is a store — see `ProServiceProvider::boot()`.
 *
 * **This module is the one place both halves of that guarantee live.** The
 * cookie these two read is written by `src/CartCookie.php` in this same
 * directory, and the `recover_cart` [[Goal]] is declared at this module's tier
 * in free's own `Goal::tier()`. A build shipping the Goal without the
 * Conditions is the popup that lies; a build shipping the Conditions without
 * the cookie is two rules that answer `false` forever. The module is what makes
 * the three arrive together or not at all (ADR 0056).
 */
export const CART_MODULES: readonly LoaderModule[] = [cartHasItems, cartValueMin];

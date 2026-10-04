import type { LoaderModule } from '@loader/types';
import { createCartEvaluator } from './bridge';
/** Synchronous predicates over prepared cart facts; unknown never matches. */
export const CART_MODULES: readonly LoaderModule[] = /* @__PURE__ */ ['cart_has_items', 'cart_value_min', 'cart_products', 'cart_categories', 'cart_quantity', 'cart_amount'].map(id => ({
  id, kind: 'condition', consentCategory: 'functional', create: createCartEvaluator,
}));

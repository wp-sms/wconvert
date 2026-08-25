import type { LoaderModule } from '../types';

/**
 * `page_load` — shows immediately.
 *
 * It is an explicit Trigger and not an empty trigger list, which is the whole
 * reason it exists: "every Optin has at least one; 'shows immediately' is the
 * explicit `page_load` Trigger, never an empty list" (CONTEXT.md, Trigger).
 * An empty list would make "fires at once" and "can never fire" the same
 * value, and ADR 0012's dropped-premium-trigger bug indistinguishable from a
 * working Optin.
 */
export const pageLoad: LoaderModule = {
  id: 'page_load',
  kind: 'trigger',
  consentCategory: null,
  create: () => ({ holds: () => true }),
};

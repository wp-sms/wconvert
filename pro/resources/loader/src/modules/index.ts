import type { LoaderModule } from '@loader/types';

/**
 * Pro's loader modules.
 *
 * `exit_intent`, `scroll_up` and the advanced Conditions land here,
 * and only here. Free's tree never imports this file, and nothing under free's
 * tree may — that is the invariant `bin/verify-source-contract.sh` proves
 * without a build, on every pull request (ADR 0029).
 */
export const PRO_MODULES: readonly LoaderModule[] = [];

import type { LoaderModule } from '../types';

/**
 * Free's loader modules.
 *
 * The list is empty because free has no rule implementations yet, not because
 * free has nowhere to put them. The directory and the export exist from day one
 * so that the free/Pro boundary is drawn before there is anything to put on
 * either side of it — which is precisely the cost ADR 0028 chose to pay up
 * front rather than defer behind a mode flag.
 */
export const FREE_MODULES: readonly LoaderModule[] = [];

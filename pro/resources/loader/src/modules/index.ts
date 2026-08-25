import type { LoaderModule } from '@loader/types';
import { clickElement } from './click-element';
import { queryParam } from './query-param';

/**
 * Pro's loader modules.
 *
 * `exit_intent`, `scroll_up` and the rest of the advanced Conditions land
 * here, and only here. Free's tree never imports this file, and nothing under
 * free's tree may — that is the invariant `bin/verify-source-contract.sh`
 * proves without a build, on every pull request (ADR 0029).
 *
 * The two that are here are the two the builder needs a general form for: a
 * Trigger whose param is author-only, and the Condition the campaign presets
 * are shortcuts over (ADR 0005).
 */
export const PRO_MODULES: readonly LoaderModule[] = [clickElement, queryParam];

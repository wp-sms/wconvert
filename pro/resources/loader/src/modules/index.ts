import type { LoaderModule } from '@loader/types';
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
 * premium for their own sake (#32), and they are **two types rather than one
 * with two meanings** — see the header of `scroll-up.ts` for why that is the
 * mistake worth naming.
 */
export const PRO_MODULES: readonly LoaderModule[] = [clickElement, exitIntent, scrollUp, queryParam];

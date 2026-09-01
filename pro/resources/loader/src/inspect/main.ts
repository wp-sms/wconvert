import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import { runInspector } from '@loader/inspect/run';
import { PRO_MODULES } from '../modules';

/**
 * Pro's inspector entry — free's modules plus Pro's, exactly as Pro's loader
 * composes them.
 *
 * ============================================================================
 * THIS IS NOT OPTIONAL, AND SHIPPING WITHOUT IT WOULD BE WORSE THAN SHIPPING
 * NO INSPECTOR AT ALL.
 * ============================================================================
 * Pro replaces free's loader by dequeuing it (ADR 0014). Without a matching
 * replacement here, a Pro install would run **Pro's loader beside free's
 * inspector** — and free's inspector has no `exit_intent` module, so every
 * exit-intent Optin on the site would be reported as `inert`: *"it has no
 * trigger this site can fire, so it can never show"*, about an Optin that is
 * working perfectly.
 *
 * A diagnostic that is confidently wrong is worse than none, because the
 * merchant acts on it. `tests/js/inspector-parity.test.ts` is what stops the
 * two entries drifting.
 *
 * The composition is deliberately spelled the same way as
 * `pro/resources/loader/src/main.ts`: free's modules first, then Pro's, so a
 * duplicate id fails at composition rather than resolving by array order.
 */
const loader = createLoader([...FREE_MODULES, ...PRO_MODULES]);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => runInspector(loader), { once: true });
} else {
  runInspector(loader);
}

export default loader;

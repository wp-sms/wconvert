import { createLoader } from '../engine';
import { FREE_MODULES } from '../modules';
import { runInspector } from './run';

/**
 * Free's inspector entry.
 *
 * ============================================================================
 * THE SAME MODULE SET AS FREE'S LOADER, AND THE SAME `decide()`.
 * ============================================================================
 * The whole value of this screen is that it reports the decision the page
 * actually took. Composing a different module set here would produce a panel
 * that confidently explains a different engine — so this imports exactly what
 * `main.ts` imports, and `explain.ts` calls the real `decide` rather than a
 * copy of it.
 *
 * That is also why **Pro ships its own entry** (`pro/resources/loader/src/inspect/main.ts`):
 * a Pro install running Pro's loader beside free's inspector would report
 * every `exit_intent` Optin as `inert` while it worked perfectly, which is the
 * worst possible failure in a diagnostic.
 *
 * **The DOM is not read at module scope.** Same rule as the loader's entry
 * (ADR 0004): composition is pure, and everything that touches the page waits
 * until the document is ready — an optimiser may have moved this script above
 * the tags it reads.
 */
const loader = createLoader(FREE_MODULES);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => runInspector(loader), { once: true });
} else {
  runInspector(loader);
}

export default loader;

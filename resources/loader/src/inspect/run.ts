import { createPanel } from './panel';
import { explain } from './explain';
import { funnel } from './report';
import { readArrival } from './arrival';
import { readPayload } from '../payload';
import { withheldTypes } from '../consent';
import { onConsentChange } from '../consent';
import { persistentStore } from '../storage';
import { STATE_KEY, dayOf, loadState } from '../state';
import { rulesOf } from '../decide';
import type { Loader, RuleEvaluator } from '../types';
import type { ServerReport } from './report';

/**
 * The inspector, composed and run — shared by free's entry and Pro's.
 *
 * ============================================================================
 * IT RUNS BESIDE THE REAL LOADER, WHICH IS UNAWARE OF IT.
 * ============================================================================
 * The merchant watches the popup actually fire while reading why. That is the
 * whole design: the context is not *equivalent to* the served one, it **is**
 * it — a `RequestContext` cannot be built from a URL and must not be faked
 * (see `WConvert\Frontend\InspectorEnqueue`).
 *
 * **Its evaluators are its own.** Two scroll listeners and two timers on one
 * page, and that is the right trade: sharing them would mean the diagnostic
 * could perturb the thing it is diagnosing, and the loader has no seam for a
 * second reader anyway. Both sets start at page load, so what they observe
 * agrees.
 *
 * **The decision is asked fresh, as this page view began** — `shown` empty and
 * `overlayDone` false. The engine's own copies of those are per-page-view
 * in-memory state the inspector cannot see, and the question a merchant is
 * asking is "why didn't it show", which is a question about the start of the
 * page view. The allowance is re-read from storage on every pass, so an
 * impression the real loader has just recorded IS reflected.
 */
const INSPECTOR_ELEMENT_ID = 'wconvert-inspector';

export function runInspector(loader: Loader): void {
  const server = readServerReport();

  if (server === null) {
    return;
  }

  const entries = readPayload() ?? [];
  const reached = new Set(entries.map((entry) => entry.id));
  const arrival = readArrival();
  const panel = createPanel(server.labels);

  const store = persistentStore(STATE_KEY);
  const evaluators = new Map<string, RuleEvaluator>();
  const inPlay = new Set(entries.flatMap((entry) => rulesOf(entry).map((rule) => rule.type)));

  let withheld = withheldTypes(loader.modules);

  function attach(): void {
    for (const module of loader.modules) {
      if (!inPlay.has(module.id) || withheld.has(module.id) || evaluators.has(module.id)) {
        continue;
      }

      try {
        evaluators.set(module.id, module.create(render));
      } catch {
        // A module that cannot attach leaves no evaluator, and the panel
        // reports its rules as having no module on this site — which is what
        // the page itself will do with them.
      }
    }
  }

  function render(): void {
    const report = explain({
      entries,
      evaluators,
      withheld,
      // Re-read every pass: the REAL loader writes impressions and dismissals
      // into this same store, so a merchant who watches their popup show and
      // then closes it sees the allowance change under the panel.
      state: loadState(store),
      day: dayOf(Date.now()),
      shown: new Set(),
      overlayDone: false,
    });

    panel.render(funnel(server as ServerReport, report.entries, reached, arrival));
  }

  onConsentChange(() => {
    withheld = withheldTypes(loader.modules);
    attach();
    render();
  });

  attach();
  render();
}

/**
 * The server's half of the report.
 *
 * Null where the tag is absent, which on this URL means the gate refused —
 * and the honest response to that is to draw nothing at all rather than a
 * panel with no content. A subscriber who guessed the parameter gets an inert
 * script and no report, which is the same thing they would get from a bundle
 * that was never enqueued.
 */
function readServerReport(): ServerReport | null {
  const element = document.getElementById(INSPECTOR_ELEMENT_ID);

  if (element === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(element.textContent ?? '');

    return typeof parsed === 'object' && parsed !== null ? (parsed as ServerReport) : null;
  } catch {
    return null;
  }
}

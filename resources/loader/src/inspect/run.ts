import { createPanel } from './panel';
import { explain } from './explain';
import { funnel } from './report';
import { readArrival } from './arrival';
import { readPayload, siteAllowance } from '../payload';
import { withheldTypes } from '../consent';
import { onConsentChange } from '../consent';
import { persistentStore } from '../storage';
import { STATE_KEY, dayOf, loadState } from '../state';
import { rulesOf } from '../decide';
import type { Loader, RuleEvaluator, VisitorState } from '../types';
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
 * ============================================================================
 * THE WHOLE PANEL ANSWERS ONE QUESTION: *AS THIS PAGE VIEW BEGAN*.
 * ============================================================================
 * `shown` is empty, `overlayDone` is false, and **the visitor's state is read
 * ONCE, here, at module scope** — before anything else has had a chance to
 * move it.
 *
 * That last part is a correctness fix rather than an optimisation, and it was
 * found on a real page. Re-reading the allowance on every render meant the
 * panel reported an Optin with `maxImpressions: 1` as *"this browser has
 * already had its allowance"* **while it was on screen**, because the loader
 * had recorded that very impression a moment earlier. True about the next page
 * view; exactly backwards as an answer to "why didn't it show".
 *
 * Module scope is deliberate and is not the thing ADR 0004 forbids. That rule
 * is about reading the PAYLOAD ELEMENT before the document is ready, because
 * an optimiser may have moved this script above it — a position-dependent
 * read. `localStorage` has no position. `InspectorEnqueue` enqueues this
 * bundle BEFORE the loader for the same reason, so the snapshot is taken
 * before the loader's own `boot()` can write to it.
 */
const AT_THE_START: VisitorState = loadState(persistentStore(STATE_KEY));

const INSPECTOR_ELEMENT_ID = 'wconvert-inspector';

export function runInspector(loader: Loader): void {
  const server = readServerReport();

  if (server === null) {
    return;
  }

  const entries = readPayload() ?? [];
  const reached = new Set(entries.map((entry) => entry.id));
  // Read off the page the loader read it off, so the panel explains the
  // allowance the page is actually being decided against.
  const siteFrequency = siteAllowance();
  const arrival = readArrival();
  const panel = createPanel(server.labels);

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
    // One reading, two precisions — the same arrangement `shell.ts` makes, so
    // the panel and the page cannot disagree about what time it is.
    const instant = Date.now();

    const report = explain({
      entries,
      evaluators,
      withheld,
      // The snapshot, not a fresh read. See the docblock: re-reading it is
      // what made the panel report a showing Optin as capped.
      state: AT_THE_START,
      siteFrequency,
      day: dayOf(instant),
      now: instant,
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

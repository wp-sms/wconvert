import type { Loader, PayloadEntry, Presenter, RuleEvaluator, VisitorState } from './types';
import type { Store } from './storage';
import type { Beacon } from './beacon';
import { createBeacon, reporting } from './beacon';
import { beaconEndpoint } from './payload';
import { decide, isOverlay, rulesOf } from './decide';
import { onConsentChange, withheldTypes } from './consent';
import { persistentStore } from './storage';
import { STATE_KEY, dayOf, loadState, saveState, withConversion, withDismissal, withImpression } from './state';

/**
 * The shell: everything impure, in one place.
 *
 * It owns the listeners, the store and the clock; `decide` owns the answer.
 * The loop is: some signal moved, ask again, act on what comes back.
 *
 * **Lazy subscription.** Only modules whose rule type actually appears in this
 * page's payload are instantiated, so the scroll listener and the timer are
 * dead weight nobody pays for on a page whose Optins do not need them
 * (issue #3).
 *
 * **Teardown when nothing is live.** Once every candidate is settled — shown,
 * or capped — no later signal can change the answer, so every listener comes
 * off. On a page with one `page_load` Optin that is immediately.
 */

export interface ShellOptions {
  readonly loader: Loader;
  readonly entries: readonly PayloadEntry[];
  readonly presenter: Presenter;
  /** Wall-clock, used only to derive the day a record is stamped with. */
  readonly now?: () => number;
  readonly store?: Store;
  /**
   * Where the three acts are reported to the site.
   *
   * Defaulted rather than required, because `boot` starts the shell with what
   * it read off the page and nothing else — and a page carrying no beacon
   * endpoint gets one that reports nothing, not a shell that will not start.
   */
  readonly beacon?: Beacon;
}

/** Every rule type this page's payload actually names, across both axes. */
function typesInPlay(entries: readonly PayloadEntry[]): ReadonlySet<string> {
  const types = new Set<string>();

  for (const entry of entries) {
    for (const rule of rulesOf(entry)) {
      types.add(rule.type);
    }
  }

  return types;
}

export function start(options: ShellOptions): () => void {
  const { loader, entries, presenter } = options;
  const now = options.now ?? Date.now;
  const store = options.store ?? persistentStore(STATE_KEY);
  const beacon = options.beacon ?? createBeacon(beaconEndpoint());

  const evaluators = new Map<string, RuleEvaluator>();
  const shown = new Set<string>();

  let state: VisitorState = loadState(store);
  let withheld = withheldTypes(loader.modules);
  let overlayDone = false;
  let stopped = false;
  let deciding = false;

  const inPlay = typesInPlay(entries);

  /**
   * Instantiate the modules this page needs and this visitor allows.
   *
   * Called again when consent arrives, which is what lets an Optin blocked on
   * a category fire later in the SAME page view rather than on the next one
   * (issue #11).
   */
  function attach(): void {
    for (const module of loader.modules) {
      if (!inPlay.has(module.id) || withheld.has(module.id) || evaluators.has(module.id)) {
        continue;
      }

      try {
        evaluators.set(module.id, module.create(run));
      } catch {
        // A module that cannot attach leaves no evaluator, so its rules fail
        // shut in `decide` — one rule type lost rather than the whole page.
      }
    }
  }

  function record(change: (state: VisitorState) => VisitorState): void {
    state = change(state);
    saveState(store, state);
  }

  function run(): void {
    // Showing an Optin can record a dismissal synchronously, which asks for a
    // decision from inside one. Re-entering would re-answer against a
    // half-applied page view; the outer call is about to ask again anyway.
    if (stopped || deciding) {
      return;
    }

    deciding = true;

    try {
      const verdict = decide({
        entries,
        evaluators,
        withheld,
        state,
        day: dayOf(now()),
        shown,
        overlayDone,
      });

      for (const entry of verdict.show) {
        // Both of these are settled by the DECISION, not by what the presenter
        // does with it. `overlayDone` in particular is set on show and never on
        // dismissal, which is what makes "no runner-up after a dismissal"
        // structurally impossible rather than a setting someone can
        // misconfigure (issue #3).
        shown.add(entry.id);
        overlayDone = overlayDone || isOverlay(entry);

        // **Two records, one act.** The device's own record answers "should
        // this Optin show again here", and the site's counters answer "how is
        // this Optin doing" — neither is derivable from the other, and the
        // first is `functional` storage while the second is no storage on the
        // device at all (ADR 0017). Wrapping rather than calling the beacon
        // inline keeps the shell's three callbacks about the state they own.
        presenter.show(entry, reporting(beacon, entry.id, {
          // The Impression is the presenter's to report, because it has two
          // moments and only a renderer can tell them apart — shown, for an
          // overlay; entered the viewport, for `inline` (CONTEXT.md).
          impression: () => record((current) => withImpression(current, entry.id, dayOf(now()))),
          dismiss: () => {
            record((current) => withDismissal(current, entry.id));
            run();
          },
          convert: () => {
            record((current) => withConversion(current, entry.id));
            run();
          },
        }));
      }

      if (!verdict.live) {
        stop();
      }
    } finally {
      deciding = false;
    }
  }

  function stop(): void {
    stopped = true;
    releaseConsent();

    // The beacon OUTLIVES this. Teardown happens the moment every candidate is
    // settled — on a page with one `page_load` Optin that is immediately — and
    // the Conversion and the Dismissal have not happened yet at that point.
    // What comes off here is the rule listeners; the beacon keeps its
    // `pagehide` listener until the page goes away, which is the whole of its
    // job.

    for (const evaluator of evaluators.values()) {
      evaluator.stop?.();
    }

    evaluators.clear();
  }

  const releaseConsent = onConsentChange(() => {
    withheld = withheldTypes(loader.modules);
    attach();
    run();
  });

  attach();
  run();

  return stop;
}

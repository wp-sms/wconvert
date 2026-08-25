import type { Loader, PayloadEntry, Presenter, RuleEvaluator, VisitorState } from './types';
import type { Store } from './storage';
import { decide } from './decide';
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
}

/** Every rule type this page's payload actually names, across both axes. */
function typesInPlay(entries: readonly PayloadEntry[]): ReadonlySet<string> {
  const types = new Set<string>();

  for (const entry of entries) {
    for (const rule of [...(entry.triggers ?? []), ...(entry.conditions ?? [])]) {
      types.add(rule.type);
    }
  }

  return types;
}

export function start(options: ShellOptions): () => void {
  const { loader, entries, presenter } = options;
  const now = options.now ?? Date.now;
  const store = options.store ?? persistentStore(STATE_KEY);

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
        shown.add(entry.id);

        // Set on SHOW, not on dismissal — which is what makes "no runner-up
        // after a dismissal" structurally impossible rather than a setting
        // someone can misconfigure (issue #3).
        overlayDone = overlayDone || entry.display_type !== 'inline';

        // CONTEXT.md counts an Impression at the moment an overlay is shown
        // and at the moment an `inline` enters the viewport. Only a renderer
        // can observe the second, so the refinement lands with the renderer;
        // here, deciding to show is the moment.
        record((current) => withImpression(current, entry.id, dayOf(now())));

        presenter.show(entry, {
          dismiss: () => {
            record((current) => withDismissal(current, entry.id));
            run();
          },
          convert: () => {
            record((current) => withConversion(current, entry.id));
            run();
          },
        });
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

import type { Frequency, Loader, PayloadEntry, Presenter, PresentationSession, RuleEvaluator, VisitorState } from './types';
import type { Store } from './storage';
import type { Beacon } from './beacon';
import { createBeacon, reporting } from './beacon';
import { beaconEndpoint, siteAllowance } from './payload';
import { decide, isOverlay, rulesOf } from './decide';
import { onConsentChange, withheldTypes } from './consent';
import { sessionCounts } from './session-counts';
import { persistentStore } from './storage';
import {
  SITE_SLOT,
  STATE_KEY,
  dayOf,
  loadState,
  saveState,
  withConversion,
  withDismissal,
  withImpression,
} from './state';

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
  /**
   * Wall-clock. Read ONCE per decision, and used for two things at two
   * precisions: the day a record is stamped with, and the instant a schedule
   * is compared against ({@see Decision}).
   */
  readonly now?: () => number;
  readonly store?: Store;
  /**
   * The allowance the whole site shares, or **undefined where there is none**.
   *
   * Defaulted off the page for the reason {@link beacon} is: `boot` starts the
   * shell with what it read off the payload tag and nothing else. A site that
   * has configured nothing prints no attribute, so this stays undefined, no
   * site record is ever written, and the page behaves exactly as it does today
   * (ADR 0047).
   */
  readonly siteFrequency?: Frequency;
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
function typesInPlay(entries: readonly PayloadEntry[]): Set<string> {
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
  const siteFrequency = options.siteFrequency ?? siteAllowance();
  const beacon = options.beacon ?? createBeacon(beaconEndpoint());

  /**
   * Which records one act touches: the Optin's own, and the site's **only
   * where the site has an allowance to spend**.
   *
   * That condition is the defaults-off case made structural. All four fields
   * are off at site scope until a merchant asks for one, so an install that
   * has asked for nothing writes exactly the bytes it writes today rather than
   * filling a slot nothing reads (ADR 0047).
   */
  const scopesOf = (id: string): readonly string[] =>
    siteFrequency === undefined ? [id] : [id, SITE_SLOT];

  const evaluators = new Map<string, RuleEvaluator>();
  const shown = new Set<string>();

  let state: VisitorState = loadState(store);
  let withheld = withheldTypes(loader.modules);
  let overlayDone = false;
  let activeOverlay: string | undefined;
  const pacing = sessionCounts();
  let wake: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let deciding = false;

  const session: PresentationSession = presenter.connect?.({ entries, changed: () => {
    state = loadState(store);
    run();
  } }) ?? presenter;

  /**
   * Instantiate the modules this page needs and this visitor allows.
   *
   * Called again when consent arrives, which is what lets an Optin blocked on
   * a category fire later in the SAME page view rather than on the next one
   * (issue #11).
   */
  function attach(): void {
    const inPlay = typesInPlay(entries.filter(entry => entry.display_rules?.opening.mode === 'click' || (!shown.has(entry.id) && (!overlayDone || !isOverlay(entry)))));
    for (const rule of session.watch?.() ?? []) inPlay.add(rule.type);
    for (const [type, evaluator] of evaluators) {
      if (!inPlay.has(type) || withheld.has(type)) { evaluator.stop?.(); evaluators.delete(type); }
    }
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
    state = change(loadState(store));
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
      // One reading, two precisions. Asking the clock twice would let a
      // decision straddle midnight — the day from before it and the instant
      // from after — which is one of those bugs that happens once a night.
      const instant = now();

      const verdict = (session.decide ?? decide)({
        entries,
        evaluators,
        withheld,
        state,
        siteFrequency,
        day: dayOf(instant),
        now: instant,
        shown,
        overlayDone,
        activeOverlay: session.activeOverlay ? session.activeOverlay() : activeOverlay,
        sessionCounts: pacing.read(),
        elapsedSeconds: performance.now() / 1000,
        visible: !document.hidden,
      });

      clearTimeout(wake);
      const deadlines = entries.flatMap(entry => [entry.starts_at, entry.ends_at].filter((at): at is number => at !== undefined && at > instant));
      const dwell = entries.flatMap(entry => entry.display_rules?.opening.mode === 'automatic' && (entry.display_rules.opening.minimum_seconds ?? 0) * 1000 > performance.now()
        ? [instant + entry.display_rules.opening.minimum_seconds! * 1000 - performance.now()] : []);
      const next = Math.min(...deadlines, ...dwell);
      if (Number.isFinite(next)) wake = setTimeout(run, Math.min(Math.max(1, next - instant), 2147483647));
      let failed = false;
      for (const entry of session.select?.(verdict.show) ?? verdict.show) {
        // Both of these are settled by the DECISION, not by what the presenter
        // does with it. `overlayDone` in particular is set on show and never on
        // dismissal, which is what makes "no runner-up after a dismissal"
        // structurally impossible rather than a setting someone can
        // misconfigure (issue #3).
        shown.add(entry.id);

        // **Two records, one act.** The device's own record answers "should
        // this Optin show again here", and the site's counters answer "how is
        // this Optin doing" — neither is derivable from the other, and the
        // first is `functional` storage while the second is no storage on the
        // device at all (ADR 0017). Wrapping rather than calling the beacon
        // inline keeps the shell's three callbacks about the state they own.
        if (isOverlay(entry)) activeOverlay = entry.id;
        const accepted = session.show(entry, reporting(beacon, entry.id, {
          // The Impression is the presenter's to report, because it has two
          // moments and only a renderer can tell them apart — shown, for an
          // overlay; entered the viewport, for `inline` (CONTEXT.md).
          impression: () => {
            const day = dayOf(now());
            if (entry.frequency?.maxPerSession !== undefined) pacing.increment(entry.campaign ?? entry.id);

            record((current) =>
              scopesOf(entry.id).reduce((state, slot) => withImpression(state, slot, day), current),
            );
          },
          dismiss: () => {
            if (activeOverlay === entry.id) activeOverlay = undefined;
            record((current) => scopesOf(entry.id).reduce(withDismissal, current));
            run();
          },
          convert: () => {
            record((current) => scopesOf(entry.id).reduce(withConversion, current));
            run();
          },
        }, (entry.template?.tree.submissions.length ?? 0) > 0));
        if (accepted === false) { failed = true; if (activeOverlay === entry.id) activeOverlay = undefined; }
        else overlayDone = overlayDone || isOverlay(entry);
      }

      if (failed) {
        queueMicrotask(run);
      } else if (!verdict.live) {
        stop();
      } else {
        attach();
      }
    } finally {
      deciding = false;
    }
  }

  function stop(): void {
    stopped = true;
    releaseConsent();
    clearTimeout(wake);
    document.removeEventListener('visibilitychange', run);

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

  document.addEventListener('visibilitychange', run);
  attach();
  run();

  return () => { stop(); session.dispose?.(); };
}

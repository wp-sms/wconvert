import type { LoaderModule } from '../types';

/**
 * `time_on_page` — fires N seconds after NAVIGATION START.
 *
 * `performance.now()`, never a timestamp taken when this script executed. That
 * one line is the whole rule: delay-JS plugins run the loader seconds after
 * navigation, and a loader clocking from its own execution silently DOUBLES
 * every time-based rule — under a 5-second delay a "show after 5 seconds"
 * Optin fires at ten. Measured on Flying Scripts' default 5s fallback: from
 * navigation start it fired at 5,142 ms; from script start, nothing in a
 * 9-second window (ADR 0004). Not a crash — a wrong number nobody notices.
 */
const TICK_MS = 250;

export const timeOnPage: LoaderModule = {
  id: 'time_on_page',
  kind: 'trigger',
  consentCategory: null,
  create: (changed) => {
    // A poll rather than a timer per rule: the module is instantiated once for
    // however many Optins name this type, and does not know their thresholds.
    // It is torn down as soon as nothing on the page is still live.
    const tick = setInterval(changed, TICK_MS);

    return {
      holds: (rule) => performance.now() >= Number(rule.seconds) * 1000,
      stop: () => clearInterval(tick),
    };
  },
};

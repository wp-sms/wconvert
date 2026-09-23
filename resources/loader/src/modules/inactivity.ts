import type { LoaderModule } from '../types';

/** Visible-page time without observed input. No input values or event history. */
export const inactivity: LoaderModule = {
  id: 'inactivity', kind: 'trigger', consentCategory: null,
  create(changed) {
    let since = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const thresholds = new Set<number>();
    const elapsed = () => document.hidden ? 0 : performance.now() - since;
    const schedule = () => {
      clearTimeout(timer);
      timer = undefined;
      if (document.hidden) return;
      const next = Math.min(...[...thresholds].filter(ms => ms > elapsed()));
      if (Number.isFinite(next)) timer = setTimeout(() => { timer = undefined; changed(); schedule(); }, Math.max(1, next - elapsed()));
    };
    const reset = () => { since = performance.now(); if (document.hidden || timer === undefined) schedule(); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'click', 'scroll'];
    for (const name of events) window.addEventListener(name, reset, { passive: true, capture: true });
    document.addEventListener('visibilitychange', reset, true);
    return {
      holds(rule) {
        const ms = Number(rule.seconds) * 1000;
        if (!Number.isFinite(ms) || ms <= 0) return false;
        if (!thresholds.has(ms)) { thresholds.add(ms); schedule(); }
        return !document.hidden && elapsed() >= ms;
      },
      stop() {
        clearTimeout(timer);
        for (const name of events) window.removeEventListener(name, reset, true);
        document.removeEventListener('visibilitychange', reset, true);
      },
    };
  },
};

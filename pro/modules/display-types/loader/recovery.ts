import { decide, isOverlay, rulesOf, type Decision } from '@loader/decide';
import { isWithinWindow } from '@loader/schedule';
import { A_NARROW_DESIGN } from '@renderer/css';
import { SITE_SLOT } from '@loader/state';
import type { Presenter, PresentationSession } from '@loader/types';
import { familyOf, recoveryStore } from './recovery-state';
import { unpack, showReopen, type Recoverable, type ReopenView } from './reopen';

export function supportsRecovery(entry: Recoverable): boolean {
  return Boolean(entry.teaser?.label && entry.template && ['popup', 'slide_in'].includes(entry.display_type ?? 'popup'));
}

/** Same eligibility for live presentation and diagnostics. Pacing is automatic-only. */
export function recoveryBlock(entry: Recoverable, decision: Decision): string | null {
  if (!supportsRecovery(entry)) return 'configuration';
  if (!isWithinWindow(entry, decision.now)) return 'schedule';
  if (entry.frequency?.stopAfterConversion !== false && decision.state[entry.id]?.c === 1) return 'conversion';
  if (decision.siteFrequency && decision.siteFrequency.stopAfterConversion !== false && decision.state[SITE_SLOT]?.c === 1) return 'site_conversion';
  if (rulesOf(entry).some(rule => decision.withheld.has(rule.type))) return 'consent';
  return (entry.conditions ?? []).every(rule => {
    try { return decision.evaluators.get(rule.type)?.holds(rule) === true; } catch { return false; }
  }) ? null : 'condition';
}
export const recoveryAllowed = (entry: Recoverable, decision: Decision): boolean => recoveryBlock(entry, decision) === null;

export function connectRecovery(base: Presenter, entries: readonly Recoverable[], changed: () => void): PresentationSession {
  entries = entries.map(unpack);
  const store = recoveryStore();
  if (!entries.some(supportsRecovery) && !store.active) return base;
  // On a build without arm assignment, preserve the existing stable primary.
  entries = entries.filter(entry => !supportsRecovery(entry) || !entries.some(other => familyOf(other) === familyOf(entry) && other.id < entry.id));
  const media = matchMedia(`(max-width: ${A_NARROW_DESIGN})`);
  let current: Recoverable | undefined;
  let view: ReopenView | undefined;
  let latest: Decision;
  let restoring = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = () => entries.find(entry => entry.id === store.active?.[0]);
  const notify = () => { store.refresh(); changed(); };
  media.addEventListener('change', notify);
  window.addEventListener('pageshow', notify);
  window.addEventListener('storage', notify);
  return {
    select: base.select,
    decide(input) {
      latest = input;
      let candidate = active();
      if (candidate && (!supportsRecovery(candidate) || familyOf(candidate) !== store.active?.[1] || (candidate.ends_at !== undefined && candidate.ends_at <= input.now))) {
        store.clear(); candidate = undefined;
      }
      // A session record that names a now-unselected arm cannot become another arm.
      if (store.active && !candidate && entries.some(entry => familyOf(entry) === store.active?.[1])) store.clear();
      const automatic = entries.filter(entry => (!supportsRecovery(entry) || !store.stopped(entry)) && entry.id !== store.active?.[0]);
      const verdict = decide({ ...input, entries: automatic });
      view?.refresh();
      restoring = !input.overlayDone && candidate !== undefined && !input.shown.has(candidate.id) && !store.stopped(candidate) && (!media.matches || candidate.teaser?.mobile?.visible !== false) && recoveryAllowed(candidate, input);
      const watching = current ?? candidate ?? verdict.show.find(supportsRecovery);
      clearTimeout(timer);
      if (watching && !store.stopped(watching) && watching.ends_at !== undefined && watching.ends_at > input.now) timer = setTimeout(notify, Math.min(watching.ends_at - input.now, 2147483647));
      return {
        ...verdict,
        show: restoring ? [candidate!, ...verdict.show.filter(entry => !isOverlay(entry))] : verdict.show,
        live: verdict.live || Boolean(watching && !store.stopped(watching) && supportsRecovery(watching) && (watching.ends_at === undefined || watching.ends_at > input.now)),
      };
    },
    watch: () => (current ?? active())?.conditions ?? [],
    show(entry, controls) {
      if (!supportsRecovery(entry)) {
        let presented = false;
        try {
          const result = base.show(entry, { ...controls, impression() {
            presented = true;
            if (isOverlay(entry)) store.clear();
            controls.impression();
          } });
          return isOverlay(entry) ? presented : result;
        } catch { return false; }
      }
      const wasRestoring = restoring;
      let recovering = wasRestoring;
      const result = showReopen(entry, controls, {
        restoring: wasRestoring,
        allowed: () => { changed(); return (!recovering || store.active?.[0] === entry.id) && !store.stopped(entry) && recoveryAllowed(entry, latest); },
        minimized: () => { recovering = true; store.remember(entry); },
        stopped: () => { store.stop(entry); changed(); },
        opened: () => { if (!wasRestoring) store.clear(); },
      });
      if (result) { current = entry; view = result; }
      return result !== false;
    },
    dispose() {
      clearTimeout(timer); view?.dispose();
      media.removeEventListener('change', notify);
      window.removeEventListener('pageshow', notify);
      window.removeEventListener('storage', notify);
    },
  };
}

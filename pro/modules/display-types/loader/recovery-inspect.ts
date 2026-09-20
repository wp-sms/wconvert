import type { Decision } from '@loader/decide';
import { recoveryAllowed, supportsRecovery } from './recovery';
import { recoveryStore, familyOf } from './recovery-state';
import { unpack, type Recoverable } from './reopen';
import { A_NARROW_DESIGN } from '@renderer/css';

/** Administrator-only explanation; never imported by a visitor entry. */
export function recoveryExplanation(entry: Recoverable, decision: Decision): string | undefined {
  entry = unpack(entry);
  if (!entry.teaser) return undefined;
  if (!supportsRecovery(entry)) return 'Reopen button unavailable for this format or missing design.';
  const store = recoveryStore();
  const fallback = store.persistent ? '' : ' Session storage is unavailable; recovery lasts only on this page.';
  if (store.stopped(entry)) return 'Reopen button stopped for this tab session after dismissal or completion.' + fallback;
  if (!recoveryAllowed(entry, decision)) return 'Reopen button unavailable: check schedule, conditions, storage consent and campaign/site stop-after-completion settings.' + fallback;
  if (matchMedia(`(max-width: ${A_NARROW_DESIGN})`).matches && entry.teaser.mobile?.visible === false) return 'Reopen button hidden by the mobile visibility setting.' + fallback;
  if (store.active?.[0] === entry.id && store.active[1] === familyOf(entry)) return 'Recovery available: restore the reminder before automatic overlays. A visitor’s click bypasses automatic triggers, view limits, cooldown and dismissal settings.' + fallback;
  if (decision.overlayDone && !decision.shown.has(entry.id)) return 'Another overlay owns this page; the reopen button cannot claim its place.' + fallback;
  return 'Reopen button appears only after this Campaign is shown and deliberately dismissed.' + fallback;
}

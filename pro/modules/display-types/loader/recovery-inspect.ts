import type { Decision } from '@loader/decide';
import { recoveryBlock, supportsRecovery } from './recovery';
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
  const blocked = recoveryBlock(entry, decision);
  if (blocked) return ({
    configuration: 'Reopen button configuration is unavailable.',
    schedule: 'Reopen button hidden: Campaign is outside its schedule.',
    conversion: 'Reopen button stopped: this Campaign was completed.',
    site_conversion: 'Reopen button stopped by the site-wide completion setting.',
    consent: 'Reopen button hidden: required storage consent is withheld.',
    condition: 'Reopen button hidden: a required condition is false or unavailable.',
  }[blocked] ?? '') + fallback;
  if (matchMedia(`(max-width: ${A_NARROW_DESIGN})`).matches && entry.teaser.mobile?.visible === false) return 'Reopen button hidden by the mobile visibility setting.' + fallback;
  if (store.active?.[0] === entry.id && store.active[1] === familyOf(entry)) return 'Recovery available: restore the reminder before automatic overlays. A visitor’s click bypasses automatic triggers, view limits, cooldown and dismissal settings.' + fallback;
  if (decision.overlayDone && !decision.shown.has(entry.id)) return 'Another overlay owns this page; the reopen button cannot claim its place.' + fallback;
  return 'Reopen button appears only after this Campaign is shown and deliberately dismissed.' + fallback;
}

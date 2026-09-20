import { lockConfigured, lockRegion } from './index';
import type { PayloadEntry } from '@loader/types';

/** Read the region's real outcome; inspecting never grants or records access. */
export function contentLockExplanation(entry: PayloadEntry): string | undefined {
  if (!lockConfigured(entry)) return undefined;
  const region = lockRegion(entry);
  if (!region) return 'Content lock: no supported region on this page; content remains readable.';
  const states: Record<string, string> = {
    locked: 'Content lock active: the selected region will open after acknowledged form capture.',
    captured: 'Content unlocked after successful capture. Access is remembered for this Campaign in this browser for 30 days.',
    remembered: 'Content is readable because this browser remembers a successful unlock. No new conversion is recorded.',
    unavailable: 'Content stays readable: the Campaign was not eligible at initial page readiness.',
    invalid: 'Content stays readable: check nesting, active embeds, or an earlier manual anchor for the same Campaign.',
    another: 'Content stays readable: another content lock owns this page’s single locker slot.',
    fallback: 'Content stays readable because the gate is unavailable. This fallback does not count as a conversion.',
  };
  return states[region.dataset.wconvertLockState ?? ''] ?? 'Content lock is configured; verify the live region and capture on this page.';
}

import { lockConfigured, lockRegion } from './index';
import type { PayloadEntry } from '@loader/types';
import { inspectorLabel } from '@loader/inspect/labels';

/** The words, translated by `ProInspectorLabels` and read off the inspector's tag. */
const say = (key: string, english: string) => inspectorLabel('content_lock', key, english);

/** Read the region's real outcome; inspecting never grants or records access. */
export function contentLockExplanation(entry: PayloadEntry): string | undefined {
  if (!lockConfigured(entry)) return undefined;
  const region = lockRegion(entry);
  if (!region) return say('none', 'Content lock: no supported region on this page; content remains readable.');
  switch (region.dataset.wconvertLockState) {
    case 'locked': return say('locked', 'Content lock active: the selected region will open after acknowledged form capture.');
    case 'captured': return say('captured', 'Content unlocked after successful capture. Access is remembered for this Campaign in this browser for 30 days.');
    case 'remembered': return say('remembered', 'Content is readable because this browser remembers a successful unlock. No new conversion is recorded.');
    case 'unavailable': return say('unavailable', 'Content stays readable: the Campaign was not eligible at initial page readiness.');
    case 'invalid': return say('invalid', 'Content stays readable: check nesting, active embeds, or an earlier manual anchor for the same Campaign.');
    case 'another': return say('another', 'Content stays readable: another content lock owns this page’s single locker slot.');
    case 'fallback': return say('fallback', 'Content stays readable because the gate is unavailable. This fallback does not count as a conversion.');
    default: return say('configured', 'Content lock is configured; verify the live region and capture on this page.');
  }
}

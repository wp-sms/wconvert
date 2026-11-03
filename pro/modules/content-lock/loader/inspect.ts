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
    case 'captured': return say('captured', 'Unlocked after submission. This browser remembers this campaign’s unlock for 30 days.');
    case 'remembered': return say('remembered', 'Readable: this browser remembers an unlock. No new conversion is recorded.');
    case 'unavailable': return say('unavailable', 'Content stays readable: the Campaign was not eligible at initial page readiness.');
    case 'invalid': return say('invalid', 'Still readable: check nesting, active embeds, or this campaign’s earlier manual anchor.');
    case 'another': return say('another', 'Content stays readable: another content lock owns this page’s single locker slot.');
    case 'fallback': return say('fallback', 'Content stays readable: gate unavailable. Not counted as a conversion.');
    default: return say('configured', 'Content lock is set up. Test the live region and form here.');
  }
}

import { useCallback, useState } from 'react';
import { __ } from '@wordpress/i18n';

/**
 * **"Saved just now", beside the Save that did it** (GUIDELINES §8, ADR 0131).
 *
 * There is no toast and no "…saved." sentence at the top of a region, and no
 * permanent "No unsaved changes": the line appears after a save succeeds and
 * clears on the next edit, so it is only ever true. The live region is always
 * mounted, empty, so the arrival of the words is what a screen reader hears.
 */
export function SaveStatus({ saved }: { saved: boolean }) {
  return (
    <span role="status" className="text-note text-muted-foreground">
      {saved ? __('Saved just now', 'wconvert') : ''}
    </span>
  );
}

/** `markSaved()` after a successful save; `clear()` on the next edit. */
export function useSaveStatus() {
  const [saved, setSaved] = useState(false);
  const markSaved = useCallback(() => setSaved(true), []);
  const clear = useCallback(() => setSaved(false), []);
  return { saved, markSaved, clear };
}

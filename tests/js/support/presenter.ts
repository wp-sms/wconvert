import type { OptinControls, PayloadEntry, Presenter } from '@loader/types';

/**
 * A stand-in renderer, shared by every loader test.
 *
 * Shared rather than redefined per file because the two copies had already
 * drifted once: only one of them reported the Impression, so the same loader
 * spent a frequency allowance in one suite and not the other.
 *
 * It reports the Impression the moment it is shown, which is what a real
 * renderer does for an overlay — an `inline` one reports it on entering the
 * viewport instead (CONTEXT.md, Impression). {@link silentPresenter} is the
 * other side of that: shown, never reported.
 */
export interface RecordingPresenter extends Presenter {
  readonly shown: string[];
  dismiss(id: string): void;
  convert(id: string): void;
}

export function recordingPresenter(): RecordingPresenter {
  const shown: string[] = [];
  const controls = new Map<string, OptinControls>();

  return {
    shown,
    show(entry: PayloadEntry, entryControls: OptinControls) {
      shown.push(entry.id);
      controls.set(entry.id, entryControls);
      entryControls.impression();
    },
    dismiss(id) {
      controls.get(id)?.dismiss();
    },
    convert(id) {
      controls.get(id)?.convert();
    },
  };
}

/** A renderer that decided the Optin never actually reached the visitor. */
export function silentPresenter(): Presenter & { shown: string[] } {
  const shown: string[] = [];

  return { shown, show: (entry) => void shown.push(entry.id) };
}

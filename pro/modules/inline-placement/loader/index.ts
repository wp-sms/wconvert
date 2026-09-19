import type { LoaderModule, OptinControls, PayloadEntry, Presenter } from '@loader/types';

export const INLINE_PLACEMENT_MODULES: readonly LoaderModule[] = [];
const AUTO = 'data-wconvert-auto';
const ANCHOR = 'data-wconvert-optin';
type PlacementEntry = PayloadEntry & { inline_placement?: unknown };

const configured = (entry: PlacementEntry) => entry.display_type === 'inline' && entry.inline_placement != null;
const manual = (entry: PayloadEntry) => [...document.querySelectorAll(`[${ANCHOR}]:not([${AUTO}])`)]
  .some(node => node.getAttribute(ANCHOR) === (entry.anchor ?? entry.id));
const candidate = (entry: PayloadEntry) => [...document.querySelectorAll<HTMLElement>(`[${AUTO}]`)]
  .find(node => node.getAttribute(AUTO) === entry.id);

export function automaticPlacementState(entry: PayloadEntry): string | undefined {
  if (!configured(entry)) return undefined;
  return manual(entry) ? 'automatic_manual' : candidate(entry) ? 'automatic_ready' : 'automatic_missing';
}

/** Called after browser eligibility/A-B assignment, before rendering. Never preselect in PHP. */
export function selectAutomatic(ready: readonly PayloadEntry[]): readonly PayloadEntry[] {
  const isAutomatic = (entry: PayloadEntry) => configured(entry) && !manual(entry);
  const chosen = document.querySelector(`[${AUTO}][${ANCHOR}]`)?.getAttribute(AUTO);
  const winner = ready.filter(entry => isAutomatic(entry) && candidate(entry) && entry.template
      && (chosen == null || chosen === entry.id))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.id < b.id ? -1 : 1))[0];
  return ready.filter(entry => !isAutomatic(entry) || entry === winner);
}

/** Reuse Free's presenter; only Pro can turn an automatic placeholder into an anchor. */
export function showAutomatic(entry: PayloadEntry, controls: OptinControls, base: Presenter): void {
  if (!configured(entry) || manual(entry)) {
    base.show(entry, controls);
    return;
  }
  const target = candidate(entry);
  if (!target) return;
  target.setAttribute(ANCHOR, entry.anchor ?? entry.id);
  try {
    base.show(entry, controls);
  } finally {
    if (target.childElementCount > 0) {
      target.hidden = false;
    } else {
      target.removeAttribute(ANCHOR);
    }
  }
}

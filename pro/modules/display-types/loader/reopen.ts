import { PAYLOAD_ELEMENT_ID } from '@loader/payload';
import type { OptinControls, PayloadEntry } from '@loader/types';
import { mount } from '@renderer/mount';
import { captureInto } from '@loader/present';
import { mountPopover } from './popover';

import { reminder, type Teaser } from './reminder';

export function reminderLabels(): [string, string] {
  const fallback: [string, string] = ['Dismiss reminder', 'Submission received — View details'];
  try {
    const value: unknown = JSON.parse(document.getElementById(PAYLOAD_ELEMENT_ID)?.getAttribute('data-reopen') ?? 'null');
    return Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'string') ? value as [string, string] : fallback;
  } catch { return fallback; }
}

export type Recoverable = PayloadEntry & { teaser?: Teaser };
/** Decode the compact published representation at Pro's composition boundary. */
export function unpack(entry: Recoverable): Recoverable {
  if (!Array.isArray(entry.teaser)) return entry;
  const [label, placement, gap, background, color, mobile] = entry.teaser;
  const corners = ['block_start_inline_start', 'block_start_inline_end', 'block_end_inline_start', 'block_end_inline_end'];
  return { ...entry, teaser: { label, placement: corners[placement], gap: gap ?? undefined, background, color,
    ...(mobile ? { mobile: { visible: mobile[0] ?? undefined, placement: corners[mobile[1]], gap: mobile[2] ?? undefined } } : {}) } };
}
export interface ReopenView { refresh(): void; dispose(): void }
interface RecoveryOptions {
  restoring: boolean;
  allowed(): boolean;
  minimized(): void;
  stopped(): void;
  opened(): void;
}

/** A presentation of the same mounted form, not another campaign or form step. */
export function showReopen(entry: Recoverable, controls: OptinControls, recovery?: RecoveryOptions): ReopenView | false {
  if (!entry.template || !entry.teaser?.label) return false;
  let completed = false;
  let expanded = false;
  let removed = false;
  const seen = new Set<string>();
  const once = (kind: keyof OptinControls) => {
    if (!seen.has(kind)) { seen.add(kind); controls[kind](); }
  };
  const { host, button, close, media, layout, confirmation } = reminder(entry.teaser, entry.template.tokens, reminderLabels());
  let returnFocus: HTMLElement | null = null;
  const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const hide = () => { host.hidePopover?.(); host.remove(); };
  const remind = () => {
    if (removed || !layout() || (!completed && recovery?.allowed() === false)) return;
    document.body.appendChild(host);
    try { host.showPopover?.(); } catch { host.removeAttribute('popover'); }
  };
  const convert = () => {
    if (completed) return;
    completed = true; recovery?.stopped(); once('convert');
    if (!expanded && !removed) { button.textContent = confirmation; remind(); }
    else hide();
  };
  const mounted = (entry.display_type === 'slide_in' ? mountPopover : mount)({
    displayType: entry.display_type, placement: entry.placement, template: entry.template, endsAt: entry.ends_at,
    onDismiss: () => { expanded = false; if (completed) { removed = true; hide(); } else { recovery?.minimized(); once('dismiss'); remind(); if (returnFocus) button.focus(); } },
    onConvert: convert,
  });
  if (!mounted.mounted) return false;
  const open = () => {
    if (removed || !layout() || (!completed && recovery?.allowed() === false)) { hide(); return; }
    hide();
    try { mounted.show(); } catch { mounted.close(); return false; }
    expanded = true; once('impression');
    if (entry.display_type === 'slide_in') {
      const root = mounted.root;
      if (root) { root.tabIndex = -1; root.focus(); }
    }
    return true;
  };
  button.addEventListener('click', () => { returnFocus = button; open(); });
  const dismissReminder = () => {
    const focused = document.activeElement === host;
    removed = true; hide(); recovery?.stopped();
    if (focused && origin?.isConnected) origin.focus({ preventScroll: true });
  };
  close.addEventListener('click', dismissReminder);
  host.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); dismissReminder(); } });
  captureInto(mounted, entry.id, { impression: () => once('impression'), dismiss: () => once('dismiss'), convert });
  if (recovery?.restoring) { mounted.close(); remind(); }
  else {
    // Mobile visibility controls the reminder, never the initial campaign.
    try { mounted.show(); } catch { mounted.close(); return false; }
    expanded = true; once('impression'); recovery?.opened();
  }
  const refresh = () => {
    if (removed) return;
    if (completed) { if (!expanded) { hide(); remind(); } return; }
    if (recovery?.allowed() === false) { hide(); if (expanded) { expanded = false; mounted.close(); } }
    else if (!expanded) { hide(); remind(); }
  };
  media.addEventListener('change', refresh);
  return { refresh, dispose() { removed = true; hide(); mounted.close(); media.removeEventListener('change', refresh); } }; 
}

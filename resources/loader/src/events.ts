import type { PayloadEntry } from './types';

/** Public notifications carry identifiers, never submitted details or runtime objects. */
export function notifyCampaign(entry: PayloadEntry, kind: 'open' | 'close' | 'capture'): void {
  document.dispatchEvent(new CustomEvent(`wconvert:${kind}`, {
    detail: Object.freeze({
      campaignId: entry.campaign ?? entry.id,
      optinId: entry.id,
      displayType: entry.display_type ?? 'popup',
    }),
  }));
}

/** Only live presenters supply these callbacks; renderer previews stay silent. */
export function campaignLifecycle(entry: PayloadEntry) {
  return {
    onOpened: () => notifyCampaign(entry, 'open'),
    onClosed: () => notifyCampaign(entry, 'close'),
  };
}

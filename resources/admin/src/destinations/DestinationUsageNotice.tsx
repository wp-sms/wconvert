import { __ } from '@wordpress/i18n';
import type { DestinationUsage } from './api';

/**
 * Saved bindings only: the shared route is not part of any Optin's Undo. A
 * campaign with no name reads "Unnamed campaign", never its ID (ADR 0131).
 */
export function DestinationUsageNotice({ usage }: { usage: readonly DestinationUsage[] | null | undefined }) {
  return <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4 text-note leading-relaxed">
    <p className="m-0 font-medium">{__('Campaigns using this destination', 'wconvert')}</p>
    {usage == null ? <p className="m-0">{__('Couldn’t read which campaigns use it. Refresh before changing shared settings.', 'wconvert')}</p>
      : usage.length === 0 ? <p className="m-0">{__('No saved campaign uses it yet.', 'wconvert')}</p>
        : <ul className="m-0 list-none space-y-1 ps-0">
          {usage.map((optin) => <li key={optin.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 [overflow-wrap:anywhere]"><bdi>{optin.name.trim() === '' ? __('Unnamed campaign', 'wconvert') : optin.name}</bdi></span>
            <span className="text-muted-foreground">{optin.live && optin.draft ? __('Live and saved draft', 'wconvert')
              : optin.live ? __('Live only', 'wconvert') : __('Saved draft only', 'wconvert')}</span>
          </li>)}
        </ul>}
    {usage != null && usage.length > 0 && <p className="m-0 text-muted-foreground">{__('Saving affects live use immediately. Campaign Undo can’t reverse it.', 'wconvert')}</p>}
  </div>;
}

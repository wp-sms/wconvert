import { __ } from '@wordpress/i18n';
import type { DestinationUsage } from './api';

/** Saved bindings only: the shared route is not part of any Optin's Undo. */
export function DestinationUsageNotice({ usage }: { usage: readonly DestinationUsage[] | null | undefined }) {
  return <div className="rounded-md border border-border bg-muted/30 p-3 text-note">
    <p className="m-0 font-medium">{__('Optins using this destination', 'wconvert')}</p>
    {usage == null ? <p className="mb-0">{__('Saved usage could not be read. Refresh before changing shared settings.', 'wconvert')}</p>
      : usage.length === 0 ? <p className="mb-0">{__('No saved Optins currently select this destination.', 'wconvert')}</p>
        : <ul className="mb-0 mt-2 list-none space-y-1 ps-0">
          {usage.map((optin) => <li key={optin.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <span>{optin.name || optin.id}</span>
            <span className="text-muted-foreground">{optin.live && optin.draft ? __('Live and saved draft', 'wconvert')
              : optin.live ? __('Live only', 'wconvert') : __('Saved draft only', 'wconvert')}</span>
          </li>)}
        </ul>}
    <p className="mb-0 text-muted-foreground">{__('Based on saved versions; unsaved editor changes are not included. Saving these shared settings affects live use immediately. Optin Undo cannot reverse this save.', 'wconvert')}</p>
  </div>;
}

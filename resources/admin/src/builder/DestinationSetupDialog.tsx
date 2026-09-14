import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DestinationSettingsForm } from '../destinations/DestinationSettingsForm';
import { saveDestination, type Connection, type Destination, type DestinationType } from '../destinations/api';
import { renderingFor, tierProductName } from '../goals/availability';
import { iconFor } from '../icons';
import { messageOf } from '../shell/loadable';

/** The shared route can be configured without leaving the Optin's draft. */
export function DestinationSetupDialog({
  destination, types, connections, returnFocusTo, onClose, onSaved,
}: {
  destination?: Destination;
  types: readonly DestinationType[];
  connections: readonly Connection[];
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved: (destinations: readonly Destination[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(destination?.type ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const description = useId();
  const type = types.find((candidate) => candidate.id === selected);
  useEffect(() => { title.current?.focus(); }, [selected]);
  const close = () => { if (!busy) onClose(); };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-xl"
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}>
        <DialogHeader>
          <DialogTitle className="m-0" ref={title} tabIndex={-1}>
            {destination !== undefined ? sprintf(__('Edit %s', 'wconvert'), destination.label)
              : type === undefined ? __('Add a destination', 'wconvert')
              : sprintf(__('Add a %s destination', 'wconvert'), type.label)}
          </DialogTitle>
          <DialogDescription className="m-0" id={description}>
            {destination !== undefined
              ? __('These settings are shared across the site. Saving changes this destination for every Campaign that uses it, including published Campaigns.', 'wconvert')
              : __('Create a destination for this site, then select it for this Campaign. Your Campaign draft stays open.', 'wconvert')}
          </DialogDescription>
        </DialogHeader>

        {type === undefined ? (
          <ul className="m-0 list-none divide-y divide-border p-0" aria-label={__('Destination providers', 'wconvert')}>
            {types.map((candidate) => {
              const Icon = iconFor(candidate.icon);
              const rendering = renderingFor(candidate.availability, 'settings_list');
              return (
                <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="flex items-center gap-2 font-medium"><Icon aria-hidden="true" className="size-4" />{candidate.label}</span>
                  {rendering === 'offer' ? (
                    <Button variant="outline" size="sm" aria-label={sprintf(__('Choose %s', 'wconvert'), candidate.label)}
                      onClick={() => setSelected(candidate.id)}>{__('Choose', 'wconvert')}</Button>
                  ) : (
                    <span className="text-note text-muted-foreground">
                      {rendering === 'upsell'
                        ? sprintf(__('Included with %s.', 'wconvert'), tierProductName(candidate.tier))
                        : sprintf(__('Needs %s on this site.', 'wconvert'), candidate.requires_label ?? __('something this site does not have', 'wconvert'))}
                    </span>
                  )}
                </li>
              );
            })}
            {types.length === 0 && <li className="text-muted-foreground">{__('No destination providers are available on this site.', 'wconvert')}</li>}
          </ul>
        ) : (
          <>
            {destination === undefined && <Button variant="ghost" size="sm" className="justify-self-start" disabled={busy}
              onClick={() => { setSelected(null); setError(null); }}>
              <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Choose another provider', 'wconvert')}
            </Button>}
            <DestinationSettingsForm key={destination?.id ?? type.id} type={type} destination={destination}
              connections={connections.filter((connection) => connection.type === type.id)}
              busy={busy} error={error} submitDescription={description} onCancel={close}
              onConfirm={(draft) => {
                if (busy) return;
                setBusy(true);
                setError(null);
                saveDestination({ ...(destination === undefined ? {} : { id: destination.id }), type: type.id, ...draft })
                  .then((result) => { onSaved(result.destinations); onClose(); })
                  .catch((cause: unknown) => setError(messageOf(cause)))
                  .finally(() => setBusy(false));
              }} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

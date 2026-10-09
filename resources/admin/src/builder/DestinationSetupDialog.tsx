import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter } from '../components/ui/admin-dialog';
import { DialogDescription, DialogTitle } from '../components/ui/dialog';
import { DestinationSettingsForm } from '../destinations/DestinationSettingsForm';
import { saveDestination, type Connection, type Destination, type DestinationType } from '../destinations/api';
import { messageOf } from '../shell/loadable';
import { ProviderTiles } from './AddDestinationPicker';

/**
 * The shared route can be configured without leaving the campaign's draft.
 *
 * A Medium `AdminDialog` (ADR 0131). The provider list is the same
 * `ProviderTiles` the Add picker draws, and the settings form brings its own
 * body and footer, so it is a direct child of the content rather than wrapped.
 */
export function DestinationSetupDialog({
  destination, initialType, focusField, types, connections, returnFocusTo, onClose, onSaved, onConnectionSaved,
}: {
  destination?: Destination;
  /** Opens a new route's setup on this provider rather than on the provider list. */
  initialType?: string;
  /** A setting key (or `connection`) to focus instead of the title — where "Finish setup" was pressed. */
  focusField?: string;
  types: readonly DestinationType[];
  connections: readonly Connection[];
  returnFocusTo: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved: (destinations: readonly Destination[]) => void;
  onConnectionSaved?: (connection: Connection) => void;
}) {
  const [selected, setSelected] = useState<string | null>(destination?.type ?? initialType ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const description = useId();
  const type = types.find((candidate) => candidate.id === selected);
  useEffect(() => { if (focusField === undefined) title.current?.focus(); }, [selected, focusField]);
  const close = () => { if (!busy) onClose(); };

  return (
    <AdminDialog open onOpenChange={(open) => { if (!open) close(); }}>
      <AdminDialogContent size="md" dirty={dirty && !busy}
        showCloseButton={!busy}
        // The portal mounts after this component's effects, so the first
        // focus is taken here rather than in the effect below.
        onOpenAutoFocus={(event) => { if (focusField === undefined) { event.preventDefault(); title.current?.focus(); } }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}>
        {/* The header is drawn here rather than by `AdminDialogHeader` because its title takes focus. */}
        <div data-slot="dialog-header" className="wconvert-dialog__header">
          <div className="wconvert-dialog__identity">
            <DialogTitle className="wconvert-dialog__title leading-snug" ref={title} tabIndex={-1}>
              {destination !== undefined ? <bdi>{destination.label}</bdi>
                : type === undefined ? __('Add a destination', 'wconvert')
                : sprintf(__('New %s destination', 'wconvert'), type.label)}
            </DialogTitle>
          </div>
          <DialogDescription className="wconvert-dialog__meta" id={description}>
            {/*
              Editing says who else is affected in the usage notice below, so
              the description names the provider rather than saying it twice.
            */}
            {type?.needs_connection && !connections.some((account) => account.type === type.id)
              ? sprintf(__('Connect %s, then choose where submissions should go.', 'wconvert'), type.label)
              : destination !== undefined
              ? type?.label ?? __('Destination', 'wconvert')
              : __('It is selected for this campaign when you save.', 'wconvert')}
          </DialogDescription>
        </div>

        {type === undefined ? (
          <>
            <AdminDialogBody>
              <ProviderTiles types={types} rule={null} suggested={[]} onChoose={(candidate) => setSelected(candidate.id)} />
            </AdminDialogBody>
            <AdminDialogFooter back={<Button type="button" variant="outline" onClick={close}>{__('Cancel', 'wconvert')}</Button>} />
          </>
        ) : (
          <>
            <DestinationSettingsForm key={destination?.id ?? type.id} type={type} destination={destination} focusField={focusField}
              connections={connections.filter((connection) => connection.type === type.id)}
              onConnectionSaved={onConnectionSaved}
              busy={busy} error={error} submitDescription={description} onCancel={close} onDirtyChange={setDirty}
              back={destination === undefined && initialType === undefined ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => { setSelected(null); setError(null); }}>
                  <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back', 'wconvert')}
                </Button>
              ) : undefined}
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
      </AdminDialogContent>
    </AdminDialog>
  );
}

import { useId, useState, type RefObject } from 'react';
import { __ } from '@wordpress/i18n';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ProviderMark } from '../destinations/ProviderMark';
import { ProviderTiles, channelRefusal, channels, type ChannelRule } from '../destinations/ProviderTiles';
import { destinationStatus, setupProblems } from '../destinations/status';
import { targetShown } from '../destinations/settings';
import type { Connection, Destination, DestinationType } from '../destinations/api';

// The provider tiles moved beside the routes, so the Settings bundle can use
// them without reaching into this lazy chunk; re-exported for the editor.
export { ProviderTiles, channelRefusal, providerRefusal, type ChannelRule } from '../destinations/ProviderTiles';

/**
 * Adds one route to this save point: a site route in one click, or a new one
 * through setup. Rows that cannot be added stay listed with the reason.
 */
export function AddDestinationPicker({
  destinations, types, connections, bound, rule, suggested, description, returnFocusTo, onPick, onCreate, onClose,
}: {
  destinations: readonly Destination[];
  connections: readonly Connection[];
  types: readonly DestinationType[];
  bound: readonly string[];
  rule: ChannelRule | null;
  suggested: readonly string[];
  description: string;
  returnFocusTo: RefObject<HTMLElement | null>;
  onPick: (id: string) => void;
  onCreate: (type: DestinationType) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const typeOf = (destination: Destination) => types.find((type) => type.id === destination.type);
  const matches = (...words: (string | null | undefined)[]) => needle === '' || words.some((word) => word?.toLocaleLowerCase().includes(needle));
  const routes = destinations.filter((destination) => matches(destination.label, typeOf(destination)?.label, destination.target));
  const providers = types.filter((type) => matches(type.label));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-xl"
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusTo.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle className="m-0">{__('Add a destination', 'wconvert')}</DialogTitle>
          <DialogDescription className="m-0">{description}</DialogDescription>
        </DialogHeader>
        <Input type="search" aria-label={__('Search destinations', 'wconvert')} placeholder={__('Search destinations', 'wconvert')}
          value={query} onChange={(event) => setQuery(event.target.value)} />
        {destinations.length > 0 && <section className="flex flex-col gap-2" aria-labelledby={`${id}-yours`}>
          <h3 id={`${id}-yours`} className="wconvert-picker-label">{__('Your destinations', 'wconvert')}</h3>
          {routes.length === 0 ? <p className="m-0 text-note text-muted-foreground">{__('No destinations match.', 'wconvert')}</p>
            : <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {routes.map((destination) => {
                const type = typeOf(destination);
                const why = bound.includes(destination.id) ? __('Already sending.', 'wconvert')
                  : channelRefusal(channels(destination.requirements), rule);
                const target = targetShown(destination.target);
                return (
                  <li key={destination.id}>
                    <button type="button" className="wconvert-picker-row" aria-disabled={why === null ? undefined : true}
                      aria-describedby={`${id}-${destination.id}`}
                      onClick={() => { if (why === null) onPick(destination.id); }}>
                      <ProviderMark type={type} className="size-5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-medium [overflow-wrap:anywhere]">{destination.label}</span>
                        <span id={`${id}-${destination.id}`} className="block text-note text-muted-foreground">
                          {[type?.label, target, why].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {why === null && destinationStatus(destination, type, setupProblems(destination, type, connections)).badge}
                    </button>
                  </li>
                );
              })}
            </ul>}
        </section>}
        <section className="flex flex-col gap-2" aria-labelledby={`${id}-new`}>
          <h3 id={`${id}-new`} className="wconvert-picker-label">{__('Set up a new one', 'wconvert')}</h3>
          {providers.length === 0 && needle !== '' ? <p className="m-0 text-note text-muted-foreground">{__('No providers match.', 'wconvert')}</p>
            : <ProviderTiles types={providers} rule={rule} suggested={suggested} onChoose={(type) => onCreate(type)} />}
        </section>
      </DialogContent>
    </Dialog>
  );
}

import { useId, useState, type RefObject } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ProviderMark } from '../destinations/ProviderMark';
import { isShown, renderingFor, tierProductName } from '../goals/availability';
import { destinationStatus, setupProblems } from '../destinations/status';
import { targetSaid } from '../destinations/settings';
import type { Connection, Destination, DestinationType } from '../destinations/api';

/**
 * Which audience a save point needs, and how strictly.
 *
 * A **main** signup may also use a route that takes no audience at all — the
 * lead-magnet email delivers rather than subscribes — and refuses only one
 * that subscribes into the other channel. An **optional** signup exists to
 * subscribe its channel, so a route must take it. Publish enforces the same
 * line on the server (`OptinController`).
 */
export interface ChannelRule { readonly channel: string; readonly strict: boolean }

const channels = (requirements: DestinationType['requirements'] | Destination['requirements']) => requirements?.audience_channels ?? [];

export function refusesChannel(accepted: readonly string[], rule: ChannelRule | null): boolean {
  if (rule === null) return false;
  if (accepted.includes(rule.channel)) return false;
  return rule.strict || accepted.length > 0;
}

const wrongChannelSaid = (rule: ChannelRule) => rule.channel === 'phone'
  ? __('Doesn’t take phone numbers.', 'wconvert')
  : __('Doesn’t take email addresses.', 'wconvert');

/** Why a provider cannot be chosen here, or null where it can. */
export function providerRefusal(type: DestinationType, rule: ChannelRule | null): string | null {
  const rendering = renderingFor(type.availability, 'settings_list');
  if (rendering === 'upsell') return sprintf(__('Included with %s.', 'wconvert'), tierProductName(type.tier));
  if (rendering !== 'offer') return sprintf(__('Needs %s on this site.', 'wconvert'), type.requires_label ?? __('something this site does not have', 'wconvert'));
  return refusesChannel(channels(type.requirements), rule) ? wrongChannelSaid(rule as ChannelRule) : null;
}

/**
 * The providers a merchant can set a new route up over, as tiles.
 *
 * A locked type on a free install is not drawn (ADR 0116); every other refusal
 * stays visible with its sentence, as `aria-disabled` rather than `disabled`,
 * so a keyboard reaches the reason too.
 */
export function ProviderTiles({ types, rule, suggested, onChoose }: {
  types: readonly DestinationType[];
  rule: ChannelRule | null;
  suggested: readonly string[];
  onChoose: (type: DestinationType, trigger: HTMLElement) => void;
}) {
  const id = useId();
  const shown = types.filter((type) => isShown(type.availability));
  if (shown.length === 0) return <p className="m-0 text-note text-muted-foreground">{__('No destination providers are available on this site.', 'wconvert')}</p>;
  return (
    <ul className="wconvert-provider-tiles" aria-label={__('Destination providers', 'wconvert')}>
      {shown.map((type) => {
        const refusal = providerRefusal(type, rule);
        const described = refusal !== null || suggested.includes(type.id);
        return (
          <li key={type.id}>
            <button type="button" className="wconvert-provider-tile" aria-disabled={refusal === null ? undefined : true}
              aria-describedby={described ? `${id}-${type.id}` : undefined}
              onClick={(event) => { if (refusal === null) onChoose(type, event.currentTarget); }}>
              <ProviderMark type={type} className="size-6 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">{type.label}</span>
                {refusal !== null ? <span id={`${id}-${type.id}`} className="block text-note text-muted-foreground">{refusal}</span>
                  : suggested.includes(type.id) && <Badge id={`${id}-${type.id}`} variant="outline" className="mt-1">{__('Suggested by your campaign setup', 'wconvert')}</Badge>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

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
                  : refusesChannel(channels(destination.requirements), rule) ? wrongChannelSaid(rule as ChannelRule) : null;
                // The card's rule: the bare target, and a sentence only where nothing is chosen.
                const target = destination.target === '' ? targetSaid('') : destination.target;
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

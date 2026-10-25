import { useId, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { PickerSearch } from '../discovery/PickerSearch';
import { OptionStrip } from '../shell/OptionStrip';
import { DISPLAY_TYPES, displayTypeLabel } from '../displayTypes';
import { formatCount } from '../lib/format';
import { optionCounts, type GalleryCard, type GalleryFilters } from './model';

/** What the gallery's own controls choose; the editor adds its extras beside them. */
export interface GalleryChoices {
  readonly query: string;
  readonly format: string;
  readonly asks: 'any' | 'email' | 'phone' | 'none';
  readonly business: string;
  readonly plan: 'all' | 'free' | 'pro';
  readonly savedOnly: boolean;
}

export const NO_CHOICES: GalleryChoices = { query: '', format: 'all', asks: 'any', business: 'any', plan: 'all', savedOnly: false };

/** An active filter that lives inside More filters, said again as a chip that removes it. */
export interface ActiveFilter {
  readonly id: string;
  readonly label: string;
  readonly remove: () => void;
}

export interface GalleryToolbarProps {
  readonly cards: readonly GalleryCard[];
  /** The filters as the model reads them, collection and extras included. */
  readonly filters: GalleryFilters;
  readonly choices: GalleryChoices;
  readonly onChange: (next: Partial<GalleryChoices>) => void;
  readonly shown: number;
  /** Drawn only where locked cards are mixed in: a Free site with Pro hints. */
  readonly showPlan: boolean;
  /** Hidden inside a collection that has one format. */
  readonly showFormat?: boolean;
  /** The editor's "Show" select, after Format. */
  readonly scope?: ReactNode;
  /** The editor's taxonomy, layout and picture filters, inside More filters. */
  readonly extras?: ReactNode;
  readonly extrasActive?: readonly ActiveFilter[];
  readonly onClear: () => void;
  readonly disabled?: boolean;
}

const ASKS = () => ({ any: __('Anything', 'wconvert'), email: __('Email', 'wconvert'), phone: __('Phone', 'wconvert'), none: __('No form', 'wconvert') });
const ASKS_CHIP = () => ({ email: __('Asks for email', 'wconvert'), phone: __('Asks for phone', 'wconvert'), none: __('No form', 'wconvert') });

/**
 * The gallery's one toolbar row (ADR 0171): search, Format, Plan, More filters
 * and the count — then, under it, a chip for each filter More filters holds.
 */
export function GalleryToolbar({ cards, filters, choices, onChange, shown, showPlan, showFormat = true, scope, extras, extrasActive = [], onClear, disabled = false }: GalleryToolbarProps) {
  const ids = useId();
  const formats = optionCounts(cards, filters, 'format');
  const offered = DISPLAY_TYPES.filter(type => (formats[type] ?? 0) > 0 || choices.format === type);
  const asks = optionCounts(cards, filters, 'asks');
  const askOptions = (['any', 'email', 'phone', 'none'] as const).filter(option => option === 'any' || choices.asks === option || (asks[option] ?? 0) > 0);
  const businessCounts = optionCounts(cards, filters, 'business');
  const businesses = new Map(cards.flatMap(card => card.business_types.map(type => [type.id, type.label] as const)));
  const businessOptions = [...businesses].filter(([id]) => (businessCounts[id] ?? 0) > 0 || choices.business === id);
  const proOnly = (type: string) => cards.some(card => card.displayType === type) && cards.every(card => card.displayType !== type || card.availability === 'locked');
  const askWords = ASKS();
  const active: ActiveFilter[] = [
    ...(choices.asks !== 'any' ? [{ id: 'asks', label: ASKS_CHIP()[choices.asks], remove: () => onChange({ asks: 'any' }) }] : []),
    ...(choices.business !== 'any' ? [{ id: 'business', label: businesses.get(choices.business) ?? choices.business, remove: () => onChange({ business: 'any' }) }] : []),
    ...(choices.savedOnly ? [{ id: 'saved', label: __('Saved', 'wconvert'), remove: () => onChange({ savedOnly: false }) }] : []),
    ...extrasActive,
  ];

  return (
    <div className="wconvert-gallery-toolbar">
      <div className="wconvert-gallery-toolbar__row">
        <PickerSearch label={__('Search templates', 'wconvert')} placeholder={__('Search a need, e.g. a guide or quote…', 'wconvert')}
          value={choices.query} disabled={disabled} onChange={query => onChange({ query })} />
        {showFormat && (offered.length > 1 || choices.format !== 'all') && (
          <label className="wconvert-gallery-toolbar__field">
            <span className="sr-only">{__('Format', 'wconvert')}</span>
            <select className="wconvert-picker__select" value={choices.format} disabled={disabled} onChange={event => onChange({ format: event.target.value })}>
              <option value="all">{__('All formats', 'wconvert')}</option>
              {offered.map(type => <option key={type} value={type}>
                {proOnly(type) ? sprintf(/* translators: %s: a format, e.g. “Slide-in”, offered only with the paid plan. */ __('%s · Pro', 'wconvert'), displayTypeLabel(type)) : displayTypeLabel(type)}
              </option>)}
            </select>
          </label>
        )}
        {scope}
        {showPlan && <div className="wconvert-gallery-toolbar__field">
          <span aria-hidden="true">{__('Plan', 'wconvert')}</span>
          <OptionStrip label={__('Plan', 'wconvert')} value={choices.plan} disabled={disabled}
            options={[{ value: 'all', label: __('All', 'wconvert') }, { value: 'free', label: __('Free', 'wconvert') }, { value: 'pro', label: __('Pro', 'wconvert') }]}
            onChange={plan => onChange({ plan: plan as GalleryChoices['plan'] })} />
        </div>}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={disabled}>
              <SlidersHorizontal aria-hidden="true" />{__('More filters', 'wconvert')}
              {active.length > 0 && <span className="wconvert-gallery-toolbar__more-count">{formatCount(active.length)}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="wconvert-gallery-more">
            {(askOptions.length > 2 || choices.asks !== 'any') && <label>
              <span>{__('Asks for', 'wconvert')}</span>
              <select id={`${ids}-asks`} className="wconvert-picker__select" value={choices.asks} onChange={event => onChange({ asks: event.target.value as GalleryChoices['asks'] })}>
                {askOptions.map(option => <option key={option} value={option}>{askWords[option]}</option>)}
              </select>
            </label>}
            {businessOptions.length > 0 && <label>
              <span>{__('Business', 'wconvert')}</span>
              <select className="wconvert-picker__select" value={choices.business} onChange={event => onChange({ business: event.target.value })}>
                <option value="any">{__('Any business', 'wconvert')}</option>
                {businessOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>}
            {extras}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={choices.savedOnly} onChange={event => onChange({ savedOnly: event.target.checked })} />
              {__('Saved only', 'wconvert')}
            </label>
          </PopoverContent>
        </Popover>
        <span className="wconvert-gallery-toolbar__count" role="status">
          {sprintf(/* translators: 1: how many templates match, 2: how many there are. */ __('%1$s of %2$s', 'wconvert'), formatCount(shown), formatCount(cards.length))}
        </span>
      </div>
      {active.length > 0 && <div className="wconvert-gallery-active" role="group" aria-label={__('Active filters', 'wconvert')}>
        {active.map(filter => <button key={filter.id} type="button" className="wconvert-gallery-active__chip" disabled={disabled} onClick={filter.remove}
          aria-label={sprintf(/* translators: %s: an active filter's label, e.g. “Asks for phone”. */ __('Remove filter: %s', 'wconvert'), filter.label)}>
          {filter.label}<X size={12} aria-hidden="true" />
        </button>)}
        {active.length > 1 && <Button variant="ghost" size="sm" disabled={disabled} onClick={onClear}>{__('Clear filters', 'wconvert')}</Button>}
      </div>}
    </div>
  );
}

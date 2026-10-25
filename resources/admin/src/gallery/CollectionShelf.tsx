import { __, _n, sprintf } from '@wordpress/i18n';
import { X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { OptionStrip } from '../shell/OptionStrip';
import { DesignStage } from '../stage/DesignStage';
import { daysBetween, formatCount, siteLocale } from '../lib/format';
import { lastDay } from '../discovery/model';
import type { Template } from '@renderer/types';
import type { Collection } from '../discovery/api';
import { shelfCovers, type GalleryCard, type ShelfCollection } from './model';

/**
 * The collections, on top of the grid (ADR 0171). A tile filters the grid to
 * its members; pressing it again shows every template. Each tile can be
 * hidden, and the whole shelf can be.
 */
export function CollectionShelf({ shelf, cards, trees, today, active, hidden, onOpen, onHide, onRestore, onHideAll, onNear, disabled = false }: {
  shelf: readonly ShelfCollection[];
  /** The site's day, `YYYY-MM-DD`: a seasonal tile counts the days to its event from it. */
  today: string;
  cards: readonly GalleryCard[];
  /** Live trees for the covers, where they have arrived. */
  trees: ReadonlyMap<string, Template | undefined>;
  active: string | null;
  /** How many collections this person hid, so they can be shown again. */
  hidden: number;
  onOpen: (id: string | null) => void;
  onHide: (id: string) => void;
  onRestore: () => void;
  onHideAll: () => void;
  /** A cover came near the viewport: its tree is worth fetching. */
  onNear?: (key: string) => void;
  disabled?: boolean;
}) {
  if (shelf.length === 0 && hidden === 0) return null;

  return (
    <section className="wconvert-shelf" aria-labelledby="wconvert-shelf-title">
      <div className="wconvert-shelf__head">
        <h2 id="wconvert-shelf-title">{__('Collections', 'wconvert')}</h2>
        {hidden > 0 && <Button variant="ghost" size="sm" disabled={disabled} onClick={onRestore}>
          {sprintf(/* translators: %s: how many collections are hidden. */ __('Show %s hidden', 'wconvert'), formatCount(hidden))}
        </Button>}
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onHideAll}>{__('Hide featured', 'wconvert')}</Button>
      </div>
      <ul className="wconvert-shelf__row">
        {shelf.map(({ collection, members }) => {
          const on = active === collection.id;
          const covers = shelfCovers(members, cards);
          return (
            <li key={collection.id} className="wconvert-shelf__tile" data-active={on || undefined}>
              <button type="button" className="wconvert-shelf__open" disabled={disabled} aria-pressed={on} onClick={() => onOpen(on ? null : collection.id)}
                aria-label={sprintf(/* translators: 1: a collection's name, 2: how many templates it has here. */ _n('%1$s, %2$s template', '%1$s, %2$s templates', members.size, 'wconvert'), collection.name, formatCount(members.size))} />
              <div className="wconvert-shelf__cover" aria-hidden="true">
                {covers.map(card => <div key={card.key}><DesignStage displayType={card.displayType} size="thumb" onNear={onNear && (() => onNear(card.key))}
                  source={card.thumbnail ? { image: card.thumbnail } : trees.get(card.key) ? { live: { template: trees.get(card.key)! } } : undefined} /></div>)}
              </div>
              <div className="wconvert-shelf__text">
                <strong>{collection.name}</strong>
                <span>{sprintf(/* translators: %s: how many templates a collection has here. */ _n('%s template', '%s templates', members.size, 'wconvert'), formatCount(members.size))}</span>
                {collection.event && <span data-season>{seasonWords(collection.event, today)}</span>}
              </div>
              <button type="button" className="wconvert-shelf__hide" disabled={disabled} onClick={() => onHide(collection.id)}
                aria-label={sprintf(/* translators: %s: a collection's name. */ __('Hide %s', 'wconvert'), collection.name)}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** How near an event is counted in days rather than named by its date: two weeks. */
const COUNTDOWN_DAYS = 14;

/**
 * When a seasonal collection is for: the days left while its event is near —
 * "In 6 days", "Tomorrow" — and otherwise the day it is useful until.
 */
function seasonWords(event: NonNullable<Collection['event']>, today: string): string {
  const days = today === '' ? 0 : daysBetween(today, event.start);
  if (days === 1) return __('Tomorrow', 'wconvert');
  if (days > 1 && days <= COUNTDOWN_DAYS) {
    return sprintf(/* translators: %s: how many days until a seasonal event, e.g. “6”. */ _n('In %s day', 'In %s days', days, 'wconvert'), formatCount(days));
  }
  const last = lastDay(event.end_exclusive);
  if (last === today) return __('Ends today', 'wconvert');
  return sprintf(/* translators: %s: the last day of a seasonal collection, e.g. “31 Oct”. */ __('Until %s', 'wconvert'), dayAndMonth(last));
}

/** A day as the site's language says it, without the year: "31 Oct". */
function dayAndMonth(day: string): string {
  return new Intl.DateTimeFormat(siteLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

/** The shelf when it is off: a line that brings it back. */
export function ShelfOff({ onShow, disabled = false }: { onShow: () => void; disabled?: boolean }) {
  return (
    <p className="wconvert-shelf__off m-0">
      {__('Featured collections are hidden.', 'wconvert')}
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onShow}>{__('Show featured', 'wconvert')}</Button>
    </p>
  );
}

/** The open collection: its words, When (only stages it has), and the way back to every template. */
export function CollectionBar({ shelf, stage, onStage, onClose, disabled = false }: {
  shelf: ShelfCollection;
  stage: string;
  onStage: (stage: string) => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const present = new Set(shelf.members.values());
  const stages = (['before', 'during', 'after'] as const).filter(value => present.has(value));
  const words = { before: __('Before', 'wconvert'), during: __('During', 'wconvert'), after: __('After', 'wconvert') };

  return (
    <div className="wconvert-collection-bar">
      <div className="wconvert-collection-bar__text">
        <strong>{shelf.collection.name}</strong>
        {shelf.collection.description && <span>{shelf.collection.description}</span>}
      </div>
      {stages.length > 0 && <div className="wconvert-gallery-toolbar__field">
        <span aria-hidden="true">{__('When', 'wconvert')}</span>
        <OptionStrip label={__('When', 'wconvert')} value={stage} disabled={disabled}
          options={[{ value: 'any', label: __('Any time', 'wconvert') }, ...stages.map(value => ({ value, label: words[value] }))]} onChange={onStage} />
      </div>}
      <Button variant="outline" size="sm" disabled={disabled} onClick={onClose}>{__('Show all templates', 'wconvert')}</Button>
    </div>
  );
}

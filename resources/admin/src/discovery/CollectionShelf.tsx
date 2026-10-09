import { useEffect, useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { formatCount, formatRange } from '../lib/format';
import type { Collection } from './api';
import { lastDay, type matchingCollections } from './model';

/**
 * Featured collections as a shelf, or every collection as a grid. `onHideAll`
 * puts "Hide featured" beside View all, where the shelf it hides is.
 */
export function CollectionShelf({ matches, all = false, disabled, onOpen, onAll, onHide, onHideAll }: {
  matches: ReturnType<typeof matchingCollections>; all?: boolean; disabled: boolean;
  onOpen: (collection: Collection) => void; onAll: () => void; onHide: (id: string) => void; onHideAll?: () => void;
}) {
  const shelf = useRef<HTMLDivElement>(null);
  const shelfId = useId();
  const [position, setPosition] = useState({ overflow: false, start: true, end: true });
  useEffect(() => {
    const node = shelf.current;
    if (!node || all) return;
    const measure = () => {
      const max = node.scrollWidth - node.clientWidth;
      const at = Math.abs(node.scrollLeft);
      const next = { overflow: max > 2, start: at <= 2, end: at >= max - 2 };
      setPosition(previous => previous.overflow === next.overflow && previous.start === next.start && previous.end === next.end ? previous : next);
    };
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    node.addEventListener('scroll', measure, { passive: true });
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); node.removeEventListener('scroll', measure); };
  }, [all, matches.length]);
  if (!matches.length) return null;
  const scroll = (direction: number) => shelf.current?.scrollBy({ left: direction * shelf.current.clientWidth * .75 * (getComputedStyle(shelf.current).direction === 'rtl' ? -1 : 1), behavior: 'smooth' });
  return <section className="wconvert-collections" aria-labelledby={`${shelfId}-heading`}>
    <div className="wconvert-collections__heading"><h3 id={`${shelfId}-heading`}>{all ? __('All collections', 'wconvert') : __('Featured collections', 'wconvert')}</h3>
      {!all && <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" disabled={disabled} onClick={onAll}>{__('View all', 'wconvert')}</Button>
        {onHideAll && <Button variant="ghost" disabled={disabled} onClick={onHideAll}>{__('Hide featured', 'wconvert')}</Button>}
        {position.overflow && <><Button variant="outline" size="icon" disabled={disabled || position.start} aria-controls={shelfId} aria-label={__('Previous collections', 'wconvert')} onClick={() => scroll(-1)}><ArrowLeft className="rtl:-scale-x-100" /></Button>
          <Button variant="outline" size="icon" disabled={disabled || position.end} aria-controls={shelfId} aria-label={__('Next collections', 'wconvert')} onClick={() => scroll(1)}><ArrowRight className="rtl:-scale-x-100" /></Button></>}
      </div>}
    </div>
    <div ref={shelf} id={shelfId} tabIndex={all ? undefined : 0} role="group" aria-label={__('Collection cards', 'wconvert')} className={all ? 'wconvert-collections__grid' : 'wconvert-collections__shelf'}>
      {(all ? matches : matches.slice(0, 5)).map(({ collection, setups, designs }) => <article key={collection.id} className={`wconvert-collection wconvert-collection--${collection.cover}`}>
        <button type="button" className="wconvert-collection__open" disabled={disabled} onClick={() => onOpen(collection)}>
          <span className="wconvert-collection__art" aria-hidden="true"><span /><span /><span /></span>
          <span className="wconvert-collection__copy"><strong>{collection.name}</strong><span>{collection.description}</span>
            {collection.event && <span>{formatRange(collection.event.start, lastDay(collection.event.end_exclusive))}</span>}
            <span className="wconvert-collection__count">{sprintf(_n('%s matching setup', '%s matching setups', setups.length, 'wconvert'), formatCount(setups.length))} · {sprintf(_n('%s design', '%s designs', designs, 'wconvert'), formatCount(designs))}</span>
          </span>
        </button>
        {!all && <button type="button" className="wconvert-collection__hide" disabled={disabled} aria-label={sprintf(__('Hide collection: %s', 'wconvert'), collection.name)} onClick={() => onHide(collection.id)}><X size={15} aria-hidden="true" /></button>}
      </article>)}
    </div>
  </section>;
}

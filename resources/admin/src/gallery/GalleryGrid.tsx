import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { PickerPagination } from '../discovery/PickerPagination';
import { useShownAfterDelay } from '../shell/skeletonDelay';

/** Cards a page holds (ADR 0171). */
export const PER_PAGE = 24;

/**
 * The grid of template cards, its two empty states, and the page position
 * under it.
 */
export function GalleryGrid({ children, total, shown, page, pages, onPage, onClear, empty, disabled = false }: {
  /** This page's cards. */
  children: ReactNode;
  /** Every card before filtering, and how many the filters leave. */
  total: number;
  shown: number;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  onClear: () => void;
  /** What there is to do when the goal has no templates at all. */
  empty: { title: string; body: string; action: ReactNode };
  disabled?: boolean;
}) {
  return (
    <>
      <ul className="wconvert-template-grid">
        {total === 0 ? <Empty title={empty.title} body={empty.body} action={empty.action} />
          : shown === 0 ? <Empty title={__('No templates match', 'wconvert')} body={__('Try fewer filters or another word.', 'wconvert')}
            action={<Button variant="outline" disabled={disabled} onClick={onClear}>{__('Clear filters', 'wconvert')}</Button>} />
            : children}
      </ul>
      {pages > 1 && <PickerPagination label={__('Template pages', 'wconvert')} page={page} pages={pages} disabled={disabled} onChange={onPage} />}
    </>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <li className="wconvert-template-empty">
      <span className="wconvert-template-empty__icon" aria-hidden="true"><LayoutTemplate size={20} /></span>
      <h3>{title}</h3>
      <p className="m-0 text-note text-muted-foreground">{body}</p>
      {action}
    </li>
  );
}

/**
 * The grid's own shape while templates arrive (ADR 0039): a card of stage and
 * words, so nothing jumps when they land. It waits a beat, so a quick answer
 * never flashes it, and announces itself once.
 */
export function GallerySkeleton({ cards = 6 }: { cards?: number }) {
  if (!useShownAfterDelay()) return null;

  return (
    <>
      <span role="status" className="sr-only">{__('Loading…', 'wconvert')}</span>
      <ul className="wconvert-template-grid" aria-hidden="true">
        {Array.from({ length: cards }, (_each, index) => (
          <li key={index} className="wconvert-template-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="wconvert-template-card__body">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-8 w-28" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

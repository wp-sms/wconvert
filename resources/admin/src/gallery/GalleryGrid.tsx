import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { PickerPagination } from '../discovery/PickerPagination';
import { EmptyState } from '../shell/EmptyState';
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
      {total === 0 ? <EmptyState icon={LayoutTemplate} title={empty.title} action={empty.action}>{empty.body}</EmptyState>
        : shown === 0 ? <EmptyState icon={LayoutTemplate} title={__('No templates match', 'wconvert')}
          action={<Button variant="outline" disabled={disabled} onClick={onClear}>{__('Clear filters', 'wconvert')}</Button>}>
          {__('Try fewer filters or another word.', 'wconvert')}
        </EmptyState>
          : <ul className="wconvert-template-grid">{children}</ul>}
      {pages > 1 && <PickerPagination label={__('Template pages', 'wconvert')} page={page} pages={pages} disabled={disabled} onChange={onPage} />}
    </>
  );
}

/**
 * The grid's own shape while templates arrive (ADR 0039): a card of stage and
 * words, so nothing jumps when they land. It announces itself once. A first
 * fill paints at once; `wait` is for a re-read over cards already shown, so a
 * quick answer never flashes it ({@see useShownAfterDelay}).
 */
export function GallerySkeleton({ cards = 6, wait = false }: { cards?: number; wait?: boolean }) {
  if (!useShownAfterDelay(wait)) return null;

  return (
    <>
      <span role="status" className="sr-only">{__('Loading templates…', 'wconvert')}</span>
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

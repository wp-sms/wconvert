import type { Ref } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { BrandMark } from './Brand';

/**
 * The builder in the shape of the builder, and the way out of it.
 *
 * ============================================================================
 * IT IS HERE BECAUSE IT HAS TO LOAD BEFORE THE BUILDER DOES (#73).
 * ============================================================================
 * The builder is behind a lazy boundary, so opening it is a network fetch
 * before a single component of it exists. Whatever stands in that gap cannot
 * live inside the chunk it is waiting for — a fallback shipped with the thing
 * it is a fallback for is a blank frame — so it lives out here with the
 * reading screens and costs them these few lines.
 *
 * **And it is the same skeleton the builder's own first fetch draws.** The gap
 * is two waits end to end: the chunk arrives, then `getOptin` does. Two
 * different placeholders across those two moments is a screen that redraws
 * itself for no reason a merchant can see, so {@see OptinBuilder} renders this
 * one too and the wait reads as one wait.
 *
 * The proportions are the builder's own: its header with the name, actions
 * and Back where they will be, the four tabs, and the screen list, canvas
 * and inspector under them (ADR 0132), so the editor lands without a jump. Nothing here is announced — the `role="status"`
 * sentence carries the whole of what a screen reader needs from a placeholder,
 * and a grid of announced boxes is a spinner read aloud.
 */
export function BuilderSkeleton({ onClose, backLabel }: { onClose: () => void; backLabel?: string }) {
  const bar = (className: string) => <Skeleton aria-hidden="true" className={className} />;
  return (
    <div className="wconvert-builder-skeleton">
      <p role="status" className="sr-only">{__('Loading campaign builder…', 'wconvert')}</p>
      <div className="wconvert-builder-skeleton__header">
        <BackLink onClose={onClose} label={backLabel} className="wconvert-builder-skeleton__back" />
        <BrandMark className="wconvert-builder-skeleton__mark" />
        {bar('h-5 w-44')}
        <span className="wconvert-builder-skeleton__spacer" />
        {bar('wconvert-builder-skeleton__action h-9 w-28')}{bar('wconvert-builder-skeleton__action h-9 w-24')}{bar('h-9 w-36')}
      </div>
      <div className="wconvert-builder-skeleton__tabs" aria-hidden="true">
        {[0, 1, 2, 3].map((tab) => <Skeleton key={tab} className="h-8 flex-1" />)}
      </div>
      <div className="wconvert-builder-skeleton__body" aria-hidden="true">
        <div className="wconvert-builder-skeleton__list">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>
        <div className="wconvert-builder-skeleton__canvas"><Skeleton className="wconvert-builder-skeleton__design" /></div>
        <div className="wconvert-builder-skeleton__panel">
          {[0, 1, 2, 3].map((field) => <div key={field} className="grid gap-2">{bar('h-3 w-24')}{bar('h-9 w-full')}</div>)}
        </div>
      </div>
    </div>
  );
}

/**
 * The way out of the builder.
 *
 * It is a button because leaving an unsaved editor needs a decision before
 * accepting the destination route. The route itself remains bookmarkable.
 *
 * **It lives out here so the skeleton can carry it.** A merchant who opened the
 * builder on a slow connection must be able to leave again before the chunk
 * lands, and the control that leaves cannot be inside the chunk. So the
 * skeleton above and {@see OptinBuilder} render the same component, in the same
 * band, and the way out does not move when the wait ends.
 *
 * App also uses this over the creation flow. Narrow editors use the same
 * header and navigation guard as wide editors.
 *
 * It takes a ref because it is what the unsaved-changes confirm has to put the
 * caret back on — a triggerless dialog restores focus to nothing, which leaves
 * a keyboard merchant on `<body>` ({@see ConfirmDialog}).
 */
export function BackLink({
  onClose,
  ref,
  className,
  label,
  disabled = false,
}: {
  onClose: () => void;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <Button ref={ref} variant="ghost" size="sm" className="-ms-3" onClick={onClose} disabled={disabled}>
        {/* Back is the other way in Persian; see {@see GoalScreen}'s footer. */}
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        {label ?? __('Back to Campaigns', 'wconvert')}
      </Button>
    </div>
  );
}

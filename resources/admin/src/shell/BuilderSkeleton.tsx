import type { Ref } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { PageAction } from './PageActions';
import { RegionSkeleton } from './RegionSkeleton';

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
 * The proportions are the builder's own: a band with the name where the name
 * goes, and one region under it. Nothing here is announced — the `role="status"`
 * sentence carries the whole of what a screen reader needs from a placeholder,
 * and a grid of announced boxes is a spinner read aloud.
 */
export function BuilderSkeleton({ onClose, backLabel }: { onClose: () => void; backLabel?: string }) {
  return (
    <div className="flex flex-col gap-5">
      <PageAction>
        <BackLink onClose={onClose} label={backLabel} />
        <Skeleton aria-hidden="true" className="mt-3 h-9 w-72 max-w-full" />
      </PageAction>
      <RegionSkeleton label={__('Optin builder', 'wconvert')}>
        <Skeleton aria-hidden="true" className="h-4 w-full max-w-md" />
        <Skeleton aria-hidden="true" className="h-48 w-full" />
      </RegionSkeleton>
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
 * {@see App} draws its own below 782px and again over the creation flow, and
 * those are not in the header band: they sit in the page body, so they carry
 * the spacing of where they stand. There is exactly one of the three on screen
 * at a time.
 *
 * **All three are now this component**, which is what makes that sentence
 * true rather than aspirational — App spelled the button out twice, so a
 * change to the way back was a change in three places and the two copies had
 * already drifted a `size` apart from this one. `-ms-3` travels with the
 * control, because pulling a ghost button's padding back so its label starts
 * on the text edge is a fact about the button; `className` is the caller's,
 * because how much room sits under it is a fact about where it stands.
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
        {label ?? __('All Optins', 'wconvert')}
      </Button>
    </div>
  );
}

import { __ } from '@wordpress/i18n';
import { Skeleton } from '../components/ui/skeleton';
import { RegionBody } from './Region';

/**
 * Rows of a plain list, in the shape of the rows that are coming.
 *
 * {@see TableSkeleton} is the same idea for a `DataTable`, and this is for the
 * lists that are not one — a run of choices with a control at the leading edge.
 * The builder's Destinations tab is the first: it used to draw the word
 * *"Loading…"* in a `<p>`, which is a sentence where the list will be rather
 * than the list's own shape, so the region resized when the data landed.
 *
 * `aria-hidden` on the bars and one `role="status"` beside them, for
 * `TableSkeleton`'s reason: a screen reader has nothing to gain from four empty
 * rows and everything to gain from the word "Loading".
 *
 * No anti-flash delay: this fills a region for the first time and there is
 * nothing to flicker against — {@see useShownAfterDelay} draws that line.
 */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <RegionBody className="flex flex-col gap-3">
      <span role="status" className="flex items-center gap-2">
        <span className="sr-only">{__('Loading…', 'wconvert')}</span>
        <Skeleton aria-hidden="true" className="size-4 shrink-0" />
        <Skeleton aria-hidden="true" className="h-4 w-48 max-w-full" />
      </span>

      {Array.from({ length: Math.max(rows - 1, 0) }, (_each, row) => (
        <span key={row} className="flex items-center gap-2">
          <Skeleton aria-hidden="true" className="size-4 shrink-0" />
          <Skeleton aria-hidden="true" className="h-4 w-40 max-w-full" />
        </span>
      ))}
    </RegionBody>
  );
}
